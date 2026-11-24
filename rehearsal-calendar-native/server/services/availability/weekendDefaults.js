/**
 * Weekends busy by default (T-406, owner's decision of 24.11.2026).
 *
 * "If a day is marked busy, whether by default or by the person, that is
 * enough for the planner": a weekend day is written into the person's
 * calendar as a real "busy all day" row, so the planner and everything else
 * that reads availability needs no rule of its own. The rows are told apart
 * by their source, 'weekend'; the admin does not count them as the person's
 * marks (services/admin/people.js, MARK_SOURCES).
 *
 * Whose weekend: the country of the profile's zone, not the language — a
 * Russian speaker in Israel rests on Friday and Saturday. The table is
 * shared/contracts/weekends.json (tzdata zone.tab, CLDR weekData); a zone
 * without a country (UTC, Etc/…, unknown) takes CLDR's "001", Saturday and
 * Sunday. The day of the week is the date's own, with no zone (CLAUDE.md 3).
 *
 * The rules:
 * - A row goes only on a weekend day without a mark of the person's own —
 *   busy, free or hours. Their marks are never touched. Imported events and
 *   rehearsals neither stop a row nor are stopped by one.
 * - A year ahead, from the person's today. Laid out up to native_users.
 *   weekends_through; later days are added after it and never before, so a
 *   weekend day the person cleared — the default replaced by their save and
 *   the save emptied — stays clear.
 * - Who adds them: whoever reads the availability. The server does not wake
 *   up on its own and the crons are off, so it is the reads that come before
 *   anyone could see a missing day: the person's own screen (GET
 *   /availability) and every planner (GET /:projectId/members/availability),
 *   which lays them out for each member it shows — someone who has not opened
 *   the app since the release is busy on their weekends all the same.
 *   A read that finds nothing to do (the usual case) costs one SELECT.
 * - A change of zone to another country moves them from today on, at the
 *   next read: weekends_days says which weekdays the rows were laid out for.
 * - The switch (native_users.weekends_busy, on for everyone): off takes the
 *   rows from today on away; on lays them out again from today on, on every
 *   weekend day without the person's own mark. Past days never change.
 * - Rows are unique on (user_id, external_event_id, source): two requests at
 *   once cannot write a day twice. Each layout runs under the person's row
 *   lock, the one every save of theirs takes (manualDays.js), in one
 *   transaction.
 * - A day is picked by the rule of deleteManualDay: an all-day row by its UTC
 *   date. Deletion names the source and the dates (CLAUDE.md 12).
 *
 * Without migration 017 the server works as before and writes none: said once
 * in the log; the switch answers 503.
 */
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { dateIn, addDays } from '../../utils/dateIn.js';
import { timestampToISO } from '../../utils/timezone.js';
import { AVAILABILITY_SOURCES, DEFAULT_TIMEZONE } from '../../constants/timezone.js';
import weekendTable from '../../../shared/contracts/weekends.json' with { type: 'json' };

export const HORIZON_DAYS = 365;
const SOURCE = AVAILABILITY_SOURCES.WEEKEND;
// An all-day row stands for a calendar date at UTC midnight (CLAUDE.md 3).
const WHOLE_DAY_ZONE = 'UTC';
const CHUNK = 100;

export class WeekendsUnavailable extends Error {
  constructor() {
    super('Weekend defaults are not available');
    this.code = 'WEEKENDS_UNAVAILABLE';
  }
}

/** The weekends_* columns do not exist: PostgreSQL 42703, or SQLite's wording in the fixtures. */
function isMissingColumn(error) {
  return error?.code === '42703' || /no such column/i.test(String(error?.message || ''));
}

let saidMissing = false;
function reportFailure(error, what) {
  if (isMissingColumn(error)) {
    if (!saidMissing) logger.warn('[Weekends] Migration 017 is not applied: weekends are not marked busy');
    saidMissing = true;
    return;
  }
  logger.error(`[Weekends] ${what}`, error);
}

/** The country of a zone by zone.tab, through its ICU name when not listed as given. */
function countryOf(timezone) {
  if (typeof timezone !== 'string' || !timezone) return undefined;
  if (Object.hasOwn(weekendTable.zones, timezone)) return weekendTable.zones[timezone];
  try {
    const resolved = new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone;
    return Object.hasOwn(weekendTable.zones, resolved) ? weekendTable.zones[resolved] : undefined;
  } catch {
    return undefined;
  }
}

