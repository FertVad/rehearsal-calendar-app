/**
 * Parse YYYY-MM-DD string to Date without timezone conversion.
 * This prevents the issue where "2024-11-30" becomes "2024-11-29" due to UTC conversion.
 */
export const parseDateString = (dateStr: string): Date => {
  if (!dateStr || !dateStr.includes('-')) {
    return new Date();
  }
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

/**
 * Format Date to YYYY-MM-DD string without timezone conversion.
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Every calendar date from `first` to `last` inclusive, as 'YYYY-MM-DD'.
 *
 * Walked in UTC on purpose: these strings are calendar dates with no zone
 * meaning, and stepping local midnights breaks where the clocks change at
 * midnight — Santiago and Havana, both of which the Spanish build reaches.
 *
 * `maxDays` is a guard against a malformed range, not a real limit.
 */
export const datesBetween = (first: string, last: string, maxDays = 400): string[] => {
  if (!first) return [];
  if (!last || last < first) return [first];

  const out: string[] = [];
  const cursor = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);

  while (cursor <= end && out.length < maxDays) {
    out.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
};

/**
 * Format Date object to time string (HH:mm).
 */
export const formatDateToTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Parse time string (HH:mm) into Date object.
 * @param timeStr - Time string in HH:mm format
 * @param baseDate - Optional base date to use (defaults to current date)
 */
export const parseTimeString = (timeStr: string, baseDate?: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Convert time string (HH:mm) to minutes since midnight.
 * @example timeToMinutes('14:30') => 870
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:mm).
 * @example minutesToTime(870) => '14:30'
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const DAY_MINUTES = 24 * 60;

// =============================================================================
// CLOCK RANGES (cause fix 15)
//
// A rehearsal and a busy slot are intervals, not a date with two times. Every
// form picks a date, a start and an end on the clock; this is the one rule that
// turns those into an interval, for every form that has them:
//
// - an end after the start is on the same day: 10:00–18:00;
// - an end before the start is on the next day: 23:00–01:00 runs two hours into
//   the next morning, 22:00–00:00 ends at midnight;
// - an end equal to the start is no range at all — zero hours, or a whole day,
//   and nobody can tell which.
//
// The end used to be put on the start's date whatever it said, so 23:00–01:00
// went out ending before it began (DF04) and the editor's next-day branch was
// refused before it ran (CC06).
// =============================================================================

/** Start and end are the same moment on the clock: not a range. */
export const isEmptyClockRange = (start: string, end: string): boolean =>
  timeToMinutes(start) === timeToMinutes(end);

/** The end is on the day after the start. */
export const endsNextDay = (start: string, end: string): boolean =>
  timeToMinutes(end) < timeToMinutes(start);

/** The date the end of a range starting on `date` falls on. */
export const clockRangeEndDate = (date: string, start: string, end: string): string =>
  endsNextDay(start, end) ? addDays(date, 1) : date;

/**
 * The range as minutes from the start day's midnight: [start, end), with an end
 * on the next day past 24:00. Two ranges of one day compare on this axis, and a
 * range of the next day sits on it shifted by a day (`dayOffset` 1).
 */
export const clockRangeMinutes = (start: string, end: string, dayOffset = 0): [number, number] => {
  const from = timeToMinutes(start) + dayOffset * DAY_MINUTES;
  const to = timeToMinutes(end) + dayOffset * DAY_MINUTES;
  return [from, endsNextDay(start, end) ? to + DAY_MINUTES : to];
};

/** Two half-open minute ranges share time; touching ends do not. */
export const minuteRangesOverlap = (a: [number, number], b: [number, number]): boolean =>
  a[0] < b[1] && b[0] < a[1];

/**
 * Format YYYY-MM-DD string to localized date string (e.g., "25 ноября, понедельник").
 */
export const formatDateLocalized = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  },
  locale: string = 'ru-RU'
): string => {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString(locale, options);
};

/**
 * The calendar date `days` after `dateStr` ('YYYY-MM-DD'), stepped in UTC for
 * the reason datesBetween gives.
 */
