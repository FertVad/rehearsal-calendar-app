/**
 * The export takes an event as its own only by its own mark (cause fix 19, EX01).
 *
 * It used to take any event whose title, times and place matched a rehearsal:
 * a personal "Rehearsal: Гамлет" from 17:00 to 19:00 became the export of the
 * rehearsal at those hours, was rewritten when the rehearsal changed and
 * deleted when it was cancelled. And a mapping, once made, was trusted as it
 * stood — update and delete went by the id alone. Now the mark decides, before
 * every adoption, update and removal: the rehearsal's id in the URL, or, for an
 * event from before the URL, the app's signature at the end of the notes.
 */
import * as Calendar from 'expo-calendar';
import {
  createCalendarEvent,
  removeAllExportedEvents,
  syncAllRehearsals,
  syncRehearsalToCalendar,
  unsyncRehearsal,
} from '../export';
import { checkCalendarPermissions } from '../permissions';
import {
  getAllMappings,
  getEventMapping,
  removeEventMapping,
  saveEventMapping,
} from '../../../utils/calendarMappings';
import { addLeftoverEvent, getLeftoverEvents, removeLeftoverEvent } from '../../../utils/calendarStorage';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({
  getEventMapping: jest.fn(),
  getAllMappings: jest.fn(),
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/calendarStorage', () => ({
  updateLastExportTime: jest.fn().mockResolvedValue(undefined),
  addLeftoverEvent: jest.fn().mockResolvedValue(undefined),
  removeLeftoverEvent: jest.fn().mockResolvedValue(undefined),
  getLeftoverEvents: jest.fn(),
}));

const rehearsal = {
  id: '42',
  projectId: 'p1',
  projectName: 'Гамлет',
  startsAt: '2026-10-01T17:00:00.000Z',
  endsAt: '2026-10-01T19:00:00.000Z',
} as any;

/** The reader's own entry: the same title, hours and (no) place, nothing of ours. */
const personal = {
  id: 'personal-event',
  title: 'Rehearsal: Гамлет',
  startDate: rehearsal.startsAt,
  endDate: rehearsal.endsAt,
  location: null,
  notes: 'Bring the score',
};

/** An event the export wrote before it put the rehearsal in the URL. */
const legacy = {
  ...personal,
  id: 'legacy-event',
  notes: 'Project: Гамлет\n\nCreated via Rehearsal Calendar app',
};

beforeEach(() => {
  jest.clearAllMocks();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (getEventMapping as jest.Mock).mockResolvedValue(null);
  (getAllMappings as jest.Mock).mockResolvedValue({});
  (getLeftoverEvents as jest.Mock).mockResolvedValue({});
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  (Calendar.getEventAsync as jest.Mock).mockResolvedValue(null);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
  (Calendar.updateEventAsync as jest.Mock).mockResolvedValue(undefined);
  (Calendar.deleteEventAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('Finding the event for a rehearsal with no mapping', () => {
  it('does not take the reader\'s own event that matches it in every field', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([personal]);

    const id = await createCalendarEvent(rehearsal, 'cal-1');

    expect(id).toBe('new-event');
    expect(saveEventMapping).toHaveBeenCalledWith('42', 'new-event', 'cal-1', expect.any(Number));
    expect(saveEventMapping).not.toHaveBeenCalledWith('42', 'personal-event', expect.anything(), expect.anything());
    expect(Calendar.updateEventAsync).not.toHaveBeenCalled();
  });

  it('takes one of ours from before the URL, and gives it the mark', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([legacy]);

    const id = await createCalendarEvent(rehearsal, 'cal-1');

    expect(id).toBe('legacy-event');
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    const [eventId, details] = (Calendar.updateEventAsync as jest.Mock).mock.calls[0];
    expect(eventId).toBe('legacy-event');
    expect(details.url).toBe('rehearsalapp://rehearsal/42');
  });
});

describe('A mapping that points at an event that is not ours', () => {
  // What the old guess left on devices: the mapping of rehearsal 42 on the
  // reader's own event.
  beforeEach(() => {
    (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'personal-event', calendarId: 'cal-1' });
    (getAllMappings as jest.Mock).mockResolvedValue({ '42': { eventId: 'personal-event', calendarId: 'cal-1' } });
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(personal);
  });

  it('a changed rehearsal does not rewrite it; the rehearsal gets its own event', async () => {
    await syncRehearsalToCalendar({ ...rehearsal, startsAt: '2026-10-01T18:00:00.000Z' }, 'cal-1');

    expect(Calendar.updateEventAsync).not.toHaveBeenCalled();
    expect(removeEventMapping).toHaveBeenCalledWith('42', expect.any(Number));
    expect(Calendar.createEventAsync).toHaveBeenCalled();
    expect(saveEventMapping).toHaveBeenCalledWith('42', 'new-event', 'cal-1', expect.any(Number));
  });

  it('a move to another calendar leaves it where it is', async () => {
    await syncRehearsalToCalendar(rehearsal, 'work');

    expect(Calendar.deleteEventAsync).not.toHaveBeenCalled();
    expect(addLeftoverEvent).not.toHaveBeenCalled();
  });

  it('a cancelled rehearsal does not delete it, and lets the mapping go', async () => {
    await unsyncRehearsal('42');

    expect(Calendar.deleteEventAsync).not.toHaveBeenCalled();
    expect(removeEventMapping).toHaveBeenCalledWith('42', expect.any(Number));
  });

  it('"remove all exported" does not delete it', async () => {
    const result = await removeAllExportedEvents();

    expect(Calendar.deleteEventAsync).not.toHaveBeenCalled();
    expect(removeEventMapping).toHaveBeenCalledWith('42', expect.any(Number));
    expect(result.failed).toBe(0);
  });

  it('nor does an event that names another rehearsal', async () => {
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue({ ...personal, url: 'rehearsalapp://rehearsal/99' });

    await unsyncRehearsal('42');

    expect(Calendar.deleteEventAsync).not.toHaveBeenCalled();
  });

  it('a leftover copy that is not ours is not deleted either', async () => {
    (getLeftoverEvents as jest.Mock).mockResolvedValue({ 'personal-event': { rehearsalId: '42' } });

    await syncAllRehearsals([], 'cal-1');

    expect(Calendar.deleteEventAsync).not.toHaveBeenCalled();
    expect(removeLeftoverEvent).toHaveBeenCalledWith('personal-event');
  });
});

describe('Our own events are still ours', () => {
  it('a marked one is deleted with its rehearsal', async () => {
    (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'e1', calendarId: 'cal-1' });
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue({ ...personal, id: 'e1', url: 'rehearsalapp://rehearsal/42' });

    await unsyncRehearsal('42');

    expect(Calendar.deleteEventAsync).toHaveBeenCalledWith('e1');
  });

  it('one from before the URL is deleted with its rehearsal', async () => {
    (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'legacy-event', calendarId: 'cal-1' });
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(legacy);

    await unsyncRehearsal('42');

    expect(Calendar.deleteEventAsync).toHaveBeenCalledWith('legacy-event');
  });

  it('one from before the URL that already matches is rewritten once, to carry the mark', async () => {
    (getEventMapping as jest.Mock).mockResolvedValue({ eventId: 'legacy-event', calendarId: 'cal-1' });
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(legacy);

    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    const [eventId, details] = (Calendar.updateEventAsync as jest.Mock).mock.calls[0];
    expect(eventId).toBe('legacy-event');
    expect(details.url).toBe('rehearsalapp://rehearsal/42');
  });
});
