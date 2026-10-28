/**
 * A create repeated with the same Idempotency-Key creates once (R4, cause fix
 * 10: B02, D03).
 *
 * A create whose answer is lost — a timeout, a dropped connection — gets tapped
 * again, and each tap used to make another project or rehearsal. The client
 * sends a key with every create and keeps it until the create succeeds
 * (src/shared/hooks/useIdempotencyKey.ts). Here the key is recorded in the
 * transaction that creates, together with the answer; a repeat of the request
 * gets that answer back and creates nothing. Two requests with one key at
 * once: the second waits on the first one's row (migration 012's primary key)
 * and then replays it, or, if the first rolled back, creates.
 *
 * The same key with a different request is refused, not replayed: it is a
 * client bug, and answering with something other than what was asked would
 * hide it. A request without a key is not deduplicated, as before.
 */
import { createHash } from 'node:crypto';

const KEY = /^[A-Za-z0-9_-]{16,100}$/;
// Retries come within minutes; a day leaves room for an app resumed later.
const RETENTION_MS = 24 * 60 * 60 * 1000;

export class IdempotencyRefused extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'IdempotencyRefused';
    this.status = status;
    this.code = code;
  }

  get body() {
    return { error: this.message, code: this.code };
  }
}

/** The key a request carries; undefined when it carries none. */
export function idempotencyKeyOf(req) {
  const value = req.get('Idempotency-Key');
  if (value === undefined) return undefined;
  if (!KEY.test(value)) {
    throw new IdempotencyRefused(400, 'IDEMPOTENCY_KEY_INVALID',
      'Idempotency-Key must be 16 to 100 letters, digits, "-" or "_"');
  }
  return value;
}

/**
 * Runs `create` once per key, inside `tx` — the transaction that creates, so
 * the key and what it made commit or roll back together.
 *
 * @param {object} tx - The creating transaction
 * @param {object} request - userId, key (undefined: no deduplication),
 *   operation (what is created) and request (what was asked, compared on repeat)
 * @param {Function} create - Creates and returns the answer, a JSON value
 * @returns {Promise<{ response: any, replayed: boolean }>}
 */
export async function once(tx, { userId, key, operation, request }, create) {
  if (key === undefined) return { response: await create(), replayed: false };

  const fingerprint = createHash('sha256').update(JSON.stringify(request ?? null)).digest('hex');
  await tx.run(
    'DELETE FROM native_idempotency_keys WHERE user_id = $1 AND created_at < $2',
    [userId, new Date(Date.now() - RETENTION_MS).toISOString()]
  );
  const claimed = await tx.get(
    `INSERT INTO native_idempotency_keys (user_id, idempotency_key, operation, fingerprint)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, idempotency_key) DO NOTHING
     RETURNING user_id`,
    [userId, key, operation, fingerprint]
  );

  if (!claimed) {
    const prior = await tx.get(
      `SELECT operation, fingerprint, response FROM native_idempotency_keys
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, key]
    );
    if (!prior || prior.operation !== operation || prior.fingerprint !== fingerprint || prior.response == null) {
      throw new IdempotencyRefused(422, 'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different request');
    }
    return { response: JSON.parse(prior.response), replayed: true };
  }

  const response = await create();
  await tx.run(
    'UPDATE native_idempotency_keys SET response = $3 WHERE user_id = $1 AND idempotency_key = $2',
    [userId, key, JSON.stringify(response)]
  );
  return { response, replayed: false };
}
