import { logger } from '../../shared/utils/logger';
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
  const isSyncingRef = useRef<boolean>(false);
  const THROTTLE_MS = 5000; // Minimum 5 seconds between sync attempts

  const performAutoSync = useCallback(async () => {
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
