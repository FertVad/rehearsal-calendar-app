/**
 * What one sync costs when nothing has changed.
 *
 * Opening the app runs a full sync, and it now runs on every foreground rather
 * than once every ten minutes — the interval went away because the export
 * stopped asking the server about each rehearsal separately. This counts what
 * replaced it, so the saving cannot quietly be given back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import { useAutoCalendarSync } from '../useAutoCalendarSync';
import { getAllMappings } from '../../utils/calendarMappings';
import { projectsAPI, rehearsalsAPI } from '../../services/api';
import { importCalendarEventsToAvailability, syncAllRehearsals } from '../../services/calendar';

jest.mock('../../services/calendar', () => ({
  importCalendarEventsToAvailability: jest.fn().mockResolvedValue({ success: 0, failed: 0, skipped: 3 }),
  syncAllRehearsals: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  unsyncRehearsal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/calendarMappings', () => ({ getAllMappings: jest.fn() }));
jest.mock('../../utils/calendarStorage', () => ({
  getSyncSettings: jest.fn(),
  saveSyncSettings: jest.fn().mockResolvedValue(undefined),
  shouldImportNow: jest.fn().mockResolvedValue({ importCalendarIds: ['cal-1'] }),
}));
jest.mock('../../services/api', () => ({
  projectsAPI: { getUserProjects: jest.fn() },
  rehearsalsAPI: { getBatch: jest.fn() },
}));

const { getSyncSettings } = jest.requireMock('../../utils/calendarStorage');

let clock = 1_800_000_000_000;

beforeEach(async () => {
  jest.clearAllMocks();
  // The run bails without a session, which is deliberate: signing in with Apple
  // or Google backgrounds the app and the foreground event lands here before
  // the token is stored.
  await AsyncStorage.setItem('accessToken', 'a-token');
  clock += 600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);

  getSyncSettings.mockResolvedValue({
    importEnabled: true,
    exportEnabled: true,
    importCalendarIds: ['cal-1'],
    exportCalendarId: 'cal-export',
    lastImportTime: null,
    lastExportTime: null,
  });
  (projectsAPI.getUserProjects as jest.Mock).mockResolvedValue({ data: { projects: [{ id: 'p1' }] } });
  (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
    data: { rehearsals: [{ id: '1', startsAt: '', endsAt: '' }] },
  });
  (getAllMappings as jest.Mock).mockResolvedValue({
    '1': { eventId: 'e1', calendarId: 'cal-export', lastSynced: '' },
  });
});

afterEach(() => jest.restoreAllMocks());

const runOneSync = async () => {
  const { result } = renderHook(() => useAutoCalendarSync());
  await act(async () => {
    await result.current.performAutoSync();
  });
};

describe('One sync with nothing to do', () => {
  it('asks for the project list once', async () => {
    await runOneSync();
    expect((projectsAPI.getUserProjects as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('asks for the rehearsals once', async () => {
    await runOneSync();
    expect((rehearsalsAPI.getBatch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('asks for the mappings exactly once', async () => {
    // The import wants them to leave our own exported rehearsals alone, the
    // export to match event to rehearsal. Same data, and it used to be fetched
    // twice. Sharing is safe because nothing on the import path writes to them.
    await runOneSync();
    expect((getAllMappings as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('hands the same mappings to the import', async () => {
    await runOneSync();

    const [, , knownMappings] = (importCalendarEventsToAvailability as jest.Mock).mock.calls[0];
    expect(knownMappings).toBeDefined();
    expect(Object.keys(knownMappings)).toContain('1');
  });

  it('does one import and one export, not one per rehearsal', async () => {
    await runOneSync();
    expect((importCalendarEventsToAvailability as jest.Mock).mock.calls).toHaveLength(1);
    expect((syncAllRehearsals as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('hands the export the mappings, so it asks for none of its own', async () => {
    // This is what let the ten-minute interval go: without it the export asked
    // the server about every rehearsal separately.
    await runOneSync();

    const [, , , knownMappings] = (syncAllRehearsals as jest.Mock).mock.calls[0];
    expect(knownMappings).toBeDefined();
    expect(Object.keys(knownMappings)).toContain('1');
  });
});
