/**
 * Export mappings are this device's own (R7: ES02).
 *
 * The server keeps a mapping per connection — one calendar of one device — so a
 * rehearsal exported from two phones has two. They were folded into one per
 * rehearsal with the oldest winning, and the export then worked with an event
 * id from the other phone, which means nothing here: it recreated the event,
 * or, by coincidence, named another event on this phone. And deletes reached
 * every phone's mappings. Calendar ids are the device's own, so a device's
 * mappings are the ones recorded under the calendars it has.
 */
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllMappings, getEventMapping, removeEventMapping, clearAllMappings } from '../calendarMappings';
import { calendarSyncAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  calendarSyncAPI: {
    getMappings: jest.fn(),
    deleteMappingByEvent: jest.fn(),
    deleteMappings: jest.fn(),
  },
}));

const row = (rehearsal: number, calendar: string, event: string, at: string) => ({
  internal_event_id: rehearsal, device_calendar_id: calendar, external_event_id: event, last_sync_at: at,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('calendar-export-mappings');
  // This phone has two calendars; "phone-B" is a calendar of another phone.
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([{ id: 'home' }, { id: 'work' }]);
  (calendarSyncAPI.getMappings as jest.Mock).mockResolvedValue({ data: { mappings: [
    // Newest first, as the server orders them.
    row(42, 'phone-B', 'b-event-42', '2026-09-25T10:00:00.000Z'),
    row(42, 'work', 'work-event-42', '2026-09-24T10:00:00.000Z'),
    row(42, 'home', 'home-event-42', '2026-09-01T10:00:00.000Z'),
    row(7, 'phone-B', 'b-event-7', '2026-09-20T10:00:00.000Z'),
  ] } });
  (calendarSyncAPI.deleteMappingByEvent as jest.Mock).mockResolvedValue({ data: { success: true } });
  (calendarSyncAPI.deleteMappings as jest.Mock).mockResolvedValue({ data: { success: true, deletedCount: 2 } });
});

describe('Reading the mappings', () => {
  it('takes this phone\'s newest mapping of a rehearsal, never another phone\'s', async () => {
    const all = await getAllMappings();

    expect(all['42']).toMatchObject({ eventId: 'work-event-42', calendarId: 'work' });
    expect(all['7']).toBeUndefined();
  });

  it('picks the newest by when it was synced, not by where the server listed it', async () => {
    (calendarSyncAPI.getMappings as jest.Mock).mockResolvedValue({ data: { mappings: [
      row(42, 'home', 'home-event-42', '2026-09-01T10:00:00.000Z'),
      row(42, 'work', 'work-event-42', '2026-09-24T10:00:00.000Z'),
    ] } });

    expect((await getAllMappings())['42'].eventId).toBe('work-event-42');
  });

  it('answers for one rehearsal the same way', async () => {
    expect(await getEventMapping('42')).toMatchObject({ eventId: 'work-event-42' });
    expect(await getEventMapping('7')).toBeNull();
  });
});

describe('Deleting the mappings', () => {
  it('unsyncing one rehearsal names this phone\'s calendars, so the other phone keeps its own', async () => {
    await removeEventMapping('42');

    expect(calendarSyncAPI.deleteMappingByEvent).toHaveBeenCalledWith('rehearsal', '42', ['home', 'work']);
  });

  it('removing everything exported does so for this phone\'s calendars, in one request', async () => {
    await clearAllMappings();

    expect(calendarSyncAPI.deleteMappings).toHaveBeenCalledTimes(1);
    expect(calendarSyncAPI.deleteMappings).toHaveBeenCalledWith('rehearsal', ['home', 'work']);
  });
});
