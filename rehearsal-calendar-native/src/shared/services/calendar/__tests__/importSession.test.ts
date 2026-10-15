/**
 * A calendar sync begun for one person ends with their session (cause fix 12:
 * ES01; CLAUDE.md 11).
 *
 * The import read the phone's calendars, and while that read was out the
 * person signed out and somebody else signed in. The read then finished and
 * the hours went to the server under the next person's token — one person's
 * private calendar in another's availability. Now the import is the session's
 * work: a change of account waits for it before the next tokens are written,
 * and it writes nothing once its session has ended.
 */
import * as Calendar from 'expo-calendar';
import { importCalendarEventsToAvailability } from '../import';
import { availabilityAPI } from '../../api';
import { checkCalendarPermissions } from '../permissions';
import { updateLastImportTime, setImportedEventsCount } from '../../../utils/calendarStorage';
import { changeOwner, resetSessionForTests, restoreOwner } from '../../session';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({ getAllMappings: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../../utils/calendarStorage', () => ({
  updateLastImportTime: jest.fn(),
  setImportedEventsCount: jest.fn(),
  clearAllImportedEvents: jest.fn(),
}));
jest.mock('../../api', () => ({
  availabilityAPI: { syncImported: jest.fn() },
}));

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionForTests();
  restoreOwner(1);
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([{ id: 'work' }]);
  (availabilityAPI.syncImported as jest.Mock).mockResolvedValue({
    data: { added: 1, updated: 0, removed: 0, adopted: 0, unchanged: 0, held: 1 },
  });
});

it('sends nothing, and stamps nothing, when the account changed while the calendars were read', async () => {
  let finishRead!: (events: unknown[]) => void;
  (Calendar.getEventsAsync as jest.Mock).mockReturnValue(new Promise((resolve) => { finishRead = resolve; }));
  const start = tomorrow();
  const end = new Date(start.getTime() + 3600000);

  const importing = importCalendarEventsToAvailability(['work']).catch((error) => error);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Another person signs in: the change waits for the import.
  let changed = false;
  const changing = changeOwner(2).then(() => { changed = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(changed).toBe(false);

  finishRead([{ id: 'e1', calendarId: 'work', startDate: start.toISOString(), endDate: end.toISOString(), allDay: false }]);
  const outcome = await importing;
  await changing;

  expect(outcome).toMatchObject({ name: 'SessionEndedError' });
  expect(availabilityAPI.syncImported).not.toHaveBeenCalled();
  expect(setImportedEventsCount).not.toHaveBeenCalled();
  expect(updateLastImportTime).not.toHaveBeenCalled();
  expect(changed).toBe(true);
});

it('runs to the end when the account stays', async () => {
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  await importCalendarEventsToAvailability(['work']);

  expect(availabilityAPI.syncImported).toHaveBeenCalledTimes(1);
  expect(updateLastImportTime).toHaveBeenCalled();
});
