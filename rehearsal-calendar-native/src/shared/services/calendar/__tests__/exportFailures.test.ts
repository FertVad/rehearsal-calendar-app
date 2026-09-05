/**
 * What a failed sync must not do.
 *
 * Two habits ran through this file: read every failure as "the reader deleted
 * it", and mark the run done whatever happened. Together they turned a revoked
 * permission into data loss that announced itself as success.
 */
import * as Calendar from 'expo-calendar';
import { syncAllRehearsals } from '../export';
import { checkCalendarPermissions } from '../permissions';
import { getEventMapping, removeEventMapping, saveEventMapping } from '../../../utils/calendarMappings';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({
  getEventMapping: jest.fn(),
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
}));

const rehearsals = [
  { id: '1', projectId: 'p', projectName: 'Гамлет', startsAt: '2026-10-01T17:00:00.000Z', endsAt: '2026-10-01T19:00:00.000Z' },
  { id: '2', projectId: 'p', projectName: 'Гамлет', startsAt: '2026-10-02T17:00:00.000Z', endsAt: '2026-10-02T19:00:00.000Z' },
] as any;

beforeEach(() => {
  jest.clearAllMocks();
  (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'e1', calendarId: 'cal-1' });
  (Calendar.getEventAsync as jest.Mock).mockResolvedValue({ id: 'e1' });
  (Calendar.updateEventAsync as jest.Mock).mockResolvedValue(undefined);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
});

describe('Calendar access revoked in Settings', () => {
  beforeEach(() => {
    // What iOS actually does once access is revoked: the permission query says
    // no, and every read throws. The old code caught that throw and answered
    // "the event is gone".
    (checkCalendarPermissions as jest.Mock).mockResolvedValue(false);
    (Calendar.getEventAsync as jest.Mock).mockRejectedValue(new Error('Not authorized'));
    (Calendar.updateEventAsync as jest.Mock).mockRejectedValue(new Error('Not authorized'));
    (Calendar.createEventAsync as jest.Mock).mockRejectedValue(new Error('Not authorized'));
  });

  it('destroys no mapping', async () => {
    // The events are still in the calendar; we simply cannot see them. Throwing
    // the record away leaves them there with nothing able to reach them again.
    await syncAllRehearsals(rehearsals, 'cal-1');

    expect(removeEventMapping).not.toHaveBeenCalled();
  });

  it('creates no second copy of anything', async () => {
    await syncAllRehearsals(rehearsals, 'cal-1');

    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it('reports the whole run as failed rather than as done', async () => {
    const result = await syncAllRehearsals(rehearsals, 'cal-1');

    expect(result.success).toBe(0);
    expect(result.failed).toBe(2);
  });
});

describe('An event the reader really did delete', () => {
  it('is recreated, which is what the recovery path is for', async () => {
    (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(null);

    const result = await syncAllRehearsals([rehearsals[0]], 'cal-1');

    expect(removeEventMapping).toHaveBeenCalledWith('1');
    expect(Calendar.createEventAsync).toHaveBeenCalled();
    expect(result.success).toBe(1);
  });
});

describe('An ordinary run', () => {
  it('updates the event that is already there', async () => {
    (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);

    const result = await syncAllRehearsals([rehearsals[0]], 'cal-1');

    expect(Calendar.updateEventAsync).toHaveBeenCalled();
    expect(saveEventMapping).toHaveBeenCalled();
    expect(result.failed).toBe(0);
  });
});
