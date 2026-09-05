/**
 * When automatic calendar sync actually runs.
 *
 * The hook registers an AppState listener and syncs when the app returns from
 * the background. Its only caller was the availability editor — which is not a
 * tab but a modal reached from the "+" button — so the listener existed only
 * while that sheet was open. Someone who switched Auto Sync on and never opened
 * it got no import and no export, ever, while the settings screen said it was
 * running. Nothing in the code looked wrong; the defect was in where it was
 * mounted.
 *
 * These pin the two halves of the repair: the listener belongs to whoever asks
 * for it, and the guard against overlapping runs is shared by every caller
 * rather than being one lock per mount.
 */
import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useAutoCalendarSync } from '../useAutoCalendarSync';
import { importCalendarEventsToAvailability, unsyncRehearsal } from '../../services/calendar';
import { getAllMappings } from '../../utils/calendarMappings';
import { rehearsalsAPI } from '../../services/api';

jest.mock('../../services/calendar', () => ({
  importCalendarEventsToAvailability: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  syncAllRehearsals: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  unsyncRehearsal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/calendarMappings', () => ({ getAllMappings: jest.fn().mockResolvedValue({}) }));

jest.mock('../../services/api', () => ({
  projectsAPI: { getUserProjects: jest.fn().mockResolvedValue({ data: { projects: [{ id: 'p1' }] } }) },
  rehearsalsAPI: { getBatch: jest.fn().mockResolvedValue({ data: { rehearsals: [] } }) },
}));

jest.mock('../../utils/calendarStorage', () => ({
  getSyncSettings: jest.fn().mockResolvedValue({
    importEnabled: true,
    exportEnabled: true,
    importCalendarIds: ['cal-1'],
    exportCalendarId: 'cal-export',
    lastImportTime: null,
    lastExportTime: null,
  }),
  saveSyncSettings: jest.fn().mockResolvedValue(undefined),
  shouldImportNow: jest.fn().mockResolvedValue({ importCalendarIds: ['cal-1'] }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('a-token'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const state = AppState as unknown as {
  __listeners: Array<unknown>;
  __emit: (s: string) => Promise<void>;
  __reset: () => void;
};

const listeners = () => state.__listeners;

// The throttle and the in-flight lock live at module scope on purpose — that
// is what makes them shared — which also means they survive between tests. Each
// test starts ten minutes after the last so the previous one's throttle has
// expired, rather than reaching into the module to reset it.
let clock = 1_700_000_000_000;

beforeEach(() => {
  state.__reset();
  jest.clearAllMocks();
  clock += 600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const foreground = async () => {
  await act(async () => {
    await state.__emit('background');
    await state.__emit('active');
  });
};

describe('Watching for the app coming forward', () => {
  it('does not listen unless asked to', () => {
    // The default. Screens take the manual functions from this hook without
    // each of them registering another listener.
    renderHook(() => useAutoCalendarSync());

    expect(listeners()).toHaveLength(0);
  });

  it('listens when asked, which is what the tab bar does', () => {
    renderHook(() => useAutoCalendarSync({ syncOnForeground: true }));

    expect(listeners()).toHaveLength(1);
  });

  it('syncs when the app comes forward', async () => {
    renderHook(() => useAutoCalendarSync({ syncOnForeground: true }));

    await foreground();

    expect(importCalendarEventsToAvailability).toHaveBeenCalled();
  });

  it('registers one listener however many screens use the hook', () => {
    // The failure this shape prevents: two listeners means two syncs on every
    // foreground, and an overlapping import is how a duplicate row reached the
    // database once already.
    renderHook(() => useAutoCalendarSync({ syncOnForeground: true }));
    renderHook(() => useAutoCalendarSync());
    renderHook(() => useAutoCalendarSync());

    expect(listeners()).toHaveLength(1);
  });
});

describe('The guard against overlapping runs', () => {
  it('is shared between separate mounts, not one lock each', async () => {
    // It used to be a useRef, so every mount had its own lock and none of them
    // could see the others.
    const a = renderHook(() => useAutoCalendarSync());
    const b = renderHook(() => useAutoCalendarSync());

    await act(async () => {
      await Promise.all([
        a.result.current.performAutoSync(),
        b.result.current.performAutoSync(),
      ]);
    });

    expect(importCalendarEventsToAvailability).toHaveBeenCalledTimes(1);
  });
});


describe('Opening the app from nothing', () => {
  it('syncs on a cold launch, not only on a return from the background', async () => {
    // AppState.currentState is already 'active' when the app starts from
    // nothing, so the listener's background→active transition never fires. That
    // left the commonest case uncovered: tapping a notification for an app that
    // was not running, which is exactly when someone most wants the data fresh.
    renderHook(() => useAutoCalendarSync({ syncOnForeground: true }));
    await act(async () => {});

    expect(importCalendarEventsToAvailability).toHaveBeenCalled();
  });

  it('does not sync on mount for a screen that only wants the manual functions', async () => {
    renderHook(() => useAutoCalendarSync());
    await act(async () => {});

    expect(importCalendarEventsToAvailability).not.toHaveBeenCalled();
  });
});

describe('Taking back the events of rehearsals that no longer exist', () => {
  const mapped = (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { eventId: `evt-${id}`, calendarId: 'c1', lastSynced: '' }]));

  const runExport = async (liveIds: string[], mappedIds: string[]) => {
    (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
      data: { rehearsals: liveIds.map((id) => ({ id, startsAt: '', endsAt: '' })) },
    });
    (getAllMappings as jest.Mock).mockResolvedValue(mapped(mappedIds));

    const { result } = renderHook(() => useAutoCalendarSync());
    await act(async () => {
      await result.current.forceSync();
    });
  };

  it('removes the event of a rehearsal that was cancelled', async () => {
    // The organiser's own device deletes its event at the moment of deletion.
    // Everyone else keeps theirs, with an alarm, for a call that does not exist
    // — and nothing could reach it until this pass.
    await runExport(['1', '3'], ['1', '2', '3']);

    expect(unsyncRehearsal).toHaveBeenCalledTimes(1);
    expect(unsyncRehearsal).toHaveBeenCalledWith('2');
  });

  it('leaves the events of rehearsals that still exist', async () => {
    await runExport(['1', '2'], ['1', '2']);

    expect(unsyncRehearsal).not.toHaveBeenCalled();
  });

  it('removes every event once the last rehearsal is gone', async () => {
    // An empty list from a request that succeeded is an empty list. Both calls
    // throw rather than returning nothing, so this cannot be a failed fetch.
    await runExport([], ['1', '2']);

    expect(unsyncRehearsal).toHaveBeenCalledTimes(2);
  });

  it('carries on when one event cannot be removed', async () => {
    // A calendar deleted on the device, or permission revoked. The rest must
    // still be cleaned, and the failed one keeps its mapping so the next sync
    // can try again rather than leaving the event unreachable.
    (unsyncRehearsal as jest.Mock).mockRejectedValueOnce(new Error('calendar gone'));

    await runExport([], ['1', '2']);

    expect(unsyncRehearsal).toHaveBeenCalledTimes(2);
  });
});
