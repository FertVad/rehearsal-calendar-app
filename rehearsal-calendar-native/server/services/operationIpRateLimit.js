import { createHmac } from 'node:crypto';
import db, { isPostgres } from '../database/db.js';
import { canonicalIpKey } from '../utils/canonicalIpKey.js';

const policies = Object.freeze({
  auth: Object.freeze({
    limit: 20,
    windowSeconds: 60,
    message: 'Too many requests, please try again later',
  }),
  admin_login: Object.freeze({
    limit: 5,
    windowSeconds: 900,
    message: 'Too many login attempts, please try again later',
  }),
});
const maximumIpKeys = 10000;
const pruneBatchSize = 64;
const ipTable = 'native_operation_ip_rate_limits';
const gateTable = 'native_operation_ip_rate_limit_gates';

// Server-owned operations only; this does not inspect the store at import or
// middleware construction. An uninitialized app can still serve health/HTML.
export function getOperationIpPolicy(operation) {
  if (typeof operation !== 'string' || !Object.hasOwn(policies, operation)) {
    throw new Error('Unknown operation IP budget');
  }
  return policies[operation];
}

function requireSharedStore() {
  if (!isPostgres && (process.env.NODE_ENV === 'production'
    || process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    throw new Error('Shared operation IP budget is unavailable');
  }
  if (!db || typeof db.transaction !== 'function') {
    throw new Error('Operation IP budget store is unavailable');
  }
}

function ipDigest(operation, ip) {
  const canonical = canonicalIpKey(ip);
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || !secret.trim())) {
    throw new Error('Operation IP budget signing configuration is unavailable');
  }
  // Same local fallback as jwtMiddleware/B04. All instances must share the real
  // secret; rotating it changes identities. Raw addresses never reach SQL.
  return createHmac('sha256', secret || 'dev-only-insecure-secret-change-immediately')
    .update('operation-ip-rate-limit\0').update(operation).update('\0')
    .update(canonical).digest('hex');
}

function clockSql() {
  return isPostgres
    ? 'CAST(FLOOR(EXTRACT(EPOCH FROM statement_timestamp())) AS BIGINT)'
    : "CAST(strftime('%s', 'now') AS INTEGER)";
}

function returningBudget(policy) {
  const remaining = 'reset_at - (SELECT now_seconds FROM db_clock)';
  return `RETURNING request_count,
    CAST(CASE
      WHEN ${remaining} > ${policy.windowSeconds} THEN ${policy.windowSeconds}
      WHEN ${remaining} < 1 THEN 1
      ELSE ${remaining}
    END AS INTEGER) AS retry_after`;
}

function budgetResult(row, policy) {
  if (!row || !Number.isInteger(row.request_count)
    || row.request_count < 1 || row.request_count > policy.limit + 1
    || !Number.isInteger(row.retry_after)
    || row.retry_after < 1 || row.retry_after > policy.windowSeconds) {
    throw new Error('Invalid operation IP budget storage result');
  }
  return {
    allowed: row.request_count <= policy.limit,
    remaining: Math.max(0, policy.limit - row.request_count),
    retryAfter: row.retry_after,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
  };
}

function gateCount(row) {
  if (!row || !Number.isInteger(row.key_count)
    || row.key_count < 0 || row.key_count > maximumIpKeys) {
    throw new Error('Invalid operation IP budget gate storage result');
  }
  return row.key_count;
}

async function updateIpBudget(tx, operation, key, policy) {
  // The first admission anchors the deadline. An older statement that waited
  // for a concurrent refresh cannot move the newer deadline backwards.
  return tx.get(
    `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
     UPDATE ${ipTable} SET
       request_count = CASE
         WHEN reset_at <= (SELECT now_seconds FROM db_clock) THEN 1
         WHEN request_count < ${policy.limit + 1} THEN request_count + 1
         ELSE request_count
       END,
       reset_at = CASE
         WHEN reset_at <= (SELECT now_seconds FROM db_clock)
           THEN (SELECT now_seconds FROM db_clock) + ${policy.windowSeconds}
         ELSE reset_at
       END
     WHERE operation = ? AND ip_key = ?
     ${returningBudget(policy)}`,
    [operation, key]
  );
}

