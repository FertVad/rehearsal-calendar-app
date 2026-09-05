/**
 * Which stored rows the import can still reach.
 *
 * The first test in this directory. Calendar sync had none at all, which is how
 * two fixes landed here in a week and both could be reverted without anything
 * going red.
 *
 * iOS returns every event that OVERLAPS the requested window, so a holiday
 * running 1–15 September still arrives on the 4th. The stored rows were matched
 * by their start instead, so that row fell out of scope: it could not be
 * compared, so it was never updated, and if the event was deleted from the
 * phone it was never deleted here either. It stayed, marking the user busy for
 * a trip they had cancelled, with nothing able to reach it again.
 */
import * as Calendar from 'expo-calendar';
import { importCalendarEventsToAvailability } from '../import';
import { availabilityAPI } from '../../api';
import { getAllMappings } from '../../../utils/calendarMappings';
import { checkCalendarPermissions } from '../permissions';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({ getAllMappings: jest.fn() }));
jest.mock('../../api', () => ({
  availabilityAPI: {
    getAll: jest.fn(),
    bulkSet: jest.fn(),
    batchUpdateImported: jest.fn(),
    batchDeleteImported: jest.fn(),
  },
}));

const iso = (daysFromToday: number, time = '00:00:00.000') => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.toISOString().split('T')[0]}T${time}Z`;
};

/** A row already stored from a previous import. */
const storedRow = (extId: string, startsAt: string, endsAt: string) => ({
  id: 1,
  source: 'apple_calendar',
  externalEventId: extId,
  startsAt,
  endsAt,
});

beforeEach(() => {
  jest.clearAllMocks();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (getAllMappings as jest.Mock).mockResolvedValue([]);
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  (availabilityAPI.bulkSet as jest.Mock).mockResolvedValue({});
  (availabilityAPI.batchUpdateImported as jest.Mock).mockResolvedValue({});
  (availabilityAPI.batchDeleteImported as jest.Mock).mockResolvedValue({});
});

const deletedIds = () => {
  const call = (availabilityAPI.batchDeleteImported as jest.Mock).mock.calls[0];
  return call ? call[0] : [];
};

describe('A stored event the phone no longer has', () => {
  it('is deleted when it lies inside the window', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
      data: [storedRow('evt-soon', iso(5), iso(5, '23:59:59.999'))],
    });

    await importCalendarEventsToAvailability(['cal-1']);

    expect(deletedIds()).toContain('evt-soon');
  });

  it('is deleted even though it began before today, if it is still running', async () => {
    // The holiday. Started on the 1st, runs to the 15th, cancelled on the 4th.
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
      data: [storedRow('evt-holiday', iso(-3), iso(11, '23:59:59.999'))],
    });

    await importCalendarEventsToAvailability(['cal-1']);

    expect(deletedIds()).toContain('evt-holiday');
  });

  it('is left alone when it finished before the window opens', async () => {
    // Past availability is nobody's business — the window looks forward on
    // purpose, and churning history costs work for no one's benefit.
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
      data: [storedRow('evt-last-week', iso(-9), iso(-8, '23:59:59.999'))],
    });

    await importCalendarEventsToAvailability(['cal-1']);

    expect(deletedIds()).not.toContain('evt-last-week');
  });

  it('is left alone when it lies beyond the year the window covers', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
      data: [storedRow('evt-far', iso(400), iso(401, '23:59:59.999'))],
    });

    await importCalendarEventsToAvailability(['cal-1']);

    expect(deletedIds()).not.toContain('evt-far');
  });

  it('reads the end from either spelling the server may use', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 2,
          source: 'apple_calendar',
          external_event_id: 'evt-snake',
          startsAt: iso(-3),
          ends_at: iso(11, '23:59:59.999'),
        },
      ],
    });

    await importCalendarEventsToAvailability(['cal-1']);

    expect(deletedIds()).toContain('evt-snake');
  });
});
