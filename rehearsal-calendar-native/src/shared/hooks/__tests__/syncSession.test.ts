/**
 * The calendar sync of one person writes nothing as the next (cause fix 12:
 * ES01, review).
 *
 * The sync is the session's work, and a change of account waits for it — but
 * only so long; past that the work goes on and must stop by itself. It did not:
 * each step asked for the session current when it started, so a step that
 * started after the change ran as the next person. A mappings request answered
 * late, the import began then, and the first person's calendar went to the
 * server under the second person's token; a new event's mapping was written
 * before anything looked at the session at all.
 *
 * The stamp of the run goes down the whole chain now, and every request names
 * it. The API client sends a request only while the session it names lasts
 * (api.refresh.test.ts); the mock below keeps the same rule and records under
 * which session each request went out.
 */
import * as Calendar from 'expo-calendar';
import { runAutoSync } from '../useAutoCalendarSync';
import { syncRehearsalToCalendar } from '../../services/calendar';
import { changeOwner, currentSession, isCurrentSession, resetSessionForTests, restoreOwner, SessionEndedError } from '../../services/session';

const mockSent: { url: string; session: number }[] = [];
const mockRequest = (url: string, answer: unknown = { data: {} }) => (...args: unknown[]) => {
  // The interceptor's rule: a request names its session, or is the current one's.
  const named = args[args.length - 1];
  const session = typeof named === 'number' ? named : currentSession();
  if (!isCurrentSession(session)) return Promise.reject(new SessionEndedError());
  mockSent.push({ url, session });
  return Promise.resolve(answer);
};
const mockLateMappings: { answer?: (value: unknown) => void } = {};

jest.mock('../../services/api', () => ({
  projectsAPI: { getUserProjects: jest.fn(() => Promise.resolve({ data: { projects: [{ id: 'p1' }] } })) },
  rehearsalsAPI: { getBatch: jest.fn(() => Promise.resolve({ data: { rehearsals: [] } })) },
  availabilityAPI: {
    syncImported: jest.fn((...args: unknown[]) => mockRequest('availability/imported/sync', { data: { held: 1 } })(...args)),
    deleteAllImported: jest.fn((...args: unknown[]) => mockRequest('availability/imported/all')(...args)),
  },
  calendarSyncAPI: {
    getMappings: jest.fn(() => new Promise((resolve) => { mockLateMappings.answer = resolve; })),
    getConnections: jest.fn((...args: unknown[]) => mockRequest('connections', { data: { connections: [{ id: 7, device_calendar_id: 'cal-export' }] } })(...args)),
    createOrUpdateConnection: jest.fn((...args: unknown[]) => mockRequest('connections:create')(...args)),
    createOrUpdateMapping: jest.fn((...args: unknown[]) => mockRequest('mappings:create')(...args)),
    deleteMappingByEvent: jest.fn((...args: unknown[]) => mockRequest('mappings:delete')(...args)),
    deleteMappings: jest.fn((...args: unknown[]) => mockRequest('mappings:delete-all')(...args)),
  },
}));

jest.mock('../../services/calendar/permissions', () => ({ checkCalendarPermissions: jest.fn(() => Promise.resolve(true)) }));

jest.mock('../../utils/calendarStorage', () => ({
  getSyncSettings: jest.fn(() => Promise.resolve({
    importEnabled: true,
    exportEnabled: true,
    importCalendarIds: ['cal-1'],
    exportCalendarId: 'cal-export',
  })),
  saveSyncSettings: jest.fn(() => Promise.resolve()),
  updateLastImportTime: jest.fn(() => Promise.resolve()),
  updateLastExportTime: jest.fn(() => Promise.resolve()),
  setImportedEventsCount: jest.fn(() => Promise.resolve()),
  clearAllImportedEvents: jest.fn(() => Promise.resolve()),
  saveEventMapping: jest.fn(() => Promise.resolve()),
  getEventMapping: jest.fn(() => Promise.resolve(null)),
  removeEventMapping: jest.fn(() => Promise.resolve()),
  getAllMappings: jest.fn(() => Promise.resolve({})),
  clearAllMappings: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('a-token')),
  setItem: jest.fn(() => Promise.resolve()),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const calendarStorage = require('../../utils/calendarStorage');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const tomorrow = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  return { start, end: new Date(start.getTime() + 3600000) };
};

// The sync's throttle lives at module scope; each test starts ten minutes on.
let clock = 1_700_000_000_000;
let firstPersons: number;
beforeEach(() => {
  jest.clearAllMocks();
  clock += 600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  mockSent.length = 0;
  resetSessionForTests();
  restoreOwner(1);
  firstPersons = currentSession();
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([{ id: 'cal-1' }, { id: 'cal-export' }]);
  const { start, end } = tomorrow();
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
    { id: 'dentist', calendarId: 'cal-1', startDate: start.toISOString(), endDate: end.toISOString(), allDay: false },
  ]);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
});

it('sends nothing as the second person once the mappings come back after the change (ES01)', async () => {
  // Only the export asks for the mappings now; the import knows our own events
  // by their mark (review of cause fix 19), so it has run by then.
  const running = runAutoSync();
  await tick();
  expect(mockLateMappings.answer).toBeDefined();

  // The change has stopped waiting for the sync; the second person is in.
  changeOwner(2);
  mockLateMappings.answer!({ data: { mappings: [] } });
  await running;

  expect(mockSent.filter((request) => request.session !== firstPersons)).toEqual([]);
  expect(calendarStorage.updateLastExportTime).not.toHaveBeenCalled();
});

it('neither creates the event nor records its mapping when the account changed during the search for a copy (ES01)', async () => {
  let answerSearch!: (events: unknown[]) => void;
  (Calendar.getEventsAsync as jest.Mock).mockReturnValue(new Promise((resolve) => { answerSearch = resolve; }));
  const rehearsal = { id: 'r1', projectId: 'p1', projectName: 'The Seagull', startsAt: '2026-11-01T17:00:00.000Z', endsAt: '2026-11-01T19:00:00.000Z' };

  const syncing = syncRehearsalToCalendar(rehearsal as any, 'cal-export', null).catch((error) => error);
  await tick();
  changeOwner(2);
  answerSearch([]);
  const outcome = await syncing;

  expect(outcome).toMatchObject({ name: 'SessionEndedError' });
  expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  expect(calendarStorage.saveEventMapping).not.toHaveBeenCalled();
  expect(mockSent.filter((request) => request.session !== firstPersons)).toEqual([]);
});

it('runs to the end while the account stays', async () => {
  const running = runAutoSync();
  await tick();
  mockLateMappings.answer!({ data: { mappings: [] } });
  await running;

  expect(mockSent.map((request) => request.url)).toContain('availability/imported/sync');
  expect(mockSent.every((request) => request.session === firstPersons)).toBe(true);
});