/** Consume before account work, using one owned transaction per admission. */
export async function consumeOperationIpBudget(operation, ip) {
  const policy = getOperationIpPolicy(operation);
  requireSharedStore();
  const key = ipDigest(operation, ip);
  return db.transaction(async (tx) => {
    if (!tx || typeof tx.get !== 'function' || typeof tx.all !== 'function'
      || (isPostgres && typeof tx.run !== 'function')) {
      throw new Error('Operation IP budget transaction is unavailable');
    }
    if (isPostgres) {
      // Scoped to this transaction, including the existing-key path. This
      // cannot cancel pg.Pool acquisition or bound its queued resources.
      await tx.run("SET LOCAL lock_timeout = '1s'");
      await tx.run("SET LOCAL statement_timeout = '2s'");
    }
    const existing = await updateIpBudget(tx, operation, key, policy);
    if (existing !== undefined) return budgetResult(existing, policy);

    let count = gateCount(await tx.get(
      `SELECT key_count FROM ${gateTable} WHERE operation = ?${isPostgres ? ' FOR UPDATE' : ''}`,
      [operation]
    ));
    // Gate ownership serializes missing-key allocation. Recheck after waiting.
    const raced = await updateIpBudget(tx, operation, key, policy);
    if (raced !== undefined) return budgetResult(raced, policy);

    const removed = await tx.all(
      `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
       DELETE FROM ${ipTable}
       WHERE operation = ? AND ip_key IN (
         SELECT ip_key FROM ${ipTable}
         WHERE operation = ? AND reset_at <= (SELECT now_seconds FROM db_clock)
         ORDER BY reset_at, ip_key LIMIT ${pruneBatchSize}
       ) AND reset_at <= (SELECT now_seconds FROM db_clock)
       RETURNING ip_key`,
      [operation, operation]
    );
    // Preserve the outer expiry predicate: PostgreSQL rechecks it after a
    // candidate's concurrent refresh commits, so an active key is not evicted.
    if (!Array.isArray(removed) || removed.length > pruneBatchSize || removed.some(
      row => !row || typeof row.ip_key !== 'string' || !/^[0-9a-f]{64}$/.test(row.ip_key)
    ) || new Set(removed.map(row => row.ip_key)).size !== removed.length) {
      throw new Error('Invalid operation IP budget prune storage result');
    }
    if (removed.length) {
      const expected = count - removed.length;
      count = gateCount(await tx.get(
        `UPDATE ${gateTable} SET key_count = key_count - ?
         WHERE operation = ? AND key_count >= ? RETURNING key_count`,
        [removed.length, operation, removed.length]
      ));
      if (count !== expected) throw new Error('Invalid operation IP budget gate storage result');
    }
    if (count >= maximumIpKeys) throw new Error('Operation IP budget capacity unavailable');

    const created = await tx.get(
      `WITH db_clock AS (SELECT ${clockSql()} AS now_seconds)
       INSERT INTO ${ipTable} (operation, ip_key, reset_at, request_count)
       SELECT ?, ?, now_seconds + ${policy.windowSeconds}, 1 FROM db_clock
       ${returningBudget(policy)}`,
      [operation, key]
    );
    const result = budgetResult(created, policy);
    const nextCount = gateCount(await tx.get(
      `UPDATE ${gateTable} SET key_count = key_count + 1
       WHERE operation = ? AND key_count < ${maximumIpKeys} RETURNING key_count`,
      [operation]
    ));
    if (nextCount !== count + 1) throw new Error('Invalid operation IP budget gate storage result');
    return result;
  });
}
