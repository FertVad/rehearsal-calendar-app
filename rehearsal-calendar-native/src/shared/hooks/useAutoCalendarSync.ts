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
import { importCalendarEventsToAvailability, syncAllRehearsals } from '../services/calendar';
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
 * Rate-limited on its own clock: each rehearsal costs a mapping lookup, so
 * running this on every trip to the foreground would fire a burst of requests
 * for a list that rarely changes.
 */
const EXPORT_EVERY_MS = 10 * 60 * 1000;

async function exportRehearsalsIfDue(force = false): Promise<void> {
  const settings = await getSyncSettings();
  if (!settings.exportEnabled || !settings.exportCalendarId) {
    logger.debug('[AutoSync] Export not enabled - skipping');
    return;
  }

  if (!force && settings.lastExportTime) {
    const since = Date.now() - new Date(settings.lastExportTime).getTime();
    if (since < EXPORT_EVERY_MS) {
      logger.debug('[AutoSync] Exported recently - skipping');
      return;
    }
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
  }));

  if (rehearsals.length === 0) {
    logger.debug('[AutoSync] No rehearsals to export');
    return;
  }

  const result = await syncAllRehearsals(rehearsals, settings.exportCalendarId);
  logger.debug('[AutoSync] Export completed:', result);

  await saveSyncSettings({ ...settings, lastExportTime: new Date().toISOString() });
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
export function useAutoCalendarSync() {
  const appState = useRef(AppState.currentState);
  const lastSyncAttempt = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const THROTTLE_MS = 5000; // Minimum 5 seconds between sync attempts

  const performAutoSync = useCallback(async () => {
    // Signing in with Apple or Google backgrounds the app while the native
    // sheet is up; dismissing it fires a foreground event and lands us here
    // before the token is stored. Syncing then just produces a burst of 401s.
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) {
      logger.debug('[AutoSync] No session - skipping');
      return;
    }

    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      logger.debug('[AutoSync] Already syncing - skipping');
      return;
    }

    // Throttle: prevent syncs within 5 seconds of each other
    const now = Date.now();
    if (now - lastSyncAttempt.current < THROTTLE_MS) {
      logger.debug('[AutoSync] Throttled - too soon since last sync attempt');
      return;
    }
    lastSyncAttempt.current = now;
    isSyncingRef.current = true;

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
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

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
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  /**
   * Force sync - ignores interval settings, always syncs if import is enabled
   * Used for manual triggers like pull-to-refresh
   */
  const forceSync = useCallback(async () => {
    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      logger.debug('[AutoSync] Force sync - already syncing, skipping');
      return;
    }

    isSyncingRef.current = true;

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
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  return {
    performAutoSync, // Exposed for automatic triggering
    forceSync, // Exposed for manual triggering (pull-to-refresh)
  };
}
