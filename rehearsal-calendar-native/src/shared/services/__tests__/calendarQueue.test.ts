/**
 * Every write to the person's calendar goes through the sync's one queue, as
 * the person who asked for it (cause fix 18, review).
 *
 * Two gaps the review found in the queue: work was stamped with a session
 * only when its turn came, so a "remove all" confirmed behind a run that hung
 * ran as whoever had signed in since; and the event of a rehearsal just saved
 * or deleted was written beside the queue, so a run that had read the
 * rehearsals before the save wrote the old time back over the new one.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { runCalendarSync } from '../calendarSync';
import { getSyncSettings } from '../../utils/calendarStorage';
import { changeOwner, resetSessionForTests, restoreOwner } from '../session';
import {
  checkCalendarPermissions,
  getDeviceCalendars,
  removeAllExportedEvents,
  syncAllRehearsals,
  syncRehearsalToCalendar,
} from '../calendar';
import { rehearsalsAPI } from '../api';
import { useCalendarSync } from '../../../features/calendar/hooks/useCalendarSync';
import { useAddRehearsalSubmit } from '../../../features/calendar/hooks/useAddRehearsalSubmit';

jest.mock('../calendar', () => ({
  checkCalendarPermissions: jest.fn().mockResolvedValue(true),
  requestCalendarPermissions: jest.fn().mockResolvedValue(true),
  getDeviceCalendars: jest.fn().mockResolvedValue([]),
  getDefaultCalendar: jest.fn().mockResolvedValue(null),
  importCalendarEventsToAvailability: jest.fn().mockResolvedValue({ success: 0, failed: 0, skipped: 0, errors: [] }),
  syncAllRehearsals: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
  syncRehearsalToCalendar: jest.fn().mockResolvedValue(undefined),
  unsyncRehearsal: jest.fn().mockResolvedValue(undefined),
  removeAllExportedEvents: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
  removeAllImportedSlots: jest.fn().mockResolvedValue({ success: 0, failed: 0, skipped: 0, errors: [] }),
}));
jest.mock('../api', () => ({
  projectsAPI: { getUserProjects: jest.fn().mockResolvedValue({ data: { projects: [{ id: 'p1' }] } }) },
  rehearsalsAPI: {
    getBatch: jest.fn().mockResolvedValue({ data: { rehearsals: [] } }),
    update: jest.fn(),
  },
}));
jest.mock('../../utils/calendarMappings', () => ({ getAllMappings: jest.fn().mockResolvedValue({}) }));
jest.mock('../../utils/calendarStorage', () => {
  const settings = {
    exportEnabled: true,
    exportCalendarId: 'cal-export',
    lastExportTime: null,
    importEnabled: false,
    importCalendarIds: [],
    importInterval: 'manual',
    lastImportTime: null,
  };
  return {
    getSyncSettings: jest.fn().mockResolvedValue(settings),
    updateSyncSettings: jest.fn().mockResolvedValue(settings),
    isRehearsalSynced: jest.fn().mockResolvedValue(false),
    getSyncedRehearsalsCount: jest.fn().mockResolvedValue(0),
    getImportedEventsCount: jest.fn().mockResolvedValue(0),
  };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: jest.fn() }));
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'a', timezone: 'UTC' }, isAuthenticated: true, loading: false }),
}));

/** The export pass of a run, held until released. */
function holdExport(log: string[]) {
  let release!: () => void;
  (syncAllRehearsals as jest.Mock).mockImplementationOnce(() => {
    log.push('run writes what it read');
    return new Promise((resolve) => {
      release = () => {
        log.push('run done');
        resolve({ success: 1, failed: 0, errors: [] });
      };
    });
  });
  return () => release();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionForTests();
  restoreOwner('a');
});

