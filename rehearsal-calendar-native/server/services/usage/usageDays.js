/**
 * The days someone used the app (T-294), recorded by the session check.
 *
 * The app does nothing in the background (no BackgroundFetch, no TaskManager),
 * so a request in someone's session means the app is open. The day is theirs:
 * their stored zone, read in the session check's own SELECT, UTC without one.
 * The row keeps the build the app named that day, the last one when it changed
 * (an update in the middle of the day); a request naming none keeps it.
 *
 * At most one write per person per day on a server instance: this process
 * remembers the day and build it wrote for each person, and the key
 * (user_id, day) makes the instances' writes one row.
 */
import db from '../../database/db.js';
import { dateIn } from '../../utils/dateIn.js';
import { purgeNowAndThen, statsWritable, statsWriteFailed, statsWriteSucceeded } from './statsStore.js';

const MAX_INT = 2147483647;
const REMEMBERED = 50000;
const written = new Map();

/**
 * Record that this person used the app today. Never throws and never fails
 * the request it rides on.
 */
export async function recordUsageDay(userId, timeZone, build, now = Date.now()) {
  if (!statsWritable(now)) return;
  const day = dateIn(now, timeZone);
  const appBuild = Number.isSafeInteger(build) && build <= MAX_INT ? build : null;
  const before = written.get(userId);
  const sameDay = before?.day === day;
  if (sameDay && (appBuild === null || appBuild === before.build)) return;
  try {
    await db.get(
      `INSERT INTO native_usage_days (user_id, day, app_build) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, day) DO UPDATE SET app_build = COALESCE(EXCLUDED.app_build, native_usage_days.app_build)
       RETURNING user_id`,
      [userId, day, appBuild]
    );
  } catch (error) {
    statsWriteFailed('App day', error, now);
    return;
  }
  statsWriteSucceeded();
  // A full map is cleared, not grown: the worst a clear costs is one more
  // upsert per person that day.
  if (written.size >= REMEMBERED) written.clear();
  written.set(userId, { day, build: appBuild ?? (sameDay ? before.build : null) });
  await purgeNowAndThen(db, now);
}
