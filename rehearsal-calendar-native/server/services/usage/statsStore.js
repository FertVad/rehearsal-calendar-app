/**
 * Where the usage statistics are written (T-294): the days someone used the
 * app, with its build, and the daily counts of each project's invitation.
 * Both tables come with migration 016 and keep 13 months.
 *
 * A statistic is never worth a request. Whatever happens to its write — 016
 * not applied yet, the database refusing — the request goes on as it would
 * have without it:
 * - 016 not applied: said once in the log, and nothing is tried again for a
 *   few minutes, so a server deployed before the migration does what it did
 *   before and starts recording within minutes of the owner applying it;
 * - any other failure: one line in the log, the message without the stack.
 */
import { logger } from '../../utils/logger.js';
import { utcDate } from '../../utils/dateIn.js';

const RECHECK_MS = 5 * 60 * 1000;
const PURGE_EVERY_MS = 60 * 60 * 1000;
const RETENTION_MONTHS = 13;

let absentUntil = 0;
let absenceReported = false;
let lastPurge = 0;

/** The table a statement names does not exist: PostgreSQL 42P01, or SQLite's wording in the fixtures. */
export function isMissingTable(error) {
  return error?.code === '42P01' || /no such table/i.test(String(error?.message || ''));
}

/** False while 016 is known to be missing; then nothing is tried. */
export const statsWritable = (now = Date.now()) => now >= absentUntil;

/**
 * Note a failed statistics write. Returns nothing and throws nothing: the
 * caller's request carries on.
 */
export function statsWriteFailed(what, error, now = Date.now()) {
  if (isMissingTable(error)) {
    absentUntil = now + RECHECK_MS;
    if (!absenceReported) {
      absenceReported = true;
      logger.warn('[Usage] Migration 016 is not applied: app days and invitation counts are not recorded');
    }
    return;
  }
  logger.warn(`[Usage] ${what} not recorded: ${String(error?.message || error).split('\n')[0]}`);
}

/** A write succeeded: 016 is there. */
export function statsWriteSucceeded() {
  absentUntil = 0;
  absenceReported = false;
}

/**
 * The first day still kept: the same date 13 months before today (UTC), or the
 * last day of that month when it is shorter (31 Dec → 30 Nov a year before).
 */
function keptFrom(now) {
  const today = new Date(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() - RETENTION_MONTHS;
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return utcDate(year, month, Math.min(today.getUTCDate(), lastOfMonth));
}

/**
 * Delete what is older than 13 months from both tables. There is no scheduler
 * (the crons are off): the admin page does it when it opens, and the writes
 * at most once an hour per server instance (purgeNowAndThen).
 * Throws when it fails — the admin decides what that means; a missing table is
 * reported as `false`.
 */
export async function purgeExpired(conn, now = Date.now()) {
  const cutoff = keptFrom(now);
  try {
    await conn.run('DELETE FROM native_usage_days WHERE day < $1', [cutoff]);
    await conn.run('DELETE FROM native_invite_counts WHERE day < $1', [cutoff]);
  } catch (error) {
    if (isMissingTable(error)) return false;
    throw error;
  }
  lastPurge = now;
  return true;
}

/** After a write: purge if this instance has not for an hour. Never throws. */
export async function purgeNowAndThen(conn, now = Date.now()) {
  if (now - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = now;
  try {
    await purgeExpired(conn, now);
  } catch (error) {
    statsWriteFailed('Expired statistics', error, now);
  }
}
