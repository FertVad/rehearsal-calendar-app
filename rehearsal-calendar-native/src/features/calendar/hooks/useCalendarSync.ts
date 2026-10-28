import { logger } from '../../../shared/utils/logger';
/**
 * useCalendarSync Hook
 * React hook for calendar sync functionality
 * Phase 1: Export (App → Calendar)
 * Phase 2: Import (Calendar → App)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  requestCalendarPermissions,
  checkCalendarPermissions,
  getDeviceCalendars,
  getDefaultCalendar,
  BatchSyncResult,
} from '../../../shared/services/calendar';
import {
  isCalendarSyncRunning,
  removeExportedEvents,
  removeImportedEvents,
  runCalendarSync,
  subscribeCalendarSync,
  SyncRun,
} from '../../../shared/services/calendarSync';
import {
  getSyncSettings,
  updateSyncSettings,
  isRehearsalSynced,
  getSyncedRehearsalsCount,
  getImportedEventsCount,
} from '../../../shared/utils/calendarStorage';
import {
  DeviceCalendar,
  CalendarSyncSettings,
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

  // A sync run anywhere in the app — this screen's, a pull, the automatic one.
  const [runActive, setRunActive] = useState(isCalendarSyncRunning);

  // Initialize
  useEffect(() => {
    init();
  }, []);

  // What a run leaves behind — its stamps, the counts — is read once it ends,
  // whoever started it.
  useEffect(() => subscribeCalendarSync((running) => {
    setRunActive(running);
    if (running) return;
    getSyncSettings().then(setSettings);
    getSyncedRehearsalsCount().then(setSyncedCount, (error) =>
      logger.warn('[useCalendarSync] Could not read the synced count:', error));
    getImportedEventsCount().then(setImportedCount, (error) =>
      logger.warn('[useCalendarSync] Could not read the imported count:', error));
  }), []);

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
            setSettings(await updateSyncSettings({ exportCalendarId: defaultCal.id }));
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
          setSettings(await updateSyncSettings({ exportCalendarId: defaultCal.id }));
        }
      }

      return granted;
    } catch (error) {
      logger.error('[useCalendarSync] Request permission failed:', error);
      return false;
    }
  }, []);

  /**
   * Change the settings named, and show them once saved.
   *
   * A patch on the stored settings (calendarStorage.updateSyncSettings), not
   * this state with the change on top: that copy was the last render's, and
   * writing it whole put back the "last import" the sync had stamped since
   * (EO04). The state is set from what was saved and only once it was; a save
   * that fails throws and leaves it as it was (HP05).
   */
  const updateSettings = useCallback(async (newSettings: Partial<CalendarSyncSettings>) => {
    try {
      setSettings(await updateSyncSettings(newSettings));
    } catch (error) {
      logger.error('[useCalendarSync] Update settings failed:', error);
      throw error;
    }
  }, []);

  /**
   * Both directions now — the one sync of the app, as a pull-to-refresh and
   * the automatic run do it (services/calendarSync.ts). It waits for a run
   * already going. "Last export" and "last import" are stamped by the sync
   * itself, only for a run with no failure, and read back when it ends.
   */
  const synchronize = useCallback((): Promise<SyncRun | null> => runCalendarSync('manual'), []);

  /** A batch is a success only if nothing in it failed. */
  const reportBatch = (result: BatchSyncResult) => {
    if (result.failed > 0) {
      setSyncStatus('error');
      setSyncError((result.errors ?? []).join('\n') || null);
    } else {
      setSyncStatus('success');
    }
  };

  // One rehearsal's event is written by the save and the delete themselves,
  // through the sync's queue (services/calendarSync.ts). The hook's own copies,
  // with the calendar of the last render and beside the queue, are gone.

  /**
   * Remove all exported events. Null: the person signed out before its turn
   * came, and nothing was done.
   */
  const removeAll = useCallback(async (
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchSyncResult | null> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      // In the sync's queue: an export pass running alongside would put back
      // what this takes away. As the person who confirmed it, whoever is
      // signed in when its turn comes.
      const result = await removeExportedEvents(onProgress);
      if (!result) {
        setSyncStatus('idle');
        return null;
      }

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
   * Remove all imported availability slots, in the sync's queue: an import
   * running alongside would put them back. Null: the session ended first.
   */
  const clearImported = useCallback(async (
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult | null> => {
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await removeImportedEvents(onProgress);

      setIsImporting(false);

      // Update imported count
      if (result) setImportedCount(0);

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
    // A run is busy from its first step to its last, whoever started it: the
    // screen's own import used to end and leave its controls open while the
    // export still waited on the network (EO04).
    isSyncing: syncStatus === 'syncing' || runActive,
    lastSyncTime: settings.lastExportTime,

    // Export Functions
    requestPermissions,
    updateSettings,
    synchronize,
    removeAll,
    isSynced,
    refresh: init, // Re-initialize

    // Import State (Phase 2)
    isImporting,
    importError,
    importedCount,
    lastImportTime: settings.lastImportTime,

    // Import Functions (Phase 2)
    clearImported,
  };
}
