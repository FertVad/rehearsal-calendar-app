/**
 * The local clock for screens that show "today" (review CC01, DP04).
 *
 * `new Date().toISOString().split('T')[0]` is the UTC date. Behind UTC it turns
 * to tomorrow in the evening, so the availability editor called the rest of
 * today "past" and refused it; ahead of UTC it lags after midnight. And a value
 * read once goes stale on a screen left open: the planner kept offering 10:30
 * at noon.
 */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { localDate, useNow, useToday } from '../useClock';

afterEach(() => {
  jest.useRealTimers();
  (AppState as any).__reset();
});

it('names the local date, not the UTC one (review CC01)', () => {
  // A local time on the far side of UTC midnight from here, whichever side
  // this machine is on. In UTC itself the two dates agree and this only checks
  // the format.
  const offset = new Date(2026, 8, 11, 12).getTimezoneOffset();
  const now = offset <= 0 ? new Date(2026, 8, 11, 0, 30) : new Date(2026, 8, 11, 23, 30);
  expect(localDate(now)).toBe('2026-09-11');
});

it('turns to the next day at local midnight, with the screen still open', () => {
  jest.useFakeTimers({ now: new Date(2026, 8, 11, 23, 58) });
  const { result } = renderHook(() => useToday());
  expect(result.current).toBe('2026-09-11');

  act(() => { jest.advanceTimersByTime(3 * 60 * 1000); });

  expect(result.current).toBe('2026-09-12');
});

it('catches up when the app comes back to the foreground', async () => {
  jest.useFakeTimers({ now: new Date(2026, 8, 11, 20, 0) });
  const { result } = renderHook(() => useToday());

  // A night in the background: no timers ran.
  jest.setSystemTime(new Date(2026, 8, 12, 8, 0));
  await act(async () => { await (AppState as any).__emit('active'); });

  expect(result.current).toBe('2026-09-12');
});

it('moves in the steps it is asked for, and not in between', () => {
  jest.useFakeTimers({ now: new Date(2026, 8, 11, 10, 5) });
  const { result } = renderHook(() => useNow(30));
  const first = result.current;

  act(() => { jest.advanceTimersByTime(20 * 60 * 1000); });
  expect(result.current).toBe(first);

  act(() => { jest.advanceTimersByTime(10 * 60 * 1000); });
  expect(result.current.getHours()).toBe(10);
  expect(result.current.getMinutes()).toBeGreaterThanOrEqual(30);
});
