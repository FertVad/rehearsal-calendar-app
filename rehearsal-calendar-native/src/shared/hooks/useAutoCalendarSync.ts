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
 *
 * The run itself, its queue and its throttle are the calendar sync service's
 * (services/calendarSync.ts), shared by every caller: this hook only decides
 * when to ask for one.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '../../shared/utils/logger';
import { runCalendarSync } from '../services/calendarSync';

/**
 * One automatic run of the sync.
 *
 * Anything can ask for it — the notification handler does, because a push
 * arriving while the app is open used to refresh the unread count and nothing
 * else. Someone else cancelled a rehearsal, the banner said so, and the event
 * stayed in the calendar until the app was sent away and brought back.
 *
 * The queue and the throttle are shared, so an extra caller cannot cause an
 * extra run.
 */
export async function runAutoSync(): Promise<void> {
  await runCalendarSync('auto');
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
   * A sync someone asked for — pull-to-refresh. It waits its turn rather than
   * being dropped, and is the same run as "Synchronize" in the settings.
   */
  const forceSync = useCallback(async () => {
    await runCalendarSync('manual');
  }, []);

  return {
    performAutoSync, // Exposed for automatic triggering
    forceSync, // Exposed for manual triggering (pull-to-refresh)
  };
}
