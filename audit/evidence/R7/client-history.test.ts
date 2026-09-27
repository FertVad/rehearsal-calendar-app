/**
 * R7, app half: each defect of cause fix 4 as the app showed it, runnable
 * against any snapshot of the app (review R7-03).
 *
 * Copied into a snapshot as src/__tests__/r7History.test.ts by
 * client-history.mjs. Every boundary the old and the new code call has a
 * working stub — the old diff's getAll, bulkSet and batch routes, the old
 * by-event lookup and per-id delete, the new sync and scoped deletes — so a
 * test fails on what the code did, never on a missing mock. Storage is the
 * real module over the AsyncStorage mock. Tests are named by the defect they
 * reproduce; contract tests of the new shape live in the app and are not
 * repeated here.
 */
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { importCalendarEventsToAvailability, removeAllImportedSlots } from '../shared/services/calendar/import';
import { getImportedEventsCount } from '../shared/utils/calendarStorage';
import {
  getAllMappings,
  getEventMapping,
  removeEventMapping,
  clearAllMappings,
  saveEventMapping,
  resetConnectionCache,
} from '../shared/utils/calendarMappings';
import { availabilityAPI, calendarSyncAPI } from '../shared/services/api';

jest.mock('../shared/services/calendar/permissions', () => ({ checkCalendarPermissions: jest.fn(async () => true) }));
jest.mock('../shared/services/api', () => ({
  availabilityAPI: {
    getAll: jest.fn(), bulkSet: jest.fn(), batchDeleteImported: jest.fn(), batchUpdateImported: jest.fn(),
    deleteAllImported: jest.fn(), syncImported: jest.fn(),
  },
  calendarSyncAPI: {
    getMappings: jest.fn(), getMappingByEvent: jest.fn(), getConnections: jest.fn(), createOrUpdateConnection: jest.fn(),
    createOrUpdateMapping: jest.fn(), deleteMapping: jest.fn(), deleteMappingByEvent: jest.fn(), deleteMappings: jest.fn(),
  },
}));

const availability = availabilityAPI as unknown as Record<string, jest.Mock>;
const sync = calendarSyncAPI as unknown as Record<string, jest.Mock>;
const calendar = Calendar as unknown as Record<string, jest.Mock>;