export const addDays = (dateStr: string, days: number): string => {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

// =============================================================================
// TIMEZONE-AWARE FUNCTIONS (using date-fns-tz)
// =============================================================================

import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

// -----------------------------------------------------------------------------
// One zone in the app: the profile's (cause fix 14, owner's decision 16.10.2026)
// -----------------------------------------------------------------------------
//
// The zone is the one the person chose. Registration starts it at the device's;
// after that only the profile changes it — a flight does not. Everything the
// app shows or sends is read in it: rehearsal times, "today" and the day's
// bounds, busy hours, the planner, the events written to the phone's calendar.
// The server reads the same zone for reminder texts and a day's bounds.
//
// The client used to date rehearsals in the profile's zone and take "today",
// the form's pickers and busy hours from the device's, so where the two differed
// a past rehearsal counted as upcoming and an edit saved unchanged moved the
// rehearsal by the difference (review DF01). And sign-in put the device's zone
// back over the one chosen (review HP04).
//
// The native pickers and Date's local getters speak the device's zone, so what
// they show is a wall clock (wallClockIn): a Date whose local fields read what a
// clock in the profile's zone reads. It is never an instant; it becomes one only
// through dateTimeToISOInTimezone with the same zone.

/** The device's IANA zone; registration's default and nothing more. */
export const deviceTimezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/** The zone a profile's setting means: its own, or the device's while it has none. */
export const timezoneOf = (profileTimezone?: string | null): string =>
  profileTimezone || deviceTimezone() || 'UTC';

// The signed-in profile's zone. AuthContext writes it together with the user,
// so the screens (useTimezone, useClock.ts) and code outside React — the
// calendar export — read one value.
let profileTimezone: string | null = null;
const timezoneListeners = new Set<() => void>();

export const setProfileTimezone = (zone?: string | null): void => {
  const next = zone || null;
  if (next === profileTimezone) return;
  profileTimezone = next;
  timezoneListeners.forEach((listener) => listener());
};

export const onAppTimezone = (listener: () => void): (() => void) => {
  timezoneListeners.add(listener);
  return () => {
    timezoneListeners.delete(listener);
  };
};

/** The app's zone: the profile's, the device's only while the profile has none. */
export const appTimezone = (): string => timezoneOf(profileTimezone);

/**
 * What a clock in `timezone` reads at `at`, as a Date whose local fields say it:
 * for the pickers, formatDateToString and formatDateToTimeString. Not an instant.
 */
export const wallClockIn = (timezone: string, at: Date | string = new Date()): Date =>
  toZonedTime(at, timezone);

/** The date in `timezone` at `at`, 'YYYY-MM-DD'. */
export const todayIn = (timezone: string, at: Date = new Date()): string =>
  formatDateToString(wallClockIn(timezone, at));

/**
 * Convert ISO 8601 timestamp (UTC) to date string in user's timezone
 *
 * @param isoTimestamp - ISO 8601 timestamp in UTC (e.g., "2026-01-20T15:00:00.000Z")
 * @param timezone - User's IANA timezone (e.g., "Europe/Moscow", "America/New_York")
 * @returns Date string in YYYY-MM-DD format in user's timezone
 *
 * @example
 * isoToDateStringInTimezone("2026-01-20T21:00:00.000Z", "Europe/Moscow")
 * // Returns: "2026-01-21" (21:00 UTC = 00:00 next day in Moscow, UTC+3)
 *
 * @example
 * isoToDateStringInTimezone("2026-01-20T15:00:00.000Z", "Europe/Moscow")
 * // Returns: "2026-01-20" (15:00 UTC = 18:00 in Moscow)
 */
export const isoToDateStringInTimezone = (
  isoTimestamp: string,
  timezone: string
): string => {
  const date = new Date(isoTimestamp);
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
};

/**
 * Convert ISO 8601 timestamp (UTC) to time string in user's timezone
 *
 * @param isoTimestamp - ISO 8601 timestamp in UTC (e.g., "2026-01-20T15:00:00.000Z")
 * @param timezone - User's IANA timezone (e.g., "Europe/Moscow", "America/New_York")
 * @returns Time string in HH:mm format in user's timezone
 *
 * @example
 * isoToTimeStringInTimezone("2026-01-20T15:00:00.000Z", "Europe/Moscow")
 * // Returns: "18:00" (15:00 UTC = 18:00 Moscow time, UTC+3)
 *
 * @example
 * isoToTimeStringInTimezone("2026-01-20T18:00:00.000Z", "Europe/Moscow")
 * // Returns: "21:00" (18:00 UTC = 21:00 Moscow time)
 */
export const isoToTimeStringInTimezone = (
  isoTimestamp: string,
  timezone: string
): string => {
  const date = new Date(isoTimestamp);
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, 'HH:mm', { timeZone: timezone });
};

