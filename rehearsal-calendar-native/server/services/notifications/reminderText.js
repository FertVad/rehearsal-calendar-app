/**
 * When a rehearsal starts, said for the person reading the reminder (R8: GR04).
 *
 * The reminders used to say "Rehearsal tomorrow" and "Rehearsal in 1 hour"
 * whenever they went out. The windows are wide on purpose — no scheduler is
 * punctual — so a day-before reminder sent thirteen hours ahead called this
 * evening "tomorrow", and an hour-before one caught ten minutes before the
 * start still said "in 1 hour". The words now come from the start itself, in
 * the reader's own time zone and language: today, tomorrow, or the date, and
 * the time. A time that is not the reader's local time says so: a person
 * whose zone the app has never synced, or whose stored zone is not one,
 * reads the time in UTC, marked "UTC".
 */
import { t } from '../../i18n/pushNotifications.js';

const LOCALE_TAGS = { ru: 'ru-RU', en: 'en-US', es: 'es-ES', de: 'de-DE' };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The zone's canonical name, or UTC when it is not a zone. Canonical, so that
 * `Etc/UTC`, `utc` and `Etc/GMT` are recognised as UTC and marked as such.
 */
function zoneOf(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return 'UTC';
  try {
    const canonical = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
    return ['Etc/UTC', 'Etc/GMT', 'GMT'].includes(canonical) ? 'UTC' : canonical;
  } catch {
    return 'UTC';
  }
}

/** The calendar date of an instant in a zone, as YYYY-MM-DD. */
const dateIn = (instant, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);

/** The calendar date after this one — date strings, no zone involved. */
const nextDate = (date) => new Date(Date.parse(`${date}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10);

/**
 * "сегодня в 22:00", "tomorrow at 10:00 AM", "am Mo., 6. Okt. um 19:00".
 *
 * @param {string} locale - 'ru' | 'en' | 'es' | 'de'; anything else reads as 'en'
 * @param {Date|string} startsAt - the rehearsal's start, as stored
 * @param {Date} now - when the reminder is sent
 * @param {string} timeZone - the reader's IANA zone
 */
export function reminderWhen(locale, startsAt, now, timeZone) {
  const zone = zoneOf(timeZone);
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.en;
  const start = new Date(startsAt);
  const words = t(locale, 'when');

  let time = new Intl.DateTimeFormat(tag, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(start);
  if (zone === 'UTC') time += ' UTC';

  const day = dateIn(start, zone);
  const today = dateIn(now, zone);
  if (day === today) return words.today(time);
  if (day === nextDate(today)) return words.tomorrow(time);
  const date = new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(start);
  return words.on(date, time);
}
