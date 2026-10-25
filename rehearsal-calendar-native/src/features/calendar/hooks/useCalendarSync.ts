import { logger } from '../../../shared/utils/logger';
/**
 * useCalendarSync Hook
 * React hook for calendar sync functionality
 * Phase 1: Export (App → Calendar)
 * Phase 2: Import (Calendar → App)
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
  importCalendarEventsToAvailability,
  removeAllImportedSlots,
} from '../../../shared/services/calendar';
import {
  getSyncSettings,
  saveSyncSettings,
  isRehearsalSynced,
  getSyncedRehearsalsCount,
  getImportedEventsCount,
} from '../../../shared/utils/calendarStorage';
import {
  DeviceCalendar,
  CalendarSyncSettings,
  RehearsalWithProject,
  SyncStatus,
  ImportResult,
} from '../../../shared/types/calendar';

export function useCalendarSync() {
  // Export State
  const [hasPermission, setHasPermission] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [settings, setSettings] = useState<CalendarSyncSettings>({
    exportEnabled: false,
    exportCalendarId: null,
    lastExportTime: null,
    importEnabled: false,
    importCalendarIds: [],
    importInterval: 'manual',
    lastImportTime: null,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);

  // Import State (Phase 2)
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

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

      // Load export synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);

      // Load import count (Phase 2). One that cannot be read leaves the last
      // known count standing rather than reading as none.
      await getImportedEventsCount().then(setImportedCount, (error) =>
        logger.warn('[useCalendarSync] Could not read the imported count:', error));

      // If has permission, load calendars
      if (permission) {
        const deviceCalendars = await getDeviceCalendars();

        // DEBUG: Log all calendars found
        logger.debug('[DEBUG] 📅 Total calendars found:', deviceCalendars.length);
        deviceCalendars.forEach((cal, index) => {
          logger.debug(`[DEBUG] Calendar ${index + 1}:`, {
            title: cal.title,
            source: cal.source?.name || 'Unknown',
            type: cal.source?.type || 'N/A',
            color: cal.color,
            allowsModifications: cal.allowsModifications,
          });
        });

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
      logger.error('[useCalendarSync] Init failed:', error);
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
      logger.error('[useCalendarSync] Request permission failed:', error);
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
      logger.error('[useCalendarSync] Update settings failed:', error);
      throw error;
    }
  }, [settings]);

  /**
   * The settings as the sync left them.
   *
   * "Last export" and "last import" are stamped by the sync itself, and only
   * for a run with no failure (export.ts, import.ts). This hook stamped them
   * again after every run, whatever came back, so a run that failed showed
   * "synced just now" (EI02, EO06). It reads them instead — and the screen,
   * which writes whole settings objects from this state, then cannot write an
   * older stamp back over a newer one.
   */
  const reloadSettings = useCallback(async () => {
    setSettings(await getSyncSettings());
  }, []);

  /** A batch is a success only if nothing in it failed. */
  const reportBatch = (result: BatchSyncResult) => {
    if (result.failed > 0) {
      setSyncStatus('error');
      setSyncError((result.errors ?? []).join('\n') || null);
    } else {
      setSyncStatus('success');
    }
  };

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
      // One rehearsal written is not the calendar in line: no "last export".
    } catch (error: any) {
      logger.error('[useCalendarSync] Sync rehearsal failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission, settings]);

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
      logger.error('[useCalendarSync] Unsync rehearsal failed:', error);
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

      // Failures come back counted, not thrown; a run with any is not a success.
      reportBatch(result);

      // Update synced count
      const count = await getSyncedRehearsalsCount();
      setSyncedCount(count);

      await reloadSettings();

      return result;
    } catch (error: any) {
      logger.error('[useCalendarSync] Sync all failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      throw error;
    }
  }, [hasPermission, settings, reloadSettings]);

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

      reportBatch(result);

      // What could not be removed keeps its mapping, and is still counted.
      setSyncedCount(result.failed ? await getSyncedRehearsalsCount() : 0);

      return result;
    } catch (error: any) {
      logger.error('[useCalendarSync] Remove all failed:', error);
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
      logger.error('[useCalendarSync] Check sync status failed:', error);
      return false;
    }
  }, []);

  /**
   * Import calendar events as availability slots
   * Phase 2: Calendar → App
   */
  const importNow = useCallback(async (
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    if (!settings.importEnabled || settings.importCalendarIds.length === 0) {
      throw new Error('Import not enabled or no calendars selected');
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importCalendarEventsToAvailability(
        settings.importCalendarIds,
        onProgress
      );

      setIsImporting(false);
      // A calendar that could not be read is counted as failed, not thrown.
      if (result.failed > 0) setImportError(result.errors.join('\n'));

      // Update imported count
      await getImportedEventsCount().then(setImportedCount, (error) =>
        logger.warn('[useCalendarSync] Could not read the imported count:', error));

      await reloadSettings();

      return result;
    } catch (error: any) {
      logger.error('[useCalendarSync] Import failed:', error);
      setIsImporting(false);
      setImportError(error.message);
      throw error;
    }
  }, [hasPermission, settings, reloadSettings]);

  /**
   * Remove all imported availability slots
   * Phase 2: Clear imported events
   */
  const clearImported = useCallback(async (
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await removeAllImportedSlots(onProgress);

      setIsImporting(false);

      // Update imported count
      setImportedCount(0);

      return result;
    } catch (error: any) {
      logger.error('[useCalendarSync] Clear imported failed:', error);
      setIsImporting(false);
      setImportError(error.message);
      throw error;
    }
  }, [hasPermission]);

  return {
    // Export State
    hasPermission,
    calendars,
    settings,
    syncStatus,
    syncError,
    syncedCount,
    isSyncing: syncStatus === 'syncing',
    lastSyncTime: settings.lastExportTime,

    // Export Functions
    requestPermissions,
    updateSettings,
    syncRehearsal,
    unsync,
    syncAll,
    removeAll,
    isSynced,
    refresh: init, // Re-initialize

    // Import State (Phase 2)
    isImporting,
    importError,
    importedCount,
    lastImportTime: settings.lastImportTime,

    // Import Functions (Phase 2)
    importNow,
    clearImported,
  };
}
