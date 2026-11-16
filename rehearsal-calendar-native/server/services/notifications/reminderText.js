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
 * The time alone, on the reader's clock: "22:00", "10:00 PM", "22:00 UTC" —
 * the end of a rehearsal whose start stayed put, "теперь до 22:00" (T-250).
 */
export function clockTime(locale, instant, timeZone) {
  const zone = zoneOf(timeZone);
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.en;
  const time = new Intl.DateTimeFormat(tag, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(instant));
  return zone === 'UTC' ? `${time} UTC` : time;
}

/**
 * The end of a rehearsal, after "до", "until", "hasta", "bis" (T-256): the
 * time when it ends the day it starts; the time and "the next day" past
 * midnight — "до 1:00" read as the same night only to whoever worked it out;
 * and midnight itself as midnight, not "0:00 the next day". Both days are the
 * reader's, as `when` is.
 */
export function untilTime(locale, endsAt, startsAt, timeZone) {
  const zone = zoneOf(timeZone);
  const end = new Date(endsAt);
  const words = t(locale, 'until');
  const utc = zone === 'UTC';
  const time = clockTime(locale, end, timeZone);
  const endDay = dateIn(end, zone);
  if (endDay !== nextDate(dateIn(new Date(startsAt), zone))) return words.at(time);
  const midnight = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(end) === '00:00';
  return midnight ? words.midnight(utc) : words.nextDay(time);
}

/**
 * The date in a sentence. Spanish spells the day and the month out, with no
 * comma: "el martes 6 de octubre" — "el mar, 6 oct" read as "the sea" (T-256).
 */
function dateWords(locale, instant, zone) {
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.en;
  if (locale === 'es') {
    return new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' })
      .formatToParts(instant)
      .map(({ type, value }) => (type === 'literal' && value.trim() === ',' ? ' ' : value))
      .join('');
  }
  return new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(instant);
}

// A wording a language has no words of its own for reads as this one: only
// Russian says a moved rehearsal's span another way ("с 19:00 до 22:00"), only
// English capitalises the day in a title ("Rehearsal Tomorrow at 7:00 PM").
const WORDED_AS = { movedFrom: 'movedTo', titleWhen: 'when' };

/**
 * "сегодня в 22:00", "tomorrow at 10:00 AM", "am Mo., 6. Okt. um 19:00".
 *
 * @param {string} locale - 'ru' | 'en' | 'es' | 'de'; anything else reads as 'en'
 * @param {Date|string} startsAt - the rehearsal's start, as stored
 * @param {Date} now - when the reminder is sent
 * @param {string} timeZone - the reader's IANA zone
 * @param {'when'|'movedTo'|'movedFrom'|'titleWhen'} wording - "at" a time, or where
 *   a rehearsal was moved to: Spanish says "pasa al martes 6 de octubre",
 *   German "verlegt auf Di., 6. Okt., 19:00" — not "a el", not "auf am"
 *   (T-250); where it was moved to with its end said too, "теперь завтра с
 *   19:00" (T-256); or in a title, "Rehearsal Tomorrow at 7:00 PM" (T-256)
 */
export function reminderWhen(locale, startsAt, now, timeZone, wording = 'when') {
  const zone = zoneOf(timeZone);
  const start = new Date(startsAt);
  const words = t(locale, wording) || t(locale, WORDED_AS[wording]);

  const time = clockTime(locale, start, timeZone);

  const day = dateIn(start, zone);
  const today = dateIn(now, zone);
  if (day === today) return words.today(time);
  if (day === nextDate(today)) return words.tomorrow(time);
  return words.on(dateWords(locale, start, zone), time);
}
