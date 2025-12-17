/**
 * useCalendarSync Hook
 * React hook for calendar sync functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  requestCalendarPermissions,
  checkCalendarPermissions,
  getDeviceCalendars,
  getDefaultCalendar,
  syncRehearsalToCalendar,
  unsyncRehearsal,
  syncAllRehearsals,
  removeAllExportedEvents,
  BatchSyncResult,
} from '../../../shared/services/calendarSync';
import {
  getSyncSettings,
  saveSyncSettings,
  isRehearsalSynced,
  getSyncedRehearsalsCount,
} from '../../../shared/utils/calendarStorage';
import {
  DeviceCalendar,
  CalendarSyncSettings,
  RehearsalWithProject,
  SyncStatus,
} from '../../../shared/types/calendar';

export function useCalendarSync() {
  // State
  const [hasPermission, setHasPermission] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [settings, setSettings] = useState<CalendarSyncSettings>({
    exportEnabled: false,
    exportCalendarId: null,
    lastExportTime: null,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);

  // Initialize
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      // Check permission
      const permission = await checkCalendarPermissions();
      setHasPermission(permission);

      // Load settings
      const savedSettings = await getSyncSettings();
      setSettings(savedSettings);

      // Load synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);

      // If has permission, load calendars
      if (permission) {
        const deviceCalendars = await getDeviceCalendars();
        setCalendars(deviceCalendars);

        // Set default calendar if not set
        if (!savedSettings.exportCalendarId && deviceCalendars.length > 0) {
          const defaultCal = await getDefaultCalendar();
          if (defaultCal) {
            const updated = { ...savedSettings, exportCalendarId: defaultCal.id };
            await saveSyncSettings(updated);
            setSettings(updated);
          }
        }
      }
    } catch (error) {
      console.error('[useCalendarSync] Init failed:', error);
    }
  };

  /**
   * Request permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      const granted = await requestCalendarPermissions();
      setHasPermission(granted);

      if (granted) {
        // Reload calendars
        const deviceCalendars = await getDeviceCalendars();
        setCalendars(deviceCalendars);

        // Set default calendar
        const defaultCal = await getDefaultCalendar();
        if (defaultCal) {
          const updated = { ...settings, exportCalendarId: defaultCal.id };
          await saveSyncSettings(updated);
          setSettings(updated);
        }
      }

      return granted;
    } catch (error) {
      console.error('[useCalendarSync] Request permission failed:', error);
      return false;
    }
  }, [settings]);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<CalendarSyncSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await saveSyncSettings(updated);
      setSettings(updated);
    } catch (error) {
      console.error('[useCalendarSync] Update settings failed:', error);
      throw error;
    }
  }, [settings]);

  /**
   * Sync single rehearsal
   */
  const syncRehearsal = useCallback(async (rehearsal: RehearsalWithProject) => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    if (!settings.exportCalendarId) {
      throw new Error('No calendar selected');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      await syncRehearsalToCalendar(rehearsal, settings.exportCalendarId);
      setSyncStatus('success');

      // Update synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);

      // Update last export time
      await updateSettings({ lastExportTime: new Date().toISOString() });
    } catch (error: any) {
      console.error('[useCalendarSync] Sync rehearsal failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission, settings, updateSettings]);

  /**
   * Unsync single rehearsal (remove from calendar)
   */
  const unsync = useCallback(async (rehearsalId: string) => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      await unsyncRehearsal(rehearsalId);
      setSyncStatus('success');

      // Update synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);
    } catch (error: any) {
      console.error('[useCalendarSync] Unsync rehearsal failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission]);

  /**
   * Sync all rehearsals
   */
  const syncAll = useCallback(async (
    rehearsals: RehearsalWithProject[],
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchSyncResult> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    if (!settings.exportCalendarId) {
      throw new Error('No calendar selected');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const result = await syncAllRehearsals(
        rehearsals,
        settings.exportCalendarId,
        onProgress
      );

      setSyncStatus('success');

      // Update synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);

      // Update last export time
      await updateSettings({ lastExportTime: new Date().toISOString() });

      return result;
    } catch (error: any) {
      console.error('[useCalendarSync] Sync all failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission, settings, updateSettings]);

  /**
   * Remove all exported events
   */
  const removeAll = useCallback(async (
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchSyncResult> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const result = await removeAllExportedEvents(onProgress);

      setSyncStatus('success');

      // Update synced count
      setSyncedCount(0);

      return result;
    } catch (error: any) {
      console.error('[useCalendarSync] Remove all failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission]);

  /**
   * Check if specific rehearsal is synced
   */
  const isSynced = useCallback(async (rehearsalId: string): Promise<boolean> => {
    try {
      return await isRehearsalSynced(rehearsalId);
    } catch (error) {
      console.error('[useCalendarSync] Check sync status failed:', error);
      return false;
    }
  }, []);

  return {
    // State
    hasPermission,
    calendars,
    settings,
    syncStatus,
    syncError,
    syncedCount,
    isSyncing: syncStatus === 'syncing',
    lastSyncTime: settings.lastExportTime,

    // Functions
    requestPermissions,
    updateSettings,
    syncRehearsal,
    unsync,
    syncAll,
    removeAll,
    isSynced,
    refresh: init, // Re-initialize
  };
}