describe('Work waiting behind a run', () => {
  it('"remove all" confirmed by one person does not run as the next one', async () => {
    const release = holdExport([]);
    (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (getDeviceCalendars as jest.Mock).mockResolvedValue([]);
    const { result } = renderHook(() => useCalendarSync());
    await waitFor(() => expect(result.current.hasPermission).toBe(true));

    await act(async () => {
      const run = runCalendarSync('manual');
      await waitFor(() => expect(syncAllRehearsals).toHaveBeenCalled());
      // Confirmed while the run hangs, then signed out and in as somebody else.
      const removing = result.current.removeAll();
      const switching = changeOwner('b');
      release();
      await Promise.all([run, removing, switching]);
    });

    expect(removeAllExportedEvents).not.toHaveBeenCalled();
  });
});

describe('The event of a rehearsal just saved', () => {
  // An edit of rehearsal r1 to 18:00.
  const renderSave = () => {
    (rehearsalsAPI.update as jest.Mock).mockResolvedValue({ data: { rehearsal: { id: 'r1' } } });
    return renderHook(() =>
      useAddRehearsalSubmit({
        localSelectedProject: { id: 'p1', name: 'Hamlet' } as any,
        date: new Date('2026-11-02T00:00:00'),
        startTime: new Date('2026-11-02T18:00:00'),
        endTime: new Date('2026-11-02T20:00:00'),
        title: 'Act I',
        location: '',
        selectedMemberIds: [],
        participantsSettled: true,
        membersFailed: false,
        reloadMembers: jest.fn(),
        members: [],
        memberAvailability: {},
        availabilityReady: true,
        availabilityFailed: false,
        reloadAvailability: jest.fn(),
        resetForm: jest.fn(),
        fields: { project: '1', date: '', start: '', end: '', title: '', location: '', participants: '' },
        markSaved: jest.fn(),
        t: { common: { error: 'Error' }, rehearsals: { success: 'Success', rehearsalUpdated: 'Updated' } },
        isEditMode: true,
        rehearsalId: 'r1',
      })
    );
  };

  it('is written after a run already going, not under it', async () => {
    // The run read the rehearsal at 14:00; the save moves it to 18:00. Written
    // beside the queue, the save's event came first and the run's write of
    // what it had read, the old time, last.
    const log: string[] = [];
    const release = holdExport(log);
    (syncRehearsalToCalendar as jest.Mock).mockImplementation(async () => {
      log.push('save writes the new time');
    });
    const { result } = renderSave();

    await act(async () => {
      const run = runCalendarSync('manual');
      await waitFor(() => expect(syncAllRehearsals).toHaveBeenCalled());
      await result.current.handleSubmit();
      // Let a write beside the queue happen, if there is one.
      await new Promise((resolve) => setTimeout(resolve, 10));
      release();
      await run;
      await waitFor(() => expect(syncRehearsalToCalendar).toHaveBeenCalled());
    });

    expect(log).toEqual(['run writes what it read', 'run done', 'save writes the new time']);
    expect(syncRehearsalToCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', title: 'Act I' }), 'cal-export', undefined, expect.any(Number));
  });

  it('is not written when exporting is off', async () => {
    (getSyncSettings as jest.Mock).mockResolvedValueOnce({ exportEnabled: false, exportCalendarId: 'cal-export' });
    const { result } = renderSave();

    await act(async () => {
      await result.current.handleSubmit();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(rehearsalsAPI.update).toHaveBeenCalled();
    expect(syncRehearsalToCalendar).not.toHaveBeenCalled();
  });
});

describe('Who writes to the calendar', () => {
  // The writers of the calendar and of the imported events. Called anywhere
  // but the sync's own service, they run beside its queue.
  const WRITERS = [
    'createCalendarEvent', 'updateCalendarEvent', 'deleteCalendarEvent',
    'syncRehearsalToCalendar', 'unsyncRehearsal', 'syncAllRehearsals', 'removeAllExportedEvents',
    'importCalendarEventsToAvailability', 'removeAllImportedSlots',
  ];
  const SRC = join(__dirname, '..', '..', '..');
  const SERVICES = join(SRC, 'shared', 'services');
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
      return /\.tsx?$/.test(name) ? [full] : [];
    });

  it('nothing outside the services imports a writer: it goes through the queue', () => {
    const outside = sources(SRC)
      .filter((file) => !file.startsWith(SERVICES))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        return [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*services\/calendar'/g)]
          .flatMap((match) => match[1].split(',').map((name) => name.trim()))
          .filter((name) => WRITERS.includes(name))
          .map((name) => `${relative(SRC, file)}: ${name}`);
      });
    expect(outside).toEqual([]);
  });
});
