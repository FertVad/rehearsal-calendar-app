import { getDateLocale } from './locale';
import { parseDateString } from './time';
import { formatRange } from './clockFormat';

// =============================================================================
// DATES ON THE SCREENS (T-028, owner's decision 02.11.2026)
//
// Every date a screen shows is one of the formats below, by name, and comes
// from here; `dateFormat.test.ts` fails on a `toLocaleDateString` anywhere
// else. Times and their intervals are clockFormat.ts.
//
// - The form is the language's own, as Intl writes it with getDateLocale:
//   "29 окт.", "Oct 29", "29. Okt.". Screens built dates from pieces — the
//   month from a list of names and the year after it — and wrote the same
//   month two ways: "октябрь 2026 г." over the strip, "Ноябрь 2026" in the
//   availability's months.
// - Case is one rule: the string begins with a capital, the rest is as Intl
//   gives it — "Чт, 29 окт.", "Ноябрь 2026 г.". A style that capitalized
//   every word made "Чт, 29 Окт." of it, and no style does now. A date
//   inside a sentence keeps Intl's own first letter (`midSentence`).
// =============================================================================

const FORMATS = {
  /** "Ноябрь 2026 г.", "November 2026", "Noviembre de 2026", "November 2026" */
  monthYear: { month: 'long', year: 'numeric' },
  /** "29 октября", "October 29", "29 de octubre", "29. Oktober" */
  dayMonth: { day: 'numeric', month: 'long' },
  /** "29 окт.", "Oct 29", "29 oct", "29. Okt." */
  dayMonthShort: { day: 'numeric', month: 'short' },
  /** "29 октября 2026 г.", "October 29, 2026", "29 de octubre de 2026", "29. Oktober 2026" */
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  /** "Четверг, 29 октября", "Thursday, October 29", "Jueves, 29 de octubre", "Donnerstag, 29. Oktober" */
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  /** "Чт, 29 окт.", "Thu, Oct 29", "Jue, 29 oct", "Do., 29. Okt." */
  weekdayDayMonthShort: { weekday: 'short', day: 'numeric', month: 'short' },
  /** "Чт", "Thu", "Jue", "Do" — over the day in a rehearsal row's date column (T-036). */
  weekdayShort: { weekday: 'short' },
  /** The day of the week, the day, the month and the year, all in full. */
  fullDate: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateFormatName = keyof typeof FORMATS;

export const DATE_FORMATS = Object.keys(FORMATS) as DateFormatName[];

/** A calendar date, 'YYYY-MM-DD', or a Date read by its local fields. */
export type CalendarDate = string | Date;

/** The string with a capital first letter, the rest untouched. */
const capitalized = (text: string, locale: string): string =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/**
 * A date in the app's language (`language`: 'ru', 'en', 'es', 'de'), in one
 * of the named formats.
 */
export function formatDate(
  date: CalendarDate,
  format: DateFormatName,
  language: string,
  { midSentence = false }: { midSentence?: boolean } = {},
): string {
  const locale = getDateLocale(language);
  // A calendar date, not an instant: new Date('2026-09-10') is the 9th west of UTC.
  const day = typeof date === 'string' ? parseDateString(date) : date;
  const text = day.toLocaleDateString(locale, FORMATS[format]);
  return midSentence ? text : capitalized(text, locale);
}

/** Two 'YYYY-MM-DD': "29 окт. – 4 нояб.", "Oct 29 – Nov 4" (clockFormat.ts). */
export const formatDateRange = (first: string, last: string, language: string): string =>
  formatRange('date', formatDate(first, 'dayMonthShort', language), formatDate(last, 'dayMonthShort', language));
