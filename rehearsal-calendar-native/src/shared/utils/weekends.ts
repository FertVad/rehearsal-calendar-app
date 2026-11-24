import table from '../../../shared/contracts/weekends.json';
import { formatDate } from './dateFormat';

// =============================================================================
// WHOSE WEEKENDS (T-406)
//
// The country of the profile's zone — not the language: a Russian speaker in
// Israel rests on Friday and Saturday — and its weekend by CLDR, from the
// table the server lays the busy days out by (shared/contracts/weekends.json,
// server/services/availability/weekendDefaults.js). A zone without a country
// takes Saturday and Sunday. Days are ISO weekdays, 1 Monday … 7 Sunday.
// =============================================================================

const zones: Record<string, string> = table.zones;
const weekends: Record<string, number[]> = table.weekends;

// The table names every zone of zone.tab and ICU's other names for them
// (Asia/Calcutta, Europe/Kiev): the names a phone and the profile's picker
// give. The server also resolves older ones ("Israel") through Intl.
function countryOf(timezone: string | undefined): string | undefined {
  return timezone && Object.prototype.hasOwnProperty.call(zones, timezone) ? zones[timezone] : undefined;
}

/** The weekend of the country of a zone, ISO weekdays. */
export function weekendDaysOf(timezone: string | undefined): number[] {
  const country = countryOf(timezone);
  return [...(country && Object.prototype.hasOwnProperty.call(weekends, country) ? weekends[country] : table.world)];
}

// A week whose dates are its weekdays: 5 January 2026 is a Monday.
const dateOfWeekday = (day: number) => `2026-01-${String(4 + day).padStart(2, '0')}`;

/**
 * The days' short names in the app's language, as Intl writes them inside a
 * sentence ("пт", "Fri", "vie", "Fr."; dateFormat.ts, T-028), joined by
 * `join` — the language's "и", "and".
 */
export function weekendDayNames(days: number[], language: string, join: (...names: string[]) => string): string {
  return join(...days.map((day) => formatDate(dateOfWeekday(day), 'weekdayShort', language, { midSentence: true })));
}
