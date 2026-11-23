/**
 * "YYYY-MM-DD" of an instant in a zone; UTC when the zone is missing or not
 * one the runtime knows. The admin reads someone's marks with it, and the
 * session check the day someone used the app (T-294): both are that person's
 * own calendar date (CLAUDE.md, rule 3).
 */
export function dateIn(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

const pad = (value, size) => String(value).padStart(size, '0');

/** "YYYY-MM-DD" of a UTC year, month (0-based, may overflow) and day (may overflow). */
export function utcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** A "YYYY-MM-DD" date moved by whole days. */
export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  return utcDate(year, month - 1, day + days);
}
