import { useState, useCallback } from 'react';
import { getSyncSettings } from '../../../shared/utils/calendarStorage';

/**
 * Hook for managing calendar sync state and logic
 */
export const useAvailabilitySync = () => {
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Check if auto-sync should be triggered (15+ minutes since last sync)
   */
  const shouldAutoSync = async (): Promise<boolean> => {
    const settings = await getSyncSettings();

    // Skip if import not enabled
    if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
      return false;
    }

    // If never synced, sync now
    if (!settings.lastImportTime) {
      return true;
    }

    // Check if 15+ minutes passed since last sync
    const lastSync = new Date(settings.lastImportTime).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    return now - lastSync >= fifteenMinutes;
  };

  /**
   * Load last sync time from storage
   */
  const loadLastSyncTime = useCallback(async () => {
    const settings = await getSyncSettings();
    setLastSyncTime(settings.lastImportTime);
  }, []);

  /**
   * Update last sync time after sync completes
   */
  const updateLastSyncTime = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const settings = await getSyncSettings();
    setLastSyncTime(settings.lastImportTime);
  }, []);

  /**
   * Format last sync time for display
   */
  const formatLastSync = useCallback(
    (lastSync: string | null, t: any): string => {
      if (!lastSync) return '';

      const now = Date.now();
      const syncTime = new Date(lastSync).getTime();
      const diffMs = now - syncTime;
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (diffMinutes < 1) {
        return t.calendarSync.justNow;
      } else if (diffMinutes < 60) {
        return t.calendarSync.minutesAgo(diffMinutes);
      } else if (diffHours < 24) {
        return t.calendarSync.hoursAgo(diffHours);
      } else {
        return t.calendarSync.daysAgo(diffDays);
      }
    },
    []
  );

  /**
   * Perform smart sync: only if 15+ minutes passed
   */
  const performSmartSync = useCallback(
    async (
      performAutoSync: () => Promise<void>,
      loadAvailability: () => Promise<void>
    ) => {
      const shouldSync = await shouldAutoSync();

      if (shouldSync) {
        setIsSyncing(true);
        await performAutoSync();
        await updateLastSyncTime();
        setIsSyncing(false);
      }

      await loadAvailability();
    },
    [updateLastSyncTime]
  );

  /**
   * Force sync (for pull-to-refresh)
   */
  const performForceSync = useCallback(
    async (forceSync: () => Promise<void>, loadAvailability: () => Promise<void>) => {
      setIsSyncing(true);
      try {
        await forceSync();
        await updateLastSyncTime();
        await loadAvailability();
      } finally {
        setIsSyncing(false);
      }
    },
    [updateLastSyncTime]
  );

  return {
    lastSyncTime,
    isSyncing,
    loadLastSyncTime,
    formatLastSync,
    performSmartSync,
    performForceSync,
  };
};
