/**
 * A sync says what happened (cause fix 17).
 *
 * A read tells "there", "not there" and "could not ask" apart; a mapping goes
 * only once its event is confirmed gone; "last export" is stamped only by a
 * run with no failure. Each of these used to collapse into success: a read
 * error was "deleted", a failed update became the adoption of the old event,
 * a failed removal lost its mapping anyway, and the stamp was written
 * whatever came back.
 */
import * as Calendar from 'expo-calendar';
import { removeAllExportedEvents, syncAllRehearsals, syncRehearsalToCalendar } from '../export';
import { checkCalendarPermissions } from '../permissions';
import {
  getAllMappings,
  getEventMapping,
  removeEventMapping,
  saveEventMapping,
} from '../../../utils/calendarMappings';
import { updateLastExportTime } from '../../../utils/calendarStorage';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({
  getEventMapping: jest.fn(),
  getAllMappings: jest.fn(),
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
  clearAllMappings: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/calendarStorage', () => ({
  updateLastExportTime: jest.fn().mockResolvedValue(undefined),
}));

const rehearsal = {
  id: '1',
  projectId: 'p',
  projectName: 'Гамлет',
  startsAt: '2026-10-01T17:00:00.000Z',
  endsAt: '2026-10-01T19:00:00.000Z',
} as any;

/** What iOS raises for an id it has no event for (EventNotFoundException). */
const notFound = () =>
  Object.assign(new Error('Event with id e1 could not be found'), { code: 'ERR_EVENT_NOT_FOUND' });

beforeEach(() => {
  jest.clearAllMocks();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'e1', calendarId: 'cal-1' });
  (Calendar.getEventAsync as jest.Mock).mockResolvedValue({ id: 'e1', title: 'stale' });
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  (Calendar.updateEventAsync as jest.Mock).mockResolvedValue(undefined);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
  (Calendar.deleteEventAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('Reading an event (EX04)', () => {
  it('a lookup that failed is not "the reader deleted it"', async () => {
    // Permission granted, then the native read fails — the calendar busy, an
    // account re-authorising. The mapping and the event are both still good.
    (Calendar.getEventAsync as jest.Mock).mockRejectedValue(new Error('EKErrorDomain error 1'));

    const result = await syncAllRehearsals([rehearsal], 'cal-1');

    expect(removeEventMapping).not.toHaveBeenCalled();
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('the calendar\'s own "no such event" still recreates it', async () => {
    (Calendar.getEventAsync as jest.Mock).mockRejectedValue(notFound());

    const result = await syncAllRehearsals([rehearsal], 'cal-1');

    expect(Calendar.createEventAsync).toHaveBeenCalled();
    expect(result.failed).toBe(0);
  });

  it('a search that could not read the calendar creates no second copy', async () => {
    // No mapping on this device; the search for the copy another device made
    // fails. "Found nothing" would be a guess, and a duplicate the result.
    (getEventMapping as jest.Mock).mockResolvedValue(null);
    (Calendar.getEventsAsync as jest.Mock).mockRejectedValue(new Error('EKErrorDomain error 1'));

    const result = await syncAllRehearsals([rehearsal], 'cal-1');

    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });
});

describe('An update that failed (EX03)', () => {
  beforeEach(() => {
    (Calendar.updateEventAsync as jest.Mock).mockRejectedValue(new Error('Calendar is read-only'));
    // What the recovery search used to find: the same event, still stale.
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      { id: 'e1', title: 'stale', url: 'rehearsalapp://rehearsal/1', startDate: rehearsal.startsAt, endDate: rehearsal.endsAt },
    ]);
  });

  it('is counted as failed, not as the old event exported', async () => {
    const result = await syncAllRehearsals([rehearsal], 'cal-1');

    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('keeps the mapping it has', async () => {
    await syncAllRehearsals([rehearsal], 'cal-1');

    expect(removeEventMapping).not.toHaveBeenCalled();
  });
});

describe('Adopting an event of ours that another device wrote', () => {
  it('brings it up to date rather than taking it as it is', async () => {
    (getEventMapping as jest.Mock).mockResolvedValue(null);
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      {
        id: 'cloud-event',
        title: 'Rehearsal: Гамлет',
        url: 'rehearsalapp://rehearsal/1',
        startDate: '2026-10-01T15:00:00.000Z',
        endDate: '2026-10-01T17:00:00.000Z',
      },
    ]);

    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    const [eventId, details] = (Calendar.updateEventAsync as jest.Mock).mock.calls[0];
    expect(eventId).toBe('cloud-event');
    expect(new Date(details.startDate).toISOString()).toBe(rehearsal.startsAt);
    expect(saveEventMapping).toHaveBeenCalledWith('1', 'cloud-event', 'cal-1', expect.any(Number));
  });
});

describe('Moving to another calendar when the old copy cannot be removed (EX02)', () => {
  beforeEach(() => {
    (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'old-event', calendarId: 'personal' });
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue({ id: 'old-event' });
    (Calendar.deleteEventAsync as jest.Mock).mockRejectedValue(new Error('Calendar is read-only'));
  });

  it('fails, rather than reporting the move done', async () => {
    await expect(syncRehearsalToCalendar(rehearsal, 'work')).rejects.toThrow('read-only');
  });

  it('leaves the mapping on the old copy, so the next run can still remove it', async () => {
    await syncRehearsalToCalendar(rehearsal, 'work').catch(() => {});

    expect(saveEventMapping).not.toHaveBeenCalled();
    expect(removeEventMapping).not.toHaveBeenCalled();
  });

  it('the next run adopts the copy it made instead of making another', async () => {
    await syncRehearsalToCalendar(rehearsal, 'work').catch(() => {});
    (Calendar.deleteEventAsync as jest.Mock).mockResolvedValue(undefined);
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      { id: 'new-event', url: 'rehearsalapp://rehearsal/1', title: 'Rehearsal: Гамлет', startDate: rehearsal.startsAt, endDate: rehearsal.endsAt },
    ]);

    await syncRehearsalToCalendar(rehearsal, 'work');

    expect(Calendar.createEventAsync).toHaveBeenCalledTimes(1);
    expect(Calendar.deleteEventAsync).toHaveBeenLastCalledWith('old-event');
    expect(saveEventMapping).toHaveBeenCalledWith('1', 'new-event', 'work', expect.any(Number));
  });
});

