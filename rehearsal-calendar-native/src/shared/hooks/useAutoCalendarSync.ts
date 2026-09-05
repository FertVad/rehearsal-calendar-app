import { logger } from '../../shared/utils/logger';
/**
 * Automatic Calendar Sync Hook
 *
 * Runs both directions when Auto Sync is on: events from the device become
 * availability, and the rehearsals you are on become events.
 *
 * The export half matters most for people who did not create the rehearsal.
 * Saving one exports it, but only on the device of whoever pressed save — so
 * without this, being added to a rehearsal put it on nobody's calendar but the
 * organiser's, however many pushes went out.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSyncSettings, saveSyncSettings } from '../utils/calendarStorage';
import { importCalendarEventsToAvailability, syncAllRehearsals, unsyncRehearsal } from '../services/calendar';
import { getAllMappings } from '../utils/calendarMappings';
import { projectsAPI, rehearsalsAPI } from '../services/api';

/**
 * Check if should import now
 * UI only has on/off toggle, so we sync if import is enabled
 */
async function shouldImportNow(): Promise<{ importCalendarIds: string[] } | null> {
  try {
    const settings = await getSyncSettings();

    // Simply check if import is enabled
    // UI doesn't have interval selection - when Auto Sync is ON, we always sync
    if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
      logger.debug('[AutoSync] Import not enabled or no calendars selected');
      return null;
    }

    logger.debug('[AutoSync] Import enabled, will sync from', settings.importCalendarIds.length, 'calendars');
    return { importCalendarIds: settings.importCalendarIds };
  } catch (error) {
    console.error('[AutoSync] Error checking if should import:', error);
    return null;
  }
}

/**
 * Push every rehearsal the user is on into their calendar.
 *
 * This used to be rate-limited to once every ten minutes, because it asked the
 * server which event belonged to each rehearsal one at a time. That cost is
 * gone — the mappings come back in a single request now — and with it the
 * reason to hold back. Somebody else's edit reaches the calendar the next time
 * the app is opened rather than whenever the reader happens to pull down.
 */

async function exportRehearsalsIfDue(force = false): Promise<void> {
  const settings = await getSyncSettings();
  if (!settings.exportEnabled || !settings.exportCalendarId) {
    logger.debug('[AutoSync] Export not enabled - skipping');
    return;
  }

  const projectsRes = await projectsAPI.getUserProjects();
  const projectIds = (projectsRes.data?.projects || []).map((p: any) => p.id);
  if (projectIds.length === 0) {
    logger.debug('[AutoSync] No projects - nothing to export');
    return;
  }

  const res = await rehearsalsAPI.getBatch(projectIds);
  const rehearsals = (res.data?.rehearsals || []).map((r: any) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    location: r.location,
    title: r.title,
  }));

  // Take back the events of rehearsals that no longer exist.
  //
  // The export only ever created and updated: it walks the rehearsals that are
  // there, and nothing walked the other way. So when a rehearsal was cancelled,
  // the organiser's own device removed its event at that moment and every other
  // participant kept theirs — an entry with an alarm for a call that does not
  // exist, which nothing could reach afterwards.
  //
  // Nobody can delete it remotely: the event lives in a calendar on that
  // person's phone. It can only be noticed here, by the device that owns it.
  //
  // Safe against a bad answer because both requests above throw rather than
  // returning nothing, so an empty list really is empty — someone who has left
  // every project should indeed keep no exported events.
  // Fetched once, for both halves of the work below.
  //
  // This is what let the ten-minute interval go. The export used to ask the
  // server which event belonged to each rehearsal separately — twenty
  // rehearsals, twenty requests, every trip to the foreground — and the
  // interval existed to keep that from happening constantly. Its cost was also
  // its consequence: somebody else's edit did not reach the calendar until the
  // reader thought to pull down. One request answers for all of them.
  const mappings = await getAllMappings();

  await reconcileDeletedRehearsals(
    rehearsals.map((r: { id: string }) => String(r.id)),
    mappings
  );

  if (rehearsals.length === 0) {
    logger.debug('[AutoSync] No rehearsals to export');
    return;
  }

  const result = await syncAllRehearsals(rehearsals, settings.exportCalendarId, undefined, mappings);
  logger.debug('[AutoSync] Export completed:', result);

  // Only a run that wrote everything counts as done.
  //
  // syncAllRehearsals reports failures rather than throwing, and this stamp was
  // written regardless — which is worse here than in the import, because the
  // ten-minute interval above reads it. A wholly failed export therefore
  // announced success and then refused to try again for ten minutes. Leaving
  // the stamp alone makes the next trip to the foreground retry.
  if (result.failed === 0) {
    await saveSyncSettings({ ...settings, lastExportTime: new Date().toISOString() });
  } else {
    logger.warn(`[AutoSync] ${result.failed} rehearsals failed to export - will retry`);
  }
}

