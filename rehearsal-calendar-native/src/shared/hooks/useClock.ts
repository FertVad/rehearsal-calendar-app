/**
 * The local clock, for screens that show "today" or what is still ahead of it.
 *
 * `new Date().toISOString().split('T')[0]` is the UTC date. Behind UTC it turns
 * to tomorrow in the evening, so the availability editor called the rest of
 * today "past" and refused it (review CC01); ahead of UTC it lags after
 * midnight. And a value read once goes stale on a screen left open: the planner
 * kept offering 10:30 at noon (review DP04). Both read the local clock here,
 * and read it again when it has moved far enough to matter and when the app
 * comes back to the foreground — the background runs no timers.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { formatDateToString } from '../utils/time';

/** The local calendar date, 'YYYY-MM-DD'. */
export const localDate = (now: Date = new Date()): string => formatDateToString(now);

const POLL_MS = 30 * 1000;

/**
 * Now, moving in steps of `stepMinutes` of the local day: the value changes
 * only when the step or the date changes, so a screen recomputes when there is
 * something new to show and not every tick.
 */
export function useNow(stepMinutes = 1): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const step = (date: Date) =>
      `${localDate(date)} ${Math.floor((date.getHours() * 60 + date.getMinutes()) / stepMinutes)}`;
    let current = step(new Date());
    const look = () => {
      const date = new Date();
      const next = step(date);
      if (next !== current) {
        current = next;
        setNow(date);
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
  }, [stepMinutes]);

  return now;
}

/** Today's local date, turning at local midnight and on return to the app. */
export function useToday(): string {
  return localDate(useNow(24 * 60));
}
