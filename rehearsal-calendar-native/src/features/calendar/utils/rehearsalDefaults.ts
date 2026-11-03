/**
 * What the rehearsal form fills in by itself (HIG, entering data: "prefill
 * fields with reasonable default values"). One rule for every way into the
 * form, so a planner slot, a recommendation and the bare form agree (T-012).
 *
 * A slot or a recommendation is a window of free time, not a rehearsal: the
 * planner handed "All day", 09:00-23:00, to the form as a fourteen-hour
 * rehearsal. A tap on one picks the start; the end is the usual length on.
 */

/** A project with no rehearsal yet: three hours, an evening's call. */
export const DEFAULT_REHEARSAL_MINUTES = 180;

const MINUTES_IN_DAY = 24 * 60;

interface Timed {
  startsAt: string;
  endsAt: string;
  createdAt?: string | Date;
}

/**
 * How long the project's rehearsals usually are: as long as the last one put
 * in it, or three hours when there is none. One that reads as nothing or as a
 * day and more says nothing about a call, and the default stands.
 */
export function usualRehearsalMinutes(rehearsals: readonly Timed[]): number {
  let last: Timed | null = null;
  for (const rehearsal of rehearsals) {
    if (!last || made(rehearsal) > made(last)) last = rehearsal;
  }
  if (!last) return DEFAULT_REHEARSAL_MINUTES;
  const minutes = Math.round((Date.parse(last.endsAt) - Date.parse(last.startsAt)) / 60000);
  return minutes > 0 && minutes < MINUTES_IN_DAY ? minutes : DEFAULT_REHEARSAL_MINUTES;
}

const made = (rehearsal: Timed): number => {
  const at = rehearsal.createdAt ? new Date(rehearsal.createdAt).getTime() : NaN;
  return Number.isNaN(at) ? -Infinity : at;
};

/**
 * The first whole hour after `now`, a wall clock (time.ts, wallClockIn). At
 * 07:02 that is 08:00, not 07:00, which had already gone; at 23:30 it is
 * midnight, on the next day.
 */
export function nextRoundHour(now: Date): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

/** `minutes` after `start`, on the wall clock. */
export function endAfter(start: Date, minutes: number): Date {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + minutes);
  return end;
}
