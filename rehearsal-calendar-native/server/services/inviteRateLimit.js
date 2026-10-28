import { createHmac } from 'node:crypto';
import { canonicalIpKey } from '../utils/canonicalIpKey.js';
import db, { isPostgres } from '../database/db.js';

const windowSeconds = 60;
const requestsPerMinute = 20;
const rejectedCount = requestsPerMinute + 1;
const maximumIpKeys = 10000;
const pruneBatchSize = 64;
const accountTable = 'native_invite_account_rate_limits';
const ipTable = 'native_invite_ip_rate_limits';
const gateTable = 'native_invite_ip_rate_limit_gate';

function requireSharedStore() {
  // The legacy database adapter can fall back to SQLite during startup. That
  // must never silently replace a configured shared PostgreSQL budget.
  if (!isPostgres && (process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    throw new Error('Configured PostgreSQL is unavailable for invite budget');
  }
}

function clockSql() {
  return isPostgres
    ? 'CAST(FLOOR(EXTRACT(EPOCH FROM statement_timestamp())) AS BIGINT)'
    : "CAST(strftime('%s', 'now') AS INTEGER)";
}

const currentWindow = `(SELECT now_seconds - (now_seconds % ${windowSeconds}) FROM db_clock)`;

function returningBudget() {
  const remaining = `window_start + ${windowSeconds} - (SELECT now_seconds FROM db_clock)`;
  return `RETURNING request_count,
    CAST(CASE
      WHEN ${remaining} > ${windowSeconds} THEN ${windowSeconds}
      WHEN ${remaining} < 1 THEN 1
      ELSE ${remaining}
    END AS INTEGER) AS retry_after`;
}

function budgetResult(row) {
  if (
    !row || !Number.isInteger(row.request_count) ||
    row.request_count < 1 || row.request_count > rejectedCount ||
    !Number.isInteger(row.retry_after) ||
    row.retry_after < 1 || row.retry_after > windowSeconds
  ) {
    throw new Error('Invalid invite budget storage result');
  }
  return {
    allowed: row.request_count <= requestsPerMinute,
    retryAfter: row.retry_after,
    remaining: Math.max(0, requestsPerMinute - row.request_count),
  };
}

function gateCount(row) {
  if (!row || !Number.isInteger(row.key_count) || row.key_count < 0 || row.key_count > maximumIpKeys) {
    throw new Error('Invalid invite IP budget gate storage result');
  }
  return row.key_count;
}

function ipDigest(ip) {
  const canonical = canonicalIpKey(ip);
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || !secret.trim())) {
    throw new Error('JWT_SECRET is required for production invite IP budgets');
  }
  // Same development fallback as jwtMiddleware; no new deployment secret.
  // Neither the normalized address nor the raw address reaches SQL or logs.
  return createHmac('sha256', secret || 'dev-only-insecure-secret-change-immediately')
    .update(canonical).digest('hex');
}

/** One persistent row per authenticated native user, across all join aliases. */
export async function consumeInviteAccountBudget(userId) {
  requireSharedStore();
  if (
    (typeof userId !== 'number' && !(typeof userId === 'string' && /^[1-9]\d*$/.test(userId))) ||
    !Number.isSafeInteger(Number(userId)) || Number(userId) <= 0
  ) {
    throw new Error('Invite account budget requires an authenticated user ID');
  }
  const row = await db.get(
    `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
     INSERT INTO ${accountTable} (user_id, window_start, request_count)
     SELECT ?, ${currentWindow}, 1 FROM db_clock WHERE 1 = 1
     ON CONFLICT (user_id) DO UPDATE SET
       request_count = CASE
         WHEN ${accountTable}.window_start < excluded.window_start THEN 1
         WHEN ${accountTable}.request_count < ${rejectedCount} THEN ${accountTable}.request_count + 1
         ELSE ${accountTable}.request_count
       END,
       window_start = CASE
         WHEN ${accountTable}.window_start < excluded.window_start THEN excluded.window_start
         ELSE ${accountTable}.window_start
       END
     ${returningBudget()}`,
    [Number(userId)]
  );
  return budgetResult(row);
}

async function updateIpBudget(client, key) {
  // Atomic fast path: established identities never take the allocation gate.
  // A statement with an older DB timestamp cannot reopen a newer window.
  return client.get(
    `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
     UPDATE ${ipTable} SET
       request_count = CASE
         WHEN window_start < ${currentWindow} THEN 1
         WHEN request_count < ${rejectedCount} THEN request_count + 1
         ELSE request_count
       END,
       window_start = CASE
         WHEN window_start < ${currentWindow} THEN ${currentWindow}
         ELSE window_start
       END
     WHERE ip_key = ?
     ${returningBudget()}`,
    [key]
  );
}

/** Shared IP budget for preview and both join paths, with bounded cardinality. */
export async function consumeInviteIpBudget(ip) {
  requireSharedStore();
  const key = ipDigest(ip);
  const existing = await updateIpBudget(db, key);
  if (existing !== undefined) return budgetResult(existing);

  return db.transaction(async (tx) => {
    // PostgreSQL allocations/pruning serialize on one row until commit.
    // SQLite relies on the existing adapter transaction; concurrent callers
    // may fail closed because that adapter does not queue async transactions.
    let count = gateCount(await tx.get(
      `SELECT key_count FROM ${gateTable} WHERE id = 1${isPostgres ? ' FOR UPDATE' : ''}`
    ));

    // Another allocator may have created this key while this one waited.
    const raced = await updateIpBudget(tx, key);
    if (raced !== undefined) return budgetResult(raced);

    const removed = await tx.all(
      `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
       DELETE FROM ${ipTable}
       WHERE ip_key IN (
         SELECT ip_key FROM ${ipTable}
         WHERE window_start < ${currentWindow}
         ORDER BY window_start, ip_key LIMIT ${pruneBatchSize}
       ) AND window_start < ${currentWindow}
       RETURNING ip_key`
    );
    // The outer expiry predicate is essential: a concurrent fast-path UPDATE
    // may refresh a candidate after DELETE's snapshot chose it. PostgreSQL
    // rechecks the outer predicate after waiting for that row's writer.
    if (!Array.isArray(removed) || removed.length > pruneBatchSize || removed.some(
      (row) => !row || typeof row.ip_key !== 'string' || !/^[0-9a-f]{64}$/.test(row.ip_key)
    ) || new Set(removed.map((row) => row.ip_key)).size !== removed.length) {
      throw new Error('Invalid invite IP budget prune storage result');
    }
    if (removed.length) {
      const expected = count - removed.length;
      count = gateCount(await tx.get(
        `UPDATE ${gateTable} SET key_count = key_count - ? WHERE id = 1 AND key_count >= ? RETURNING key_count`,
        [removed.length, removed.length]
      ));
      if (count !== expected) throw new Error('Invalid invite IP budget gate storage result');
    }
    if (count >= maximumIpKeys) throw new Error('Invite IP budget capacity unavailable');

    const created = await tx.get(
      `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
       INSERT INTO ${ipTable} (ip_key, window_start, request_count)
       SELECT ?, ${currentWindow}, 1 FROM db_clock
       ${returningBudget()}`,
      [key]
    );
    const result = budgetResult(created);
    const nextCount = gateCount(await tx.get(
      `UPDATE ${gateTable} SET key_count = key_count + 1 WHERE id = 1 AND key_count < ${maximumIpKeys} RETURNING key_count`
    ));
    if (nextCount !== count + 1) throw new Error('Invalid invite IP budget gate storage result');
    return result;
  });
}
