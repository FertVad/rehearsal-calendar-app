import { getCalendars, useCalendars } from 'expo-localization';

// =============================================================================
// TIMES AND INTERVALS ON THE SCREENS (T-017, owner's decision 30.10.2026)
//
// Every time a screen shows, and the time picker's wheel, go through here.
// What is stored and sent stays "HH:MM" and ISO; only the text changes.
//
// - 12 or 24 hours is the phone's setting (HIG: "Respect people's systemwide
//   settings"). Every time was printed as "HH:MM", and the wheel took the app's
//   language for its locale, so in English it was always 12-hour and in Russian
//   always 24-hour, whatever the phone said.
// - An interval is written one way (HIG: "Build language patterns"). The
//   screens had "09:00-10:00", "18:00 — 21:00" and "29 Oct - 4 Nov".
//   Times: "18:00–21:00", an en dash with no spaces. Anything with a date in
//   it: "29 Oct – 4 Nov", an en dash with spaces (formatDateRange, dateFormat.ts).
//
// Server notification texts are not this: the server does not know the phone.
// =============================================================================

/**
 * The phone is set to the 24-hour clock, as it is at the moment of the call:
 * for what is written once and not kept, like an alert's text.
 */
export const phoneUses24HourClock = (): boolean =>
  getCalendars()[0]?.uses24hourClock ?? true;

/**
 * The same setting for a screen: it renders again when the setting is changed
 * while the app is open (expo-localization's calendar listener). A screen
 * passes it on to the helpers below and keeps it in the deps of anything it
 * memoizes with a time in it; a default read in a render goes stale in a memo
 * and in a memoized row (review T-017 r1).
 */
export const usePhoneUses24HourClock = (): boolean =>
  useCalendars()[0]?.uses24hourClock ?? true;

/**
 * A stored "HH:MM" (or "HH:MM:SS") as the screens show it: "18:00" on a
 * 24-hour phone, "6:00 PM" — in the app's language — on a 12-hour one.
 */
export function formatClock(time: string | undefined, locale: string, uses24 = phoneUses24HourClock()): string {
  const hhmm = time?.substring(0, 5) || '';
  if (uses24 || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2000, 0, 1, hours, minutes)).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

const TIME_DASH = '–';
const DATE_DASH = ' – ';

/**
 * The one way two ends of an interval are joined, already formatted:
 * 'time' for two clock times, 'date' when either end has a date in it.
 */
export const formatRange = (kind: 'time' | 'date', from: string, to: string): string =>
  `${from}${kind === 'time' ? TIME_DASH : DATE_DASH}${to}`;

/** Two stored "HH:MM": "18:00–21:00", or "6:00 PM–9:00 PM". */
export const formatTimeRange = (start: string, end: string, locale: string, uses24 = phoneUses24HourClock()): string =>
  formatRange('time', formatClock(start, locale, uses24), formatClock(end, locale, uses24));

/**
 * The locale the time picker's wheel is given: the app's language, with the
 * phone's hour cycle. iOS ignores `is24Hour`, and a bare language tag brings
 * that language's own default instead of the phone's setting.
 */
export const timePickerLocale = (language: string, uses24 = phoneUses24HourClock()): string =>
  `${language.replace('-', '_')}@hours=${uses24 ? 'h23' : 'h12'}`;

/**
 * The time wheel's minute step for the time it opens at: five minutes (HIG:
 * "less granularity when specifying minutes"), and one for a time off that
 * step, which UIKit would otherwise round on the wheel.
 */
export const wheelMinuteInterval = (opensAt: Date): 1 | 5 =>
  opensAt.getMinutes() % 5 === 0 ? 5 : 1;
