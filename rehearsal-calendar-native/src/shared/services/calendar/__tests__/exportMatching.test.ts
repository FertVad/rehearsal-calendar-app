/**
 * Finding the event that already stands for a rehearsal.
 *
 * A user's calendars are the same on all their devices — iCloud carries the
 * events across. But the same event has a different local id on each device, so
 * the second one cannot look up "the event for rehearsal 42": its mapping holds
 * an id that means nothing there. It had to guess from the contents, and the
 * contents identified nothing — every rehearsal of a project was written with
 * the same title and the same notes. Two rehearsals starting in the same minute
 * were indistinguishable, and one without a location matched nothing at all,
 * not even itself, so the second device made its own copy and iCloud carried it
 * back. Two identical entries on both devices, each with its own alarm.
 *
 * The event now carries the rehearsal it belongs to, in the URL — not the
 * notes, which the reader sees, because an identifier is not theirs to look at.
 */
import * as Calendar from 'expo-calendar';
import { createCalendarEvent } from '../export';
import { checkCalendarPermissions } from '../permissions';
import { saveEventMapping } from '../../../utils/calendarMappings';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  getEventMapping: jest.fn().mockResolvedValue(null),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
}));

const rehearsal = (over: Record<string, unknown> = {}) => ({
  id: '42',
  projectId: 'p1',
  projectName: 'Гамлет',
  startsAt: '2026-10-01T17:00:00.000Z',
  endsAt: '2026-10-01T19:00:00.000Z',
  ...over,
}) as any;

/** An event already in the calendar, as iCloud would have delivered it. */
const existing = (over: Record<string, unknown> = {}) => ({
  id: 'other-device-event',
  title: 'Rehearsal: Гамлет',
  startDate: '2026-10-01T17:00:00.000Z',
  endDate: '2026-10-01T19:00:00.000Z',
  location: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
});

describe('An event iCloud already delivered', () => {
  it('is adopted when it names the rehearsal, whatever else differs', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      existing({ url: 'rehearsalapp://rehearsal/42', title: 'renamed by the reader', location: 'Foyer' }),
    ]);

    const id = await createCalendarEvent(rehearsal(), 'cal-1');

    expect(id).toBe('other-device-event');
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it('is not adopted when it names a different rehearsal at the same moment', async () => {
    // Two rehearsals of one project in the same minute used to be one event.
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      existing({ url: 'rehearsalapp://rehearsal/99' }),
    ]);

    await createCalendarEvent(rehearsal(), 'cal-1');

    expect(Calendar.createEventAsync).toHaveBeenCalled();
  });

  it('is still adopted when it predates the mark, by its contents', async () => {
    // Events written before this have no URL. They must keep working.
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([existing()]);

    const id = await createCalendarEvent(rehearsal(), 'cal-1');

    expect(id).toBe('other-device-event');
  });

  it('is adopted with no location, whichever empty the platform reports', async () => {
    // The comparison read `event.location === (rehearsal.location || undefined)`,
    // so null or '' from iOS matched nothing and a second copy was made.
    for (const platformEmpty of [null, '', undefined, '   ']) {
      jest.clearAllMocks();
      (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
      (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
        existing({ location: platformEmpty }),
      ]);

      await createCalendarEvent(rehearsal({ location: null }), 'cal-1');

      expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    }
  });
});

describe('What a new event carries', () => {
  it('records which rehearsal it is, out of the reader\'s way', async () => {
    await createCalendarEvent(rehearsal(), 'cal-1');

    const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
    expect(details.url).toBe('rehearsalapp://rehearsal/42');
    expect(details.notes).not.toContain('42');
  });

  it('is called by the rehearsal\'s own name when it has one', async () => {
    await createCalendarEvent(rehearsal({ title: 'Прогон второго акта' }), 'cal-1');

    const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
    expect(details.title).toBe('Прогон второго акта');
  });

  it('falls back to the project when the rehearsal is unnamed', async () => {
    // Most are. A blank name is the same as none.
    for (const name of [undefined, '', '  ']) {
      jest.clearAllMocks();
      (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');

      await createCalendarEvent(rehearsal({ title: name }), 'cal-1');

      const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
      expect(details.title).toBe('Rehearsal: Гамлет');
    }
  });

  it('is recorded against the rehearsal for this device', async () => {
    await createCalendarEvent(rehearsal(), 'cal-1');

    expect(saveEventMapping).toHaveBeenCalledWith('42', 'new-event', 'cal-1');
  });
});
