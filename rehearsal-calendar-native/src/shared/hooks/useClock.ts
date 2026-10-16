/**
 * The app's clock, for screens that show "today" or what is still ahead of it.
 *
 * `new Date().toISOString().split('T')[0]` is the UTC date. Behind UTC it turns
 * to tomorrow in the evening, so the availability editor called the rest of
 * today "past" and refused it (review CC01); ahead of UTC it lags after
 * midnight. And a value read once goes stale on a screen left open: the planner
 * kept offering 10:30 at noon (review DP04). Both read the clock here, and read
 * it again when it has moved far enough to matter and when the app comes back
 * to the foreground — the background runs no timers.
 *
 * The clock is the profile's zone, not the device's (cause fix 14, time.ts):
 * rehearsals are dated in it, so "today" is too. Read by the device, a
 * rehearsal already over counted as upcoming wherever the two differed (DF01).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { appTimezone, formatDateToString, onAppTimezone, todayIn, wallClockIn } from '../utils/time';

/** The app's zone: the profile's, the device's only while the profile has none. */
export function useTimezone(): string {
  return useSyncExternalStore(onAppTimezone, appTimezone);
}

/** The date in `timezone` now, 'YYYY-MM-DD'. */
export const localDate = (now: Date = new Date(), timezone?: string): string =>
  timezone ? todayIn(timezone, now) : formatDateToString(now);

const POLL_MS = 30 * 1000;

/**
 * Now, as a wall clock in the profile's zone (time.ts, wallClockIn), moving in
 * steps of `stepMinutes` of its day: the value changes only when the step, the
 * date or the zone changes, so a screen recomputes when there is something new
 * to show and not every tick.
 */
export function useNow(stepMinutes = 1): Date {
  const timezone = useTimezone();
  const [instant, setInstant] = useState(() => new Date());
  const zone = useRef(timezone);
  zone.current = timezone;

  useEffect(() => {
    const step = (date: Date) => {
      const clock = wallClockIn(zone.current, date);
      return `${zone.current} ${formatDateToString(clock)} ${Math.floor((clock.getHours() * 60 + clock.getMinutes()) / stepMinutes)}`;
    };
    let current = step(new Date());
    const look = () => {
      const date = new Date();
      const next = step(date);
      if (next !== current) {
        current = next;
        setInstant(date);
      }
    };
    const timer = setInterval(look, POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') look();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [stepMinutes, timezone]);

  return useMemo(() => wallClockIn(timezone, instant), [timezone, instant]);
}

/** Today in the profile's zone, turning at its midnight and on return to the app. */
export function useToday(): string {
  return formatDateToString(useNow(24 * 60));
}