/**
 * Delete the calendar event of every rehearsal we hold a mapping for that is
 * not in `liveRehearsalIds`.
 *
 * Failures are per-rehearsal on purpose: one event that cannot be removed —
 * the calendar is gone, permission was revoked — must not stop the rest, and
 * must not lose the mapping either, or the event becomes unreachable. So a
 * failure leaves the mapping alone and the next sync tries again.
 */
async function reconcileDeletedRehearsals(
  liveRehearsalIds: string[],
  mappings: Record<string, { eventId: string; calendarId: string }>
): Promise<void> {
  const live = new Set(liveRehearsalIds);
  const stale = Object.keys(mappings).filter((rehearsalId) => !live.has(String(rehearsalId)));

  if (stale.length === 0) return;

  logger.info(`[AutoSync] Removing ${stale.length} exported events for deleted rehearsals`);

  for (const rehearsalId of stale) {
    try {
      await unsyncRehearsal(rehearsalId);
    } catch (error) {
      logger.error(`[AutoSync] Could not remove the event for rehearsal ${rehearsalId}:`, error);
    }
  }
}

/**
 * Hook to manage automatic calendar import
 * UI has simple on/off toggle - when enabled, sync happens automatically:
 * - On app foreground (background → active)
 * - Throttled to prevent duplicate syncs (5 sec minimum between attempts)
 *
 * Saving a rehearsal also exports that one straight away, on the device that
 * saved it; this covers everybody else.
 */
// Shared by every caller of this hook, deliberately.
//
// These were useRef, so each mount had its own lock and its own throttle and
// none of them could see the others. That was invisible while the hook had a
// single caller and would have become a race the moment it had two — which is
// exactly what mounting it on the tab bar does. An overlapping import is how a
// duplicate row reached the database once already.
let currentSync: Promise<void> | null = null;
let lastSyncAttempt = 0;
const THROTTLE_MS = 5000; // Minimum 5 seconds between sync attempts

/**
 * One sync at a time — but a deliberate one waits its turn instead of being
 * dropped.
 *
 * Both callers used to return the moment they found the lock held, which was
 * invisible while each mount had its own. Sharing it made the collision real:
 * the tab bar syncs on launch, and a pull-to-refresh in the availability sheet
 * a second later found the lock taken and did nothing at all — spinner and no
 * work. A person pulling down has asked for something and must get it.
 *
 * An automatic run is opportunistic and still drops: there will be another.
 */
async function runExclusively(
  work: () => Promise<void>,
  { waitForTurn }: { waitForTurn: boolean }
): Promise<void> {
  if (currentSync) {
    if (!waitForTurn) return;
    await currentSync.catch(() => {});
  }

  const run = work().finally(() => {
    if (currentSync === run) currentSync = null;
  });
  currentSync = run;
  await run;
}

/**
 * One run of the automatic sync.
 *
 * At module scope rather than inside the hook so anything can ask for it — the
 * notification handler does, because a push arriving while the app is open used
 * to refresh the unread count and nothing else. Someone else cancelled a
 * rehearsal, the banner said so, and the event stayed in the calendar until the
 * app was sent away and brought back.
 *
 * The lock and the throttle are shared, so an extra caller cannot cause an
 * extra run.
 */
