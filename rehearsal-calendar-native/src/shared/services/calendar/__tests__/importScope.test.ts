/**
 * What the calendar import sends, and what it leaves to the server
 * (R7: EI01, EI02, EI03, EI04).
 *
 * The import used to diff this phone's events against every imported row of the
 * person — from every device — and delete what this phone did not have: a sync
 * on the second phone wiped what the first had imported (EI01), and a moved
 * occurrence went out as a separate delete and add (EI04). The phone now names
 * its calendars and sends what it read; the server reconciles within them, in
 * one transaction (server/services/availability/importScope.js).
 *
 * The promise stays: only hours cross over. A calendar's id is an opaque
 * identifier the server now needs as the scope of its rows; titles, notes,
 * places and links never leave the phone.
 */
import * as Calendar from 'expo-calendar';
import { importCalendarEventsToAvailability, removeAllImportedSlots } from '../import';
import { availabilityAPI } from '../../api';
import { getAllMappings } from '../../../utils/calendarMappings';
import { checkCalendarPermissions } from '../permissions';
import { updateLastImportTime, setImportedEventsCount } from '../../../utils/calendarStorage';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({ getAllMappings: jest.fn() }));
jest.mock('../../../utils/calendarStorage', () => ({
  updateLastImportTime: jest.fn(),
  setImportedEventsCount: jest.fn(),
  clearAllImportedEvents: jest.fn(),
}));
jest.mock('../../api', () => ({
  availabilityAPI: {
    syncImported: jest.fn(),
    deleteAllImported: jest.fn(),
    getAll: jest.fn(),
    bulkSet: jest.fn(),
  },
}));

const day = (daysFromToday: number, time: string) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.toISOString().split('T')[0]}T${time}Z`;
};
const event = (id: string, calendarId: string, extra: Record<string, unknown> = {}) => ({
  id, calendarId, startDate: day(5, '09:00:00.000'), endDate: day(5, '10:00:00.000'), allDay: false, ...extra,
});
const sent = () => (availabilityAPI.syncImported as jest.Mock).mock.calls[0]?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (getAllMappings as jest.Mock).mockResolvedValue({});
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([{ id: 'work' }, { id: 'home' }, { id: 'old' }]);
  (Calendar.getEventsAsync as jest.Mock).mockImplementation(async ([calendarId]: string[]) =>
    (calendarId === 'work' ? [event('w1', 'work')] : calendarId === 'home' ? [event('h1', 'home')] : []));
  (availabilityAPI.syncImported as jest.Mock).mockResolvedValue({
    data: { success: true, added: 2, updated: 0, removed: 0, adopted: 0, unchanged: 0, held: 2 },
  });
});

describe('What a sync sends', () => {
  it('each calendar it read, by id, with the events it holds — and every calendar on the device', async () => {
    await importCalendarEventsToAvailability(['work', 'home']);

    expect(sent()).toMatchObject({
      source: expect.stringMatching(/^(apple|google)_calendar$/),
      deviceCalendars: expect.arrayContaining(['work', 'home', 'old']),
      unreadable: [],
      calendars: [
        { calendarId: 'work', events: [{ key: 'w1', startsAt: day(5, '09:00:00.000'), endsAt: day(5, '10:00:00.000'), isAllDay: false }] },
        { calendarId: 'home', events: [expect.objectContaining({ key: 'h1' })] },
      ],
    });
  });

  it('diffs and deletes nothing itself: that is the server\'s, within this device\'s calendars (EI01, EI04)', async () => {
    await importCalendarEventsToAvailability(['work']);

    expect(availabilityAPI.getAll).not.toHaveBeenCalled();
    expect(availabilityAPI.bulkSet).not.toHaveBeenCalled();
  });

  it('sends the hours and nothing that says what the events are', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([event('w1', 'work', {
      title: 'Dentist', notes: 'Bring the letter', location: 'Main Street 5', url: 'https://example.invalid/private',
    })]);

    await importCalendarEventsToAvailability(['work']);

    const payload = JSON.stringify(sent());
    for (const secret of ['Dentist', 'Bring the letter', 'Main Street 5', 'example.invalid']) {
      expect(payload).not.toContain(secret);
    }
  });

  it('leaves our own rehearsals out, even when the stored id means nothing here', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      event('ours', 'work', { url: 'rehearsalapp://rehearsal/42' }), event('theirs', 'work'),
    ]);

    await importCalendarEventsToAvailability(['work']);

    expect(sent().calendars[0].events.map((e: { key: string }) => e.key)).toEqual(['theirs']);
  });

  it('keys each occurrence of a recurring event by when it starts', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([event('series', 'work', { recurrenceRule: { frequency: 'weekly' } })]);

    await importCalendarEventsToAvailability(['work']);

    expect(sent().calendars[0].events[0].key).toBe(`series:${day(5, '09:00:00.000')}`);
  });
});

describe('A calendar that could not be read (EI02)', () => {
  it('is named unreadable, so the server keeps its rows, and the sync is not called a success', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockImplementation(async ([calendarId]: string[]) => {
      if (calendarId === 'home') throw new Error('account needs sign-in');
      return [event('w1', 'work')];
    });

    const result = await importCalendarEventsToAvailability(['work', 'home']);

    expect(sent()).toMatchObject({ unreadable: ['home'], calendars: [{ calendarId: 'work' }] });
    expect(result.failed).toBeGreaterThan(0);
    expect(updateLastImportTime).not.toHaveBeenCalled();
  });

  it('stamps the sync when every calendar was read', async () => {
    await importCalendarEventsToAvailability(['work', 'home']);

    expect(updateLastImportTime).toHaveBeenCalled();
    expect(setImportedEventsCount).toHaveBeenCalledWith(2);
  });
});

describe('Removing everything imported (EI03)', () => {
  it('asks the server even when this phone holds no record of what it imported', async () => {
    (availabilityAPI.deleteAllImported as jest.Mock).mockResolvedValue({ data: { success: true, deletedCount: 7 } });

    const result = await removeAllImportedSlots();

    expect(availabilityAPI.deleteAllImported).toHaveBeenCalled();
    expect(result.success).toBe(7);
  });
});
