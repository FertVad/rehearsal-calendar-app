/**
 * Hand-entered availability, replaced a day at a time (R6: CC05, C02, C03).
 *
 * A save names the days it replaces — the days the person changed — and gives
 * each exactly the entries it now holds; [] clears it. The day is the key both
 * sides name (CLAUDE.md 12): nothing is replaced because the client happened
 * to hold a snapshot of it, which is how a day loaded an hour ago used to
 * overwrite an edit saved since from another device.
 *
 * - The whole request is checked before anything is deleted. A slot without an
 *   end used to empty its day and answer success (C02).
 * - One person's saves go one at a time: each takes their user row first, the
 *   lock order the rest of the server uses. Two saves of a still-empty day both
 *   deleted nothing and both inserted, leaving both versions (C03).
 * - Only manual rows are replaced; rehearsal and imported rows on the same day
 *   stay.
 */
import { AVAILABILITY_SOURCES } from '../../constants/timezone.js';

export const MAX_DAYS = 366;
export const MAX_ENTRIES_PER_DAY = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const MANUAL_TYPES = new Set(['available', 'busy']);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// A moment with its zone: local time plus offset, or UTC.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export class AvailabilityInvalid extends Error {
  constructor(reason, where = {}) {
    super('Availability is not valid');
    this.name = 'AvailabilityInvalid';
    this.reason = reason;
    this.where = where;
  }

  get body() {
    return { error: this.message, code: 'AVAILABILITY_INVALID', reason: this.reason, ...this.where };
  }
}

function isCalendarDate(value) {
  const match = typeof value === 'string' && DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function checkEntry(date, entry, index) {
  const refuse = (reason) => new AvailabilityInvalid(reason, { date, index });
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw refuse('ENTRY_NOT_OBJECT');
  const { startsAt, endsAt, type } = entry;
  const isAllDay = entry.isAllDay === undefined ? false : entry.isAllDay;
  if (typeof isAllDay !== 'boolean') throw refuse('ALL_DAY_NOT_BOOLEAN');
  if (!MANUAL_TYPES.has(type)) throw refuse('TYPE_INVALID');
  if (isAllDay) {
    // A whole day is a calendar date, stored as that date's UTC bounds.
    if (startsAt !== `${date}T00:00:00.000Z` || endsAt !== `${date}T23:59:59.999Z`) throw refuse('ALL_DAY_BOUNDS');
    return { startsAt, endsAt, type, isAllDay };
  }
  if (typeof startsAt !== 'string' || typeof endsAt !== 'string' || !INSTANT.test(startsAt) || !INSTANT.test(endsAt)) {
    throw refuse('TIME_INVALID');
  }
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw refuse('TIME_INVALID');
  if (end <= start) throw refuse('END_NOT_AFTER_START');
  // Through midnight is allowed; longer than a day is not one day's slot.
  if (end - start > DAY_MS) throw refuse('LONGER_THAN_A_DAY');
  // The slot starts on the day it is saved under, in the zone it was written in.
  if (startsAt.slice(0, 10) !== date) throw refuse('NOT_ON_THIS_DAY');
  return { startsAt, endsAt, type, isAllDay };
}

// What a client may write through the bulk path: hand-entered rows and the two
// calendar imports. Rehearsal rows are the server's own.
const BULK_SOURCES = new Set([AVAILABILITY_SOURCES.MANUAL, AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE]);

/**
 * The legacy bulk save, checked whole before anything is deleted (review
 * R6-01). Older apps still save hand-entered days through it: each such entry
 * meets the editor's own rules, on the day its start names. A slot without an
 * end used to empty that day and answer success (C02). Imported entries keep
 * their own handling (cause fix 4); only their source is checked here.
 */
export function checkBulkEntries(entries) {
  entries.forEach((entry, index) => {
    const source = entry.source || AVAILABILITY_SOURCES.MANUAL;
    if (!BULK_SOURCES.has(source)) throw new AvailabilityInvalid('SOURCE_INVALID', { index });
    if (source !== AVAILABILITY_SOURCES.MANUAL) return;
    const date = typeof entry.startsAt === 'string' ? entry.startsAt.slice(0, 10) : '';
    if (!isCalendarDate(date)) throw new AvailabilityInvalid('TIME_INVALID', { index });
    checkEntry(date, entry, index);
  });
}

/** The days of a save, checked whole before anything is written. */
export function checkDays(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_DAYS) throw new AvailabilityInvalid('DAYS_INVALID');
  const seen = new Set();
  return raw.map((day) => {
    if (!day || typeof day !== 'object' || !isCalendarDate(day.date)) throw new AvailabilityInvalid('DATE_INVALID');
    if (seen.has(day.date)) throw new AvailabilityInvalid('DATE_REPEATED', { date: day.date });
    seen.add(day.date);
    if (!Array.isArray(day.entries) || day.entries.length > MAX_ENTRIES_PER_DAY) {
      throw new AvailabilityInvalid('ENTRIES_INVALID', { date: day.date });
    }
    return { date: day.date, entries: day.entries.map((entry, index) => checkEntry(day.date, entry, index)) };
  });
}

/** One person's saves go one at a time; the user row first, as elsewhere. */
export async function lockOwnAvailability(tx, userId) {
  await tx.get('SELECT id FROM native_users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
}

/** Remove the hand-entered rows of one day, and only those. */
export async function deleteManualDay(tx, userId, date, timezone) {
  await tx.run(
    `DELETE FROM native_user_availability
     WHERE user_id = $1
     AND DATE(starts_at AT TIME ZONE $2) = $3
     AND source = $4`,
    [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
  );
}

/** Replace each checked day with exactly its entries. */
export async function replaceManualDays(tx, userId, days, timezone) {
  await lockOwnAvailability(tx, userId);
  for (const day of days) {
    await deleteManualDay(tx, userId, day.date, timezone);
    for (const entry of day.entries) {
      await tx.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
         VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6)`,
        [userId, entry.startsAt, entry.endsAt, entry.type, entry.isAllDay, AVAILABILITY_SOURCES.MANUAL]
      );
    }
  }
}
