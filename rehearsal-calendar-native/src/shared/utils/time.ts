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
