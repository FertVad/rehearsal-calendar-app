/**
 * Tests for useCalendarSync Hook
 * Tests calendar export and import functionality
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCalendarSync } from '../useCalendarSync';
import * as calendar from '../../../../shared/services/calendar';
import * as calendarStorage from '../../../../shared/utils/calendarStorage';
import { runCalendarSync, runCalendarWork } from '../../../../shared/services/calendarSync';

// Mock dependencies
jest.mock('../../../../shared/services/calendar');
jest.mock('../../../../shared/utils/calendarStorage');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// The app's one sync (cause fix 18): the hook asks it for a run and hears when
// a run starts and ends, whoever started it.
const mockSyncListeners = new Set<(running: boolean) => void>();
jest.mock('../../../../shared/services/calendarSync', () => ({
  isCalendarSyncRunning: () => false,
  runCalendarSync: jest.fn().mockResolvedValue(null),
  runCalendarWork: jest.fn((work: () => Promise<unknown>) => work()),
  subscribeCalendarSync: (listener: (running: boolean) => void) => {
    mockSyncListeners.add(listener);
    return () => mockSyncListeners.delete(listener);
  },
}));
const syncRunning = async (running: boolean) => {
  await act(async () => {
    mockSyncListeners.forEach((listener) => listener(running));
  });
};

// Saved as the storage saves a patch: on top of what is stored.
beforeEach(() => {
  (calendarStorage.updateSyncSettings as jest.Mock).mockImplementation(async (patch: object) => ({
    ...(await (calendarStorage.getSyncSettings as jest.Mock)()),
    ...patch,
  }));
});

describe('useCalendarSync - Export (App → Calendar)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);
    (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
      exportEnabled: false,
      exportCalendarId: null,
      lastExportTime: null,
      importEnabled: false,
      importCalendarIds: [],
      importInterval: 'manual',
      lastImportTime: null,
    });
    (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(0);
    (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(0);
  });

  describe('Initialization', () => {
    it('should initialize with no permission', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      expect(result.current.calendars).toEqual([]);
      expect(result.current.syncedCount).toBe(0);
      expect(result.current.importedCount).toBe(0);
    });

    it('should initialize with permission and load calendars', async () => {
      const mockCalendars = [
        { id: 'cal-1', title: 'My Calendar', source: { name: 'Apple' } },
        { id: 'cal-2', title: 'Work Calendar', source: { name: 'Apple' } },
      ];

      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.getDeviceCalendars as jest.Mock).mockResolvedValue(mockCalendars);
      (calendar.getDefaultCalendar as jest.Mock).mockResolvedValue(mockCalendars[0]);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      expect(result.current.calendars).toEqual(mockCalendars);
      expect(result.current.settings.exportCalendarId).toBe('cal-1');
    });

    it('should load synced count from storage', async () => {
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(5);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.syncedCount).toBe(5);
      });
    });

    it('should load imported count from storage', async () => {
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(10);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.importedCount).toBe(10);
      });
    });
  });

  describe('Request Permissions', () => {
    it('should request and grant permissions', async () => {
      const mockCalendars = [
        { id: 'cal-1', title: 'My Calendar', source: { name: 'Apple' } },
      ];

      (calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.getDeviceCalendars as jest.Mock).mockResolvedValue(mockCalendars);
      (calendar.getDefaultCalendar as jest.Mock).mockResolvedValue(mockCalendars[0]);

      const { result } = renderHook(() => useCalendarSync());

      let granted = false;
      await act(async () => {
        granted = await result.current.requestPermissions();
      });

      expect(granted).toBe(true);
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.calendars).toEqual(mockCalendars);
      expect(result.current.settings.exportCalendarId).toBe('cal-1');
    });

    it('should handle denied permissions', async () => {
      (calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      let granted = true;
      await act(async () => {
        granted = await result.current.requestPermissions();
      });

      expect(granted).toBe(false);
      expect(result.current.hasPermission).toBe(false);
      expect(result.current.calendars).toEqual([]);
    });
  });

  describe('Update Settings', () => {
    it('should update settings and save to storage', async () => {

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await act(async () => {
        await result.current.updateSettings({
          exportEnabled: true,
          exportCalendarId: 'cal-123',
        });
      });

      expect(result.current.settings.exportEnabled).toBe(true);
      expect(result.current.settings.exportCalendarId).toBe('cal-123');
      // Only what was named: the rest is left as stored.
      expect(calendarStorage.updateSyncSettings).toHaveBeenCalledWith({
        exportEnabled: true,
        exportCalendarId: 'cal-123',
      });
    });

    it('leaves the settings shown as they were when the save fails', async () => {
      (calendarStorage.updateSyncSettings as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await act(async () => {
        await expect(result.current.updateSettings({ exportEnabled: true })).rejects.toThrow('Disk full');
      });

      expect(result.current.settings.exportEnabled).toBe(false);
    });
  });

  describe('Sync Rehearsal', () => {
    it('should sync single rehearsal', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: true,
        exportCalendarId: 'cal-123',
        lastExportTime: null,
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
        lastImportTime: null,
      });
      (calendar.syncRehearsalToCalendar as jest.Mock).mockResolvedValue('event-123');
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(1);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.exportCalendarId).toBe('cal-123');
      });

      const mockRehearsal = {
        id: '1',
        title: 'Band Practice',
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
        location: 'Studio A',
        projectName: 'My Band',
      };

      await act(async () => {
        await result.current.syncRehearsal(mockRehearsal as any);
      });

      expect(calendar.syncRehearsalToCalendar).toHaveBeenCalledWith(mockRehearsal, 'cal-123');
      expect(result.current.syncStatus).toBe('success');
      expect(result.current.syncedCount).toBe(1);
    });

    it('should throw error when no permission', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      const mockRehearsal = {
        id: '1',
        title: 'Band Practice',
      };

      await expect(
        act(async () => {
          await result.current.syncRehearsal(mockRehearsal as any);
        })
      ).rejects.toThrow('Calendar permission not granted');
    });

    it('should throw error when no calendar selected', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.getDeviceCalendars as jest.Mock).mockResolvedValue([]);
      (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: false,
        exportCalendarId: null,
        lastExportTime: null,
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
        lastImportTime: null,
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
        expect(result.current.settings.exportCalendarId).toBe(null);
      });

      const mockRehearsal = {
        id: '1',
        title: 'Band Practice',
      };

      await expect(
        act(async () => {
          await result.current.syncRehearsal(mockRehearsal as any);
        })
      ).rejects.toThrow('No calendar selected');
    });

    it('should handle sync errors', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: true,
        exportCalendarId: 'cal-123',
        lastExportTime: null,
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
        lastImportTime: null,
      });
      (calendar.syncRehearsalToCalendar as jest.Mock).mockRejectedValue(
        new Error('Calendar API error')
      );

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.exportCalendarId).toBe('cal-123');
      });

      const mockRehearsal = {
        id: '1',
        title: 'Band Practice',
      };

      let error: any;
      await act(async () => {
        try {
          await result.current.syncRehearsal(mockRehearsal as any);
        } catch (e) {
          error = e;
        }
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Calendar API error');
      expect(result.current.syncStatus).toBe('error');
      expect(result.current.syncError).toBe('Calendar API error');
    });
  });

  describe('Unsync Rehearsal', () => {
    it('should unsync (remove) rehearsal from calendar', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.unsyncRehearsal as jest.Mock).mockResolvedValue(undefined);
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(0);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.unsync('1');
      });

      expect(calendar.unsyncRehearsal).toHaveBeenCalledWith('1');
      expect(result.current.syncStatus).toBe('success');
      expect(result.current.syncedCount).toBe(0);
    });

    it('should throw error when no permission', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.unsync('1');
        })
      ).rejects.toThrow('Calendar permission not granted');
    });
  });

  describe('Synchronize', () => {
    // The hook has no sync of its own any more: "Synchronize" is the app's one
    // run (services/calendarSync.ts), the one a pull and the automatic sync
    // make. It used to run a copy here, with this render's settings (EO04).
    const exportSettings = {
      exportEnabled: true,
      exportCalendarId: 'cal-123',
      lastExportTime: null,
      importEnabled: false,
      importCalendarIds: [],
      importInterval: 'manual',
      lastImportTime: null,
    };

    it('asks the app\'s sync for a run, as a pull does', async () => {
      const run = { import: { status: 'off' }, export: { status: 'done', result: { success: 1, failed: 0, errors: [], rehearsals: 1 } } };
      (runCalendarSync as jest.Mock).mockResolvedValueOnce(run);

      const { result } = renderHook(() => useCalendarSync());

      let answer: unknown;
      await act(async () => {
        answer = await result.current.synchronize();
      });

      expect(runCalendarSync).toHaveBeenCalledWith('manual');
      expect(answer).toBe(run);
    });

    it('is busy from the first step of a run to its last, whoever started it', async () => {
      const { result } = renderHook(() => useCalendarSync());

      await syncRunning(true);
      expect(result.current.isSyncing).toBe(true);

      await syncRunning(false);
      expect(result.current.isSyncing).toBe(false);
    });

    // "Last export" is the sync's to stamp, and only for a run with no failure
    // (export.ts). The hook used to stamp it again after every run, so one in
    // which every write failed showed "synced just now" (EO06). It reads what
    // the run left once the run ends.
    it('shows the last export the sync recorded, once the run ends', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue(exportSettings);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.exportCalendarId).toBe('cal-123');
      });

      await syncRunning(true);
      (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
        ...exportSettings,
        lastExportTime: '2026-10-25T10:00:00.000Z',
      });
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(4);
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(3);
      await syncRunning(false);

      await waitFor(() => {
        expect(result.current.settings.lastExportTime).toBe('2026-10-25T10:00:00.000Z');
      });
      expect(result.current.syncedCount).toBe(4);
      expect(result.current.importedCount).toBe(3);
      expect(calendarStorage.updateSyncSettings).not.toHaveBeenCalled();
    });

    it('keeps the last known count when the new one cannot be read, rather than showing none', async () => {
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(7);

      const { result } = renderHook(() => useCalendarSync());
      await waitFor(() => {
        expect(result.current.importedCount).toBe(7);
      });

      (calendarStorage.getImportedEventsCount as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
      await syncRunning(true);
      await syncRunning(false);

      expect(result.current.importedCount).toBe(7);
    });
  });

  describe('Remove All Exported Events', () => {
    it('should remove all exported events', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.removeAllExportedEvents as jest.Mock).mockResolvedValue({
        succeeded: 5,
        failed: 0,
        total: 5,
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let batchResult: any;

      await act(async () => {
        batchResult = await result.current.removeAll();
      });

      expect(calendar.removeAllExportedEvents).toHaveBeenCalled();
      expect(batchResult.succeeded).toBe(5);
      expect(result.current.syncedCount).toBe(0);
    });

    it('should call progress callback', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.removeAllExportedEvents as jest.Mock).mockResolvedValue({
        succeeded: 3,
        failed: 0,
        total: 3,
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      const onProgress = jest.fn();

      await act(async () => {
        await result.current.removeAll(onProgress);
      });

      expect(calendar.removeAllExportedEvents).toHaveBeenCalledWith(onProgress);
    });

    it('counts what could not be removed as still exported, and says it failed', async () => {
      // Those events are still in the calendar and keep their mappings (EX02).
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
      (calendar.removeAllExportedEvents as jest.Mock).mockResolvedValue({
        success: 3,
        failed: 2,
        errors: ['Event e4: read-only', 'Event e5: read-only'],
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(2);
      await act(async () => {
        await result.current.removeAll();
      });

      expect(result.current.syncStatus).toBe('error');
      expect(result.current.syncedCount).toBe(2);
    });
  });

  describe('Check Sync Status', () => {
    it('should check if rehearsal is synced', async () => {
      (calendarStorage.isRehearsalSynced as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useCalendarSync());

      let synced = false;

      await act(async () => {
        synced = await result.current.isSynced('1');
      });

      expect(synced).toBe(true);
      expect(calendarStorage.isRehearsalSynced).toHaveBeenCalledWith('1');
    });

    it('should return false when check fails', async () => {
      (calendarStorage.isRehearsalSynced as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useCalendarSync());

      let synced = true;

      await act(async () => {
        synced = await result.current.isSynced('1');
      });

      expect(synced).toBe(false);
    });
  });
});

describe('useCalendarSync - Import (Calendar → App)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (calendarStorage.getSyncSettings as jest.Mock).mockResolvedValue({
      exportEnabled: false,
      exportCalendarId: null,
      lastExportTime: null,
      importEnabled: true,
      importCalendarIds: ['cal-1', 'cal-2'],
      importInterval: 'manual',
      lastImportTime: null,
    });
    (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(0);
    (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(0);
  });

  // The import now runs only as a direction of the app's one sync — see
  // "Synchronize" above, and services/calendarSync.ts.

  describe('Clear Imported', () => {
    it('should remove all imported availability slots', async () => {
      (calendar.removeAllImportedSlots as jest.Mock).mockResolvedValue({
        succeeded: 15,
        failed: 0,
        total: 15,
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let clearResult: any;

      await act(async () => {
        clearResult = await result.current.clearImported();
      });

      expect(calendar.removeAllImportedSlots).toHaveBeenCalled();
      expect(clearResult.succeeded).toBe(15);
      expect(result.current.importedCount).toBe(0);
      expect(result.current.isImporting).toBe(false);
    });

    it('should call progress callback during clear', async () => {
      (calendar.removeAllImportedSlots as jest.Mock).mockResolvedValue({
        succeeded: 10,
        failed: 0,
        total: 10,
      });

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      const onProgress = jest.fn();

      await act(async () => {
        await result.current.clearImported(onProgress);
      });

      expect(calendar.removeAllImportedSlots).toHaveBeenCalledWith(onProgress);
    });

    it('should throw error when no permission', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.clearImported();
        })
      ).rejects.toThrow('Calendar permission not granted');
    });

    it('should handle clear errors', async () => {
      (calendar.removeAllImportedSlots as jest.Mock).mockRejectedValue(
        new Error('Clear failed')
      );

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let error: any;
      await act(async () => {
        try {
          await result.current.clearImported();
        } catch (e) {
          error = e;
        }
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Clear failed');
      expect(result.current.isImporting).toBe(false);
      expect(result.current.importError).toBe('Clear failed');
    });
  });
});
