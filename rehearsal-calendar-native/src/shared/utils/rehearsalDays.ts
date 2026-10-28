import { Rehearsal } from '../types';
import {
  datesBetween,
  formatDateLocalized,
  intervalDates,
  isoToTimeStringInTimezone,
} from './time';

/**
 * A rehearsal as the screens show it: an interval, startsAt to endsAt, read in
 * the person's timezone (cause fix 15).
 *
 * The screens filed a rehearsal under its start date alone, so one running
 * 10 September 23:00 to 11 September 01:00 was missing from the 11th — no card,
 * no count in the strip — and its card said "23:00 — 01:00" without saying
 * which day the end was on (DD02). Every screen now takes the days and the
 * times from here: `date` is the first day, `endDate` the last.
 */
export function rehearsalInZone<R extends Rehearsal>(r: R, timezone: string): R {
  if (!r.startsAt || !r.endsAt) return r;
  const { first, last } = intervalDates(r.startsAt, r.endsAt, timezone);
  return {
    ...r,
    date: first,
    endDate: last,
    time: isoToTimeStringInTimezone(r.startsAt, timezone),
    endTime: isoToTimeStringInTimezone(r.endsAt, timezone),
  };
}

/** The last day the rehearsal is on. */
export const lastDateOf = (r: Rehearsal): string | undefined => r.endDate ?? r.date;

/** The rehearsal is on this day — starts on it, ends on it, or runs through it. */
export const rehearsalOnDate = (r: Rehearsal, date: string): boolean =>
  Boolean(r.date) && (r.date ?? '') <= date && date <= (lastDateOf(r) ?? '');

/** Every day the rehearsal is on. */
export const rehearsalDates = (r: Rehearsal): string[] =>
  r.date ? datesBetween(r.date, lastDateOf(r) ?? r.date) : [];

/**
 * "19:00 — 22:00", and with the end's date when it is on another day:
 * "23:00 — 11 Sep, 01:00".
 */
export function rehearsalTimeLabel(r: Rehearsal, locale: string): string {
  const start = r.time?.substring(0, 5) || '';
  if (!r.endTime) return start;
  const end = r.endTime.substring(0, 5);
  const last = lastDateOf(r);
  if (!last || last === r.date) return `${start} — ${end}`;
  const endDay = formatDateLocalized(last, { day: 'numeric', month: 'short' }, locale);
  return `${start} — ${endDay}, ${end}`;
}
