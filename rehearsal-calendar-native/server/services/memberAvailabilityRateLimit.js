import { createRequire } from 'node:module';
import db, { isPostgres } from '../database/db.js';

const { requestsPerMinute } = createRequire(import.meta.url)(
  '../../shared/contracts/memberAvailabilityLimits.json'
);
const windowSeconds = 60;
// The extra value records rejection without ever growing the counter further.
const rejectedCount = requestsPerMinute + 1;

/**
 * One database row per authenticated user for this fixed operation. Projects,
 * IP addresses and caller-supplied strings cannot create additional buckets.
 * The UPSERT serializes competing instances on that row; both the window and
 * Retry-After use database time, never an application's potentially skewed clock.
 * A missing table, unavailable database or malformed result must reach the
 * caller as an error so it can fail closed before the availability query.
 */
export async function consumeMemberAvailabilityBudget(userId) {
  if (
    (typeof userId !== 'number' &&
      !(typeof userId === 'string' && /^[1-9]\d*$/.test(userId))) ||
    !Number.isSafeInteger(Number(userId)) || Number(userId) <= 0
  ) {
    throw new Error('Member availability budget requires an authenticated user ID');
  }

  const clock = isPostgres
    ? 'CAST(FLOOR(EXTRACT(EPOCH FROM statement_timestamp())) AS BIGINT)'
    : "CAST(strftime('%s', 'now') AS INTEGER)";
  const remaining = `window_start + ${windowSeconds} - (SELECT now_seconds FROM db_clock)`;
  const result = await db.get(
    `WITH db_clock AS (SELECT ${clock} AS now_seconds)
     INSERT INTO native_member_availability_rate_limits (user_id, window_start, request_count)
     SELECT ?, now_seconds - (now_seconds % ${windowSeconds}), 1
     FROM db_clock WHERE 1 = 1
     ON CONFLICT (user_id) DO UPDATE SET
       request_count = CASE
         WHEN native_member_availability_rate_limits.window_start < excluded.window_start THEN 1
         WHEN native_member_availability_rate_limits.request_count < ?
           THEN native_member_availability_rate_limits.request_count + 1
         ELSE native_member_availability_rate_limits.request_count
       END,
       window_start = CASE
         WHEN native_member_availability_rate_limits.window_start < excluded.window_start
           THEN excluded.window_start
         ELSE native_member_availability_rate_limits.window_start
       END
     RETURNING request_count,
       CAST(CASE
         WHEN ${remaining} > ${windowSeconds} THEN ${windowSeconds}
         WHEN ${remaining} < 1 THEN 1
         ELSE ${remaining}
       END AS INTEGER) AS retry_after`,
    [Number(userId), rejectedCount]
  );

  // A delayed statement from an older window must not reset a newer row. In
  // that case the SQL keeps the newer window and bounds its wait to one minute.
  if (
    !result || !Number.isInteger(result.request_count) ||
    result.request_count < 1 || result.request_count > rejectedCount ||
    !Number.isInteger(result.retry_after) ||
    result.retry_after < 1 || result.retry_after > windowSeconds
  ) {
    throw new Error('Invalid member availability budget storage result');
  }

  return {
    allowed: result.request_count <= requestsPerMinute,
    retryAfter: result.retry_after,
  };
}