const day = (daysFromToday: number, time: string) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.toISOString().split('T')[0]}T${time}Z`;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const event = (id: string, calendarId: string, extra: Record<string, unknown> = {}) => ({
  id, calendarId, startDate: day(5, '09:00:00.000'), endDate: day(5, '10:00:00.000'), allDay: false, ...extra,
});
const imported = (key: string, startsAt = day(5, '09:00:00.000'), endsAt = day(5, '10:00:00.000')) => ({
  id: key, source: 'apple_calendar', external_event_id: key, externalEventId: key, startsAt, endsAt, isAllDay: false,
});
const deletedByApp = () => availability.batchDeleteImported.mock.calls.flatMap(([ids]) => ids);
const row = (id: number, calendarId: string, eventId: string, at: string) => ({
  id, internal_event_id: 42, device_calendar_id: calendarId, external_event_id: eventId, last_sync_at: at,
});
const local = async () => JSON.parse((await AsyncStorage.getItem('calendar-export-mappings')) || '{}');

beforeEach(async () => {
  jest.clearAllMocks();
  resetConnectionCache();
  await AsyncStorage.clear();
  calendar.getCalendarsAsync.mockResolvedValue([{ id: 'home' }, { id: 'work' }]);
  calendar.getEventsAsync.mockImplementation(async ([id]: string[]) => (id === 'work' ? [event('w1', 'work')] : []));
  availability.getAll.mockResolvedValue({ data: [] });
  availability.bulkSet.mockResolvedValue({ data: { success: true } });
  availability.batchDeleteImported.mockResolvedValue({ data: { success: true } });
  availability.batchUpdateImported.mockResolvedValue({ data: { success: true } });
  availability.deleteAllImported.mockResolvedValue({ data: { success: true, deletedCount: 7 } });
  availability.syncImported.mockResolvedValue({ data: { success: true, added: 1, updated: 0, removed: 0, adopted: 0, unchanged: 0, held: 1 } });
  sync.getMappings.mockResolvedValue({ data: { mappings: [] } });
  sync.getMappingByEvent.mockResolvedValue({ data: { mapping: null } });
  sync.getConnections.mockResolvedValue({ data: { connections: [{ id: 5, device_calendar_id: 'work' }] } });
  sync.createOrUpdateMapping.mockResolvedValue({ data: {} });
  sync.deleteMapping.mockResolvedValue({ data: { success: true } });
  sync.deleteMappingByEvent.mockResolvedValue({ data: { success: true } });
  sync.deleteMappings.mockResolvedValue({ data: { success: true, deletedCount: 1 } });
});

describe('Import', () => {
  it('EI01: a sync on this phone does not delete what another phone imported', async () => {
    availability.getAll.mockResolvedValue({ data: [imported('B-e9')] });

    await importCalendarEventsToAvailability(['work']);

    expect(deletedByApp()).not.toContain('B-e9');
  });

  it('EI04: moving an occurrence does not delete the old time on its own, where the new one can fail to arrive', async () => {
    availability.getAll.mockResolvedValue({ data: [imported(`series:${day(5, '09:00:00.000')}`)] });
    calendar.getEventsAsync.mockResolvedValue([event('series', 'work', {
      recurrenceRule: { frequency: 'weekly' }, startDate: day(6, '09:00:00.000'), endDate: day(6, '10:00:00.000'),
    })]);
    availability.bulkSet.mockRejectedValue(new Error('offline'));
    availability.syncImported.mockRejectedValue(new Error('offline'));

    await importCalendarEventsToAvailability(['work']).catch(() => undefined);

    expect(deletedByApp()).toEqual([]);
  });

  it('EI02: a sync with a calendar it could not read is not stamped as done', async () => {
    calendar.getEventsAsync.mockImplementation(async ([id]: string[]) => {
      if (id === 'home') throw new Error('account needs sign-in');
      return [event('w1', 'work')];
    });

    await importCalendarEventsToAvailability(['work', 'home']);

    const settings = JSON.parse((await AsyncStorage.getItem('calendar-sync-settings')) || '{}');
    expect(settings.lastImportTime ?? null).toBeNull();
  });

  it('R7-02: the window names the local dates it read', async () => {
    await importCalendarEventsToAvailability(['work']);

    const window = availability.syncImported.mock.calls[0]?.[0]?.window;
    expect(window?.firstDate).toBe(ymd(new Date()));
    expect(window?.lastDate).toBe(window && ymd(new Date(Date.parse(window.to) - 1)));
  });

  it('EI03: "remove all imported" asks the server when this phone holds no record of its imports', async () => {
    const result = await removeAllImportedSlots();

    expect(availability.deleteAllImported).toHaveBeenCalled();
    expect(result.success).toBe(7);
  });

  it('CLAUDE.md 10: an imported count that cannot be read is an error, not none', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(getImportedEventsCount()).rejects.toThrow('storage unavailable');
  });
});

describe('Export mappings', () => {
  it('ES02: all mappings — this phone\'s, not the oldest of every phone\'s', async () => {
    sync.getMappings.mockResolvedValue({ data: { mappings: [
      row(1, 'work', 'work-event-42', '2026-09-24T10:00:00.000Z'),
      row(2, 'phone-B', 'b-event-42', '2026-09-01T10:00:00.000Z'),
    ] } });

    expect((await getAllMappings())['42']?.eventId).toBe('work-event-42');
  });

  it('ES02: one mapping — this phone\'s, not whichever the server hands back', async () => {
    sync.getMappings.mockResolvedValue({ data: { mappings: [
      row(1, 'work', 'work-event-42', '2026-09-24T10:00:00.000Z'),
      row(2, 'phone-B', 'b-event-42', '2026-09-01T10:00:00.000Z'),
    ] } });
    sync.getMappingByEvent.mockResolvedValue({ data: { mapping: row(2, 'phone-B', 'b-event-42', '2026-09-01T10:00:00.000Z') } });

    expect((await getEventMapping('42'))?.eventId).toBe('work-event-42');
  });

  it('ES02: unsyncing on this phone names its calendars, so the server leaves another phone\'s mapping', async () => {
    await removeEventMapping('42');

    expect(sync.deleteMappingByEvent).toHaveBeenCalledWith('rehearsal', '42', ['home', 'work']);
  });

  it('ES02: "remove all exported" does not delete another phone\'s mappings', async () => {
    sync.getMappings.mockResolvedValue({ data: { mappings: [
      row(1, 'work', 'work-event-42', '2026-09-24T10:00:00.000Z'),
      row(2, 'phone-B', 'b-event-42', '2026-09-01T10:00:00.000Z'),
    ] } });

    await clearAllMappings();

    expect(sync.deleteMapping).not.toHaveBeenCalledWith(2);
  });

  describe('R7-01: a mapping saved while the server could not take it', () => {
    const lastYear = row(3, 'home', 'old-home-event', '2025-01-01T00:00:00.000Z');

    beforeEach(async () => {
      sync.getMappings.mockResolvedValue({ data: { mappings: [lastYear] } });
      sync.getMappingByEvent.mockResolvedValue({ data: { mapping: lastYear } });
    });

    it('wins in the list over the older one the server still holds', async () => {
      sync.createOrUpdateMapping.mockRejectedValue(new Error('offline'));
      await saveEventMapping('42', 'new-work-event', 'work');

      expect((await getAllMappings())['42']?.eventId).toBe('new-work-event');
    });

    it('wins for one rehearsal, and reading does not overwrite it with the older one', async () => {
      sync.createOrUpdateMapping.mockRejectedValue(new Error('offline'));
      await saveEventMapping('42', 'new-work-event', 'work');

      expect((await getEventMapping('42'))?.eventId).toBe('new-work-event');
      expect((await local())['42']?.eventId).toBe('new-work-event');
    });

    it('a server mapping copied here keeps the time it was written, not the time it was read', async () => {
      await AsyncStorage.setItem('calendar-export-mappings', JSON.stringify({
        '42': { eventId: 'older-local-event', calendarId: 'home', lastSynced: '2024-06-01T00:00:00.000Z' },
      }));

      await getEventMapping('42');

      expect((await local())['42']?.lastSynced).toBe('2025-01-01T00:00:00.000Z');
    });
  });
});
