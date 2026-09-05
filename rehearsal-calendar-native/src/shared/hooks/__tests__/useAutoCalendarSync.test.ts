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
import { importCalendarEventsToAvailability } from '../../services/calendar';

jest.mock('../../services/calendar', () => ({
  importCalendarEventsToAvailability: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  syncAllRehearsals: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
}));

jest.mock('../../utils/calendarStorage', () => ({
  getSyncSettings: jest.fn().mockResolvedValue({
    importEnabled: true,
    importCalendarIds: ['cal-1'],
    exportCalendarId: null,
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
