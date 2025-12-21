/**
 * Automatic Calendar Sync Hook
 * Handles automatic import sync based on settings
 * Note: Export is already handled automatically in AddRehearsalScreen
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSyncSettings } from '../utils/calendarStorage';
import { importCalendarEventsToAvailability } from '../services/calendarSync';

/**
 * Get interval in milliseconds based on setting
 */
function getIntervalMs(interval: 'manual' | 'always' | '15min' | 'hourly' | '6hours' | 'daily'): number | null {
  switch (interval) {
    case 'always':
      return 0; // Sync on every app foreground
    case '15min':
      return 15 * 60 * 1000; // 15 minutes
    case 'hourly':
      return 60 * 60 * 1000; // 1 hour
    case '6hours':
      return 6 * 60 * 60 * 1000; // 6 hours
    case 'daily':
      return 24 * 60 * 60 * 1000; // 24 hours
    case 'manual':
    default:
      return null; // No automatic sync
  }
}

/**
 * Check if enough time has passed since last import
 * Returns settings if should import, null otherwise
 */
async function shouldImportNow(): Promise<{ importCalendarIds: string[] } | null> {
  try {
    const settings = await getSyncSettings();

    // Check if import is enabled
    if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
      return null;
    }

    // Check interval setting
    const intervalMs = getIntervalMs(settings.importInterval);
    if (!intervalMs) {
      return null; // Manual only
    }

    // Check last import time
    if (!settings.lastImportTime) {
      return { importCalendarIds: settings.importCalendarIds }; // Never imported before
    }

    const lastImportTime = new Date(settings.lastImportTime).getTime();
    const now = Date.now();
    const timeSinceLastImport = now - lastImportTime;

    if (timeSinceLastImport >= intervalMs) {
      return { importCalendarIds: settings.importCalendarIds };
    }

    return null;
  } catch (error) {
    console.error('[AutoSync] Error checking if should import:', error);
    return null;
  }
}

/**
 * Hook to manage automatic calendar import
 * - Imports on app foreground if enough time has passed
 * - Respects importInterval setting
 * - Prevents duplicate syncs with throttling
 * Note: Export happens automatically when rehearsals are created (see AddRehearsalScreen)
 */
export function useAutoCalendarSync() {
  const appState = useRef(AppState.currentState);
  const lastSyncAttempt = useRef<number>(0);
  const THROTTLE_MS = 5000; // Minimum 5 seconds between sync attempts

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const previousState = appState.current;
    appState.current = nextAppState;

    // Only sync when coming to foreground
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[AutoSync] App came to foreground');
      await performAutoSync();
    }
  };

  const performAutoSync = async () => {
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
  };

  return {
    performAutoSync, // Exposed for manual triggering if needed
  };
}
