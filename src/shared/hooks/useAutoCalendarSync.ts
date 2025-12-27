/**
 * Automatic Calendar Sync Hook
 * Handles automatic import sync based on settings
 * Note: Export is already handled automatically in AddRehearsalScreen
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSyncSettings } from '../utils/calendarStorage';
import { importCalendarEventsToAvailability } from '../services/calendar';

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
      console.log('[AutoSync] Import not enabled or no calendars selected');
      return null;
    }

    console.log('[AutoSync] Import enabled, will sync from', settings.importCalendarIds.length, 'calendars');
    return { importCalendarIds: settings.importCalendarIds };
  } catch (error) {
    console.error('[AutoSync] Error checking if should import:', error);
    return null;
  }
}

/**
 * Hook to manage automatic calendar import
 * UI has simple on/off toggle - when enabled, sync happens automatically:
 * - On app foreground (background → active)
 * - Throttled to prevent duplicate syncs (5 sec minimum between attempts)
 *
 * Note: Export happens automatically when rehearsals are created (see AddRehearsalScreen)
 */
export function useAutoCalendarSync() {
  const appState = useRef(AppState.currentState);
  const lastSyncAttempt = useRef<number>(0);
  const THROTTLE_MS = 5000; // Minimum 5 seconds between sync attempts

  const performAutoSync = useCallback(async () => {
    // Throttle: prevent syncs within 5 seconds of each other
    const now = Date.now();
    if (now - lastSyncAttempt.current < THROTTLE_MS) {
      console.log('[AutoSync] Throttled - too soon since last sync attempt');
      return;
    }
    lastSyncAttempt.current = now;

    try {
      // Check if we should import
      const importSettings = await shouldImportNow();
      if (importSettings) {
        console.log('[AutoSync] Auto-importing calendar events');
        const result = await importCalendarEventsToAvailability(importSettings.importCalendarIds);
        console.log('[AutoSync] Auto-import completed:', result);
      } else {
        console.log('[AutoSync] No import needed at this time');
      }
    } catch (error) {
      console.error('[AutoSync] Error during auto-import:', error);
    }
  }, []);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    const previousState = appState.current;
    appState.current = nextAppState;

    // Only sync when coming to foreground
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[AutoSync] App came to foreground');
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
    try {
      const settings = await getSyncSettings();
      console.log('[AutoSync] Force sync - current settings:', {
        importEnabled: settings.importEnabled,
        calendarsCount: settings.importCalendarIds.length,
        lastImportTime: settings.lastImportTime
      });

      // Only check if import is enabled
      if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
        console.log('[AutoSync] Force sync skipped - import not enabled');
        return;
      }

      console.log('[AutoSync] Force syncing calendar events from', settings.importCalendarIds.length, 'calendars');
      const result = await importCalendarEventsToAvailability(settings.importCalendarIds);
      console.log('[AutoSync] Force sync completed:', result);
    } catch (error) {
      console.error('[AutoSync] Error during force sync:', error);
      throw error;
    }
  }, []);

  return {
    performAutoSync, // Exposed for automatic triggering
    forceSync, // Exposed for manual triggering (pull-to-refresh)
  };
}
