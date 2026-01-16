/**
 * Tests for useCalendarSync Hook
 * Tests calendar export and import functionality
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCalendarSync } from '../useCalendarSync';
import * as calendar from '../../../../shared/services/calendar';
import * as calendarStorage from '../../../../shared/utils/calendarStorage';

// Mock dependencies
jest.mock('../../../../shared/services/calendar');
jest.mock('../../../../shared/utils/calendarStorage');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

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
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

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
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

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
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

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
      expect(calendarStorage.saveSyncSettings).toHaveBeenCalled();
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
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

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

  describe('Sync All Rehearsals', () => {
    it('should sync all rehearsals with progress callback', async () => {
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
      (calendar.syncAllRehearsals as jest.Mock).mockResolvedValue({
        succeeded: 2,
        failed: 0,
        total: 2,
      });
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(2);
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.exportCalendarId).toBe('cal-123');
      });

      const mockRehearsals = [
        { id: '1', title: 'Rehearsal 1' },
        { id: '2', title: 'Rehearsal 2' },
      ];

      const onProgress = jest.fn();
      let batchResult: any;

      await act(async () => {
        batchResult = await result.current.syncAll(mockRehearsals as any, onProgress);
      });

      expect(calendar.syncAllRehearsals).toHaveBeenCalledWith(
        mockRehearsals,
        'cal-123',
        onProgress
      );
      expect(batchResult.succeeded).toBe(2);
      expect(result.current.syncStatus).toBe('success');
      expect(result.current.syncedCount).toBe(2);
    });

    it('should update last export time after sync all', async () => {
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
      (calendar.syncAllRehearsals as jest.Mock).mockResolvedValue({
        succeeded: 1,
        failed: 0,
        total: 1,
      });
      (calendarStorage.getSyncedRehearsalsCount as jest.Mock).mockResolvedValue(1);
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.exportCalendarId).toBe('cal-123');
      });

      const mockRehearsals = [{ id: '1', title: 'Rehearsal 1' }];

      await act(async () => {
        await result.current.syncAll(mockRehearsals as any);
      });

      expect(calendarStorage.saveSyncSettings).toHaveBeenCalled();
      expect(result.current.settings.lastExportTime).toBeTruthy();
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

  describe('Import Now', () => {
    it('should import calendar events as availability', async () => {
      (calendar.importCalendarEventsToAvailability as jest.Mock).mockResolvedValue({
        succeeded: 10,
        failed: 0,
        total: 10,
      });
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(10);
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.importEnabled).toBe(true);
      });

      let importResult: any;

      await act(async () => {
        importResult = await result.current.importNow();
      });

      expect(calendar.importCalendarEventsToAvailability).toHaveBeenCalledWith(
        ['cal-1', 'cal-2'],
        undefined
      );
      expect(importResult.succeeded).toBe(10);
      expect(result.current.importedCount).toBe(10);
      expect(result.current.isImporting).toBe(false);
    });

    it('should call progress callback during import', async () => {
      (calendar.importCalendarEventsToAvailability as jest.Mock).mockResolvedValue({
        succeeded: 5,
        failed: 0,
        total: 5,
      });
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(5);
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.importEnabled).toBe(true);
      });

      const onProgress = jest.fn();

      await act(async () => {
        await result.current.importNow(onProgress);
      });

      expect(calendar.importCalendarEventsToAvailability).toHaveBeenCalledWith(
        ['cal-1', 'cal-2'],
        onProgress
      );
    });

    it('should update last import time after import', async () => {
      (calendar.importCalendarEventsToAvailability as jest.Mock).mockResolvedValue({
        succeeded: 3,
        failed: 0,
        total: 3,
      });
      (calendarStorage.getImportedEventsCount as jest.Mock).mockResolvedValue(3);
      (calendarStorage.saveSyncSettings as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.importEnabled).toBe(true);
      });

      await act(async () => {
        await result.current.importNow();
      });

      expect(calendarStorage.saveSyncSettings).toHaveBeenCalled();
      expect(result.current.settings.lastImportTime).toBeTruthy();
    });

    it('should throw error when no permission', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.importNow();
        })
      ).rejects.toThrow('Calendar permission not granted');
    });

    it('should throw error when import not enabled', async () => {
      (calendar.checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
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
        expect(result.current.settings.importEnabled).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.importNow();
        })
      ).rejects.toThrow('Import not enabled or no calendars selected');
    });

    it('should handle import errors', async () => {
      (calendar.importCalendarEventsToAvailability as jest.Mock).mockRejectedValue(
        new Error('Import failed')
      );

      const { result } = renderHook(() => useCalendarSync());

      await waitFor(() => {
        expect(result.current.settings.importEnabled).toBe(true);
      });

      let error: any;
      await act(async () => {
        try {
          await result.current.importNow();
        } catch (e) {
          error = e;
        }
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Import failed');
      expect(result.current.isImporting).toBe(false);
      expect(result.current.importError).toBe('Import failed');
    });
  });

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