export async function runAutoSync(): Promise<void> {

    // Signing in with Apple or Google backgrounds the app while the native
    // sheet is up; dismissing it fires a foreground event and lands us here
    // before the token is stored. Syncing then just produces a burst of 401s.
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) {
      logger.debug('[AutoSync] No session - skipping');
      return;
    }

    // Throttle: prevent syncs within 5 seconds of each other
    const now = Date.now();
    if (now - lastSyncAttempt < THROTTLE_MS) {
      logger.debug('[AutoSync] Throttled - too soon since last sync attempt');
      return;
    }
    lastSyncAttempt = now;

    await runExclusively(async () => {
    try {
      // Check if we should import
      const importSettings = await shouldImportNow();
      if (importSettings) {
        logger.debug('[AutoSync] Auto-importing calendar events');
        const result = await importCalendarEventsToAvailability(importSettings.importCalendarIds);
        logger.debug('[AutoSync] Auto-import completed:', result);
      } else {
        logger.debug('[AutoSync] No import needed at this time');
      }

      // A failed import should not stop the export, and the other way round.
      try {
        await exportRehearsalsIfDue();
      } catch (error) {
        console.error('[AutoSync] Error during auto-export:', error);
      }
    } catch (error) {
      console.error('[AutoSync] Error during auto-import:', error);
    }
    }, { waitForTurn: false });
}

interface AutoSyncOptions {
  /**
   * Watch for the app returning from the background and sync then.
   *
   * Off by default and switched on in exactly one place, the tab bar, because
   * the listener has to be registered once and live as long as the session.
   * It used to be registered by this hook's only caller, the availability
   * editor — which is not a tab but a modal reached from the "+" button, so
   * automatic sync existed only while that sheet was open. Anyone who turned it
   * on and never opened the sheet got nothing, while the settings screen said
   * it was running.
   */
  syncOnForeground?: boolean;
}

export function useAutoCalendarSync({ syncOnForeground = false }: AutoSyncOptions = {}) {
  const appState = useRef(AppState.currentState);

  const performAutoSync = useCallback(runAutoSync, []);


  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    const previousState = appState.current;
    appState.current = nextAppState;

    // Only sync when coming to foreground
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      logger.debug('[AutoSync] App came to foreground');
      await performAutoSync();
    }
  }, [performAutoSync]);

  useEffect(() => {
    if (!syncOnForeground) return;

    // A cold launch is not a transition. AppState.currentState is already
    // 'active' when the app starts from nothing, so the listener below never
    // fires for it — which left the commonest case uncovered: tapping a
    // notification for an app that was not running. The throttle and the token
    // check make this safe to call straight away.
    performAutoSync();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange, performAutoSync, syncOnForeground]);

  /**
   * Force sync - ignores interval settings, always syncs if import is enabled
   * Used for manual triggers like pull-to-refresh
   */
  const forceSync = useCallback(async () => {
    // A pull-to-refresh waits rather than being dropped — see runExclusively.
    await runExclusively(async () => {
    try {
      const settings = await getSyncSettings();
      logger.debug('[AutoSync] Force sync - current settings:', {
        importEnabled: settings.importEnabled,
        calendarsCount: settings.importCalendarIds.length,
        lastImportTime: settings.lastImportTime
      });

      // Pull-to-refresh means "now", so the export ignores its own timer.
      try {
        await exportRehearsalsIfDue(true);
      } catch (error) {
        console.error('[AutoSync] Force sync - export failed:', error);
      }

      // Only check if import is enabled
      if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
        logger.debug('[AutoSync] Force sync skipped - import not enabled');
        return;
      }

      logger.debug('[AutoSync] Force syncing calendar events from', settings.importCalendarIds.length, 'calendars');
      const result = await importCalendarEventsToAvailability(settings.importCalendarIds);
      logger.debug('[AutoSync] Force sync completed:', result);
    } catch (error) {
      console.error('[AutoSync] Error during force sync:', error);
      throw error;
    }
    }, { waitForTurn: true });
  }, []);

  return {
    performAutoSync, // Exposed for automatic triggering
    forceSync, // Exposed for manual triggering (pull-to-refresh)
  };
}