/**
 * A rehearsal's date and hours on the clock of `timezone`, read from its
 * instants. The server's own `date`, `time` and `endTime` are in the zone the
 * profile had when it answered; a screen left open across a change of zone
 * kept showing them (cause fix 14, review). Kept only for a row with no instants.
 */
export const onClockOf = <T extends { startsAt?: string; endsAt?: string; date?: string; time?: string; endTime?: string }>(
  rehearsal: T,
  timezone: string
): T => {
  if (!rehearsal.startsAt) return rehearsal;
  return {
    ...rehearsal,
    date: isoToDateStringInTimezone(rehearsal.startsAt, timezone),
    time: isoToTimeStringInTimezone(rehearsal.startsAt, timezone),
    endTime: rehearsal.endsAt ? isoToTimeStringInTimezone(rehearsal.endsAt, timezone) : rehearsal.endTime,
  };
};

/**
 * Convert local date/time in user's timezone to ISO 8601 timestamp (UTC)
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:mm format
 * @param timezone - User's IANA timezone (e.g., "Europe/Moscow")
 * @returns ISO 8601 timestamp string in UTC
 *
 * @example
 * dateTimeToISOInTimezone("2026-01-20", "18:00", "Europe/Moscow")
 * // Returns: "2026-01-20T15:00:00.000Z" (18:00 Moscow = 15:00 UTC, Moscow is UTC+3)
 *
 * @example
 * dateTimeToISOInTimezone("2026-01-20", "21:00", "Europe/Moscow")
 * // Returns: "2026-01-20T18:00:00.000Z" (21:00 Moscow = 18:00 UTC)
 */
export const dateTimeToISOInTimezone = (
  dateStr: string,
  timeStr: string,
  timezone: string
): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');

  // Read as text, not through a device-local Date: an hour the device's clocks
  // skip (its own spring-forward night) exists in another zone all the same.
  const utcDate = fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`,
    timezone
  );

  return utcDate.toISOString();
};

/** A clock range on a date as the interval it is, in a timezone (the rule above). */
export const clockRangeToISO = (
  dateStr: string,
  start: string,
  end: string,
  timezone: string
): { startsAt: string; endsAt: string } => ({
  startsAt: dateTimeToISOInTimezone(dateStr, start, timezone),
  endsAt: dateTimeToISOInTimezone(clockRangeEndDate(dateStr, start, end), end, timezone),
});

/**
 * The calendar dates an interval covers in a timezone, first to last. An end at
 * exactly midnight closes the day before; it does not put the interval on the
 * next day too.
 */
export const intervalDates = (
  startsAt: string,
  endsAt: string,
  timezone: string
): { first: string; last: string } => {
  const first = isoToDateStringInTimezone(startsAt, timezone);
  let last = isoToDateStringInTimezone(endsAt, timezone);
  if (last > first && isoToTimeStringInTimezone(endsAt, timezone) === '00:00') {
    last = addDays(last, -1);
  }
  return { first, last: last < first ? first : last };
};

/**
 * Check if a timestamp represents an all-day event based on time being 00:00
 *
 * @param isoTimestamp - ISO 8601 timestamp
 * @param timezone - User's IANA timezone
 * @returns True if the time is 00:00 in user's timezone
 */
export const isStartOfDayInTimezone = (
  isoTimestamp: string,
  timezone: string
): boolean => {
  const timeStr = isoToTimeStringInTimezone(isoTimestamp, timezone);
  return timeStr === '00:00';
};

/**
 * Check if a timestamp represents end of all-day event based on time being 23:59
 *
 * @param isoTimestamp - ISO 8601 timestamp
 * @param timezone - User's IANA timezone
 * @returns True if the time is 23:59 in user's timezone
 */
export const isEndOfDayInTimezone = (
  isoTimestamp: string,
  timezone: string
): boolean => {
  const timeStr = isoToTimeStringInTimezone(isoTimestamp, timezone);
  return timeStr === '23:59';
};