/** The weekend of a zone's country, ISO weekdays (1 Monday … 7 Sunday); "001"'s without a country. */
export function weekendDaysOf(timezone) {
  const country = countryOf(timezone);
  const days = country && Object.hasOwn(weekendTable.weekends, country) ? weekendTable.weekends[country] : weekendTable.world;
  return [...days];
}

/** The ISO weekday of a 'YYYY-MM-DD', the date's own — no zone. */
export function isoWeekday(date) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

const isOn = (value) => value === true || value === 1 || value === '1' || value === 't';

function* datesFrom(first, last) {
  for (let date = first; date <= last; date = addDays(date, 1)) yield date;
}

/** Delete the default rows of these dates, or of every date from `from` on. */
export async function deleteWeekendDefaults(tx, userId, { dates, from }) {
  if (from !== undefined) {
    await tx.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1 AND source = $2 AND is_all_day = TRUE
       AND DATE(starts_at AT TIME ZONE $3) >= $4`,
      [userId, SOURCE, WHOLE_DAY_ZONE, from]
    );
    return;
  }
  for (let at = 0; at < dates.length; at += CHUNK) {
    const chunk = dates.slice(at, at + CHUNK);
    await tx.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1 AND source = $2 AND is_all_day = TRUE
       AND DATE(starts_at AT TIME ZONE $3) IN (${chunk.map((_, i) => `$${i + 4}`).join(', ')})`,
      [userId, SOURCE, WHOLE_DAY_ZONE, ...chunk]
    );
  }
}

/**
 * The dates between first and last that hold a mark of the person's own, by
 * deleteManualDay's rule: an all-day row on its UTC date, a timed one on its
 * date in the person's zone.
 */
async function ownMarkedDates(tx, userId, timezone, first, last) {
  const rows = await tx.all(
    `SELECT starts_at, is_all_day FROM native_user_availability
     WHERE user_id = $1 AND source = $2
     AND starts_at >= $3::timestamptz AND starts_at < $4::timestamptz`,
    [userId, AVAILABILITY_SOURCES.MANUAL, `${addDays(first, -1)}T00:00:00.000Z`, `${addDays(last, 2)}T00:00:00.000Z`]
  );
  return new Set(rows.map((row) => {
    const startsAt = timestampToISO(row.starts_at);
    return isOn(row.is_all_day) ? startsAt.slice(0, 10) : dateIn(Date.parse(startsAt), timezone);
  }));
}