describe('"Remove all exported" with one event that will not go (EX02)', () => {
  beforeEach(() => {
    (getAllMappings as jest.Mock).mockResolvedValue({
      '1': { eventId: 'e1', calendarId: 'cal-1' },
      '2': { eventId: 'e2', calendarId: 'cal-1' },
    });
    (Calendar.deleteEventAsync as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'e2') throw new Error('Calendar is read-only');
    });
  });

  it('keeps the mapping of the event still in the calendar', async () => {
    const result = await removeAllExportedEvents();

    expect(result).toMatchObject({ success: 1, failed: 1 });
    expect(removeEventMapping).toHaveBeenCalledWith('1', expect.any(Number));
    expect(removeEventMapping).not.toHaveBeenCalledWith('2', expect.anything());
    const { clearAllMappings } = jest.requireMock('../../../utils/calendarMappings');
    expect(clearAllMappings).not.toHaveBeenCalled();
  });
});

describe('"Last export" (EO06)', () => {
  it('is not stamped by a run in which something failed', async () => {
    (Calendar.updateEventAsync as jest.Mock).mockRejectedValue(new Error('Calendar is read-only'));

    await syncAllRehearsals([rehearsal], 'cal-1');

    expect(updateLastExportTime).not.toHaveBeenCalled();
  });

  it('is stamped by a run with no failure, once', async () => {
    await syncAllRehearsals([rehearsal, { ...rehearsal, id: '2' }], 'cal-1');

    expect(updateLastExportTime).toHaveBeenCalledTimes(1);
  });

  it('is not stamped by one rehearsal written on its own', async () => {
    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    expect(updateLastExportTime).not.toHaveBeenCalled();
  });
});