async function insertDefaults(tx, userId, dates) {
  for (let at = 0; at < dates.length; at += CHUNK) {
    const chunk = dates.slice(at, at + CHUNK);
    const values = [];
    const rows = chunk.map((date, i) => {
      values.push(`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`, `${SOURCE}:${date}`);
      const n = 3 + i * 3;
      return `($1, $${n}::timestamptz, $${n + 1}::timestamptz, 'busy', TRUE, $2, $${n + 2})`;
    });
    // The key, not a lookup, keeps two requests at once from writing a day twice.
    await tx.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source, external_event_id)
       VALUES ${rows.join(', ')}
       ON CONFLICT (user_id, external_event_id, source) DO NOTHING`,
      [userId, SOURCE, ...values]
    );
  }
}

const USER_COLUMNS = `timezone, weekends_busy, CAST(weekends_through AS TEXT) AS through, weekends_days AS days`;

function plan(user, now) {
  const timezone = user.timezone || DEFAULT_TIMEZONE;
  const days = weekendDaysOf(timezone);
  const today = dateIn(now, timezone);
  return { timezone, days, key: days.join(','), today, horizon: addDays(today, HORIZON_DAYS) };
}

/** Something to lay out for this person: on, and not laid out a year ahead for their weekend. */
function needsLayout(user, now) {
  if (!isOn(user.weekends_busy)) return false;
  const { key, horizon } = plan(user, now);
  return !user.through || user.through < horizon || user.days !== key;
}

/**
 * Lay out one person's defaults up to a year ahead, under their row lock, in
 * the caller's transaction. `refill` lays every weekend day from today on
 * again (the switch turned on); otherwise only what is past weekends_through,
 * plus a move to another country's weekend.
 */
async function layOut(tx, userId, now, { refill = false } = {}) {
  const user = await tx.get(`SELECT ${USER_COLUMNS} FROM native_users WHERE id = $1 FOR NO KEY UPDATE`, [userId]);
  if (!user || !isOn(user.weekends_busy)) return;
  const { timezone, days, key, today, horizon } = plan(user, now);
  // The last date laid out, while it is not yet past.
  const laid = !refill && user.through && user.through >= today ? user.through : null;
  const wanted = [];
  if (laid && user.days !== key) {
    // Another country's weekend: from today to what was laid out, its old
    // days go and its new ones come. Days that are weekend in both stay as they are.
    const before = new Set(String(user.days ?? '').split(',').filter(Boolean).map(Number));
    const gone = [];
    for (const date of datesFrom(today, laid)) {
      const weekday = isoWeekday(date);
      if (before.has(weekday) && !days.includes(weekday)) gone.push(date);
      if (!before.has(weekday) && days.includes(weekday)) wanted.push(date);
    }
    await deleteWeekendDefaults(tx, userId, { dates: gone });
  }
  for (const date of datesFrom(laid ? addDays(laid, 1) : today, horizon)) {
    if (days.includes(isoWeekday(date))) wanted.push(date);
  }
  if (wanted.length) {
    const own = await ownMarkedDates(tx, userId, timezone, wanted[0], wanted[wanted.length - 1]);
    await insertDefaults(tx, userId, wanted.filter((date) => !own.has(date)));
  }
  await tx.run(
    'UPDATE native_users SET weekends_through = $2::date, weekends_days = $3 WHERE id = $1',
    [userId, laid && laid > horizon ? laid : horizon, key]
  );
}

/**
 * Before availability is read: lay out the defaults of these people where
 * they are not a year ahead. Never throws and never fails the read it comes
 * before — what is stored is then read as it is, and the failure is logged.
 */
export async function ensureWeekendDefaults(userIds, now = Date.now()) {
  if (!userIds.length) return;
  let users;
  try {
    users = await db.all(
      `SELECT id, ${USER_COLUMNS} FROM native_users WHERE id IN (${userIds.map((_, i) => `$${i + 1}`).join(', ')})`,
      userIds
    );
  } catch (error) {
    reportFailure(error, 'Could not read whose weekends to lay out');
    return;
  }
  for (const user of users) {
    if (!needsLayout(user, now)) continue;
    try {
      await db.transaction((tx) => layOut(tx, Number(user.id), now));
    } catch (error) {
      reportFailure(error, `Could not lay out the weekends of user ${user.id}`);
    }
  }
}

/** The switch and the days it is about. Throws WeekendsUnavailable without 017. */
export async function readWeekends(userId) {
  let user;
  try {
    user = await db.get('SELECT timezone, weekends_busy FROM native_users WHERE id = $1', [userId]);
  } catch (error) {
    if (isMissingColumn(error)) throw new WeekendsUnavailable();
    throw error;
  }
  if (!user) return null;
  return { enabled: isOn(user.weekends_busy), days: weekendDaysOf(user.timezone || DEFAULT_TIMEZONE) };
}

/**
 * Turn the switch on or off, in one transaction under the person's row lock:
 * off deletes the defaults from their today on, on lays them out again from
 * today on. Their own marks and past days stay.
 */
export async function setWeekendsBusy(userId, enabled, now = Date.now()) {
  try {
    return await db.transaction(async (tx) => {
      const user = await tx.get('SELECT timezone FROM native_users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
      if (!user) return null;
      const timezone = user.timezone || DEFAULT_TIMEZONE;
      await tx.run('UPDATE native_users SET weekends_busy = $2 WHERE id = $1', [userId, enabled]);
      if (enabled) await layOut(tx, userId, now, { refill: true });
      else await deleteWeekendDefaults(tx, userId, { from: dateIn(now, timezone) });
      return { enabled, days: weekendDaysOf(timezone) };
    });
  } catch (error) {
    if (isMissingColumn(error)) throw new WeekendsUnavailable();
    throw error;
  }
}
