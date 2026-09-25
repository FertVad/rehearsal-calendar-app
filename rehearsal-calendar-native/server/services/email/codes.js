/**
 * One-time email codes: 6 digits, 15 minutes, 5 attempts, one live code per
 * person and purpose ('verify', 'reset', 'change', 'confirm').
 *
 * Only an HMAC is stored, keyed from the server secret, so a read of the table
 * does not hand out working codes. It binds the person, the purpose and the
 * address the code went to, and a check names the address it expects: a code
 * sent to an address the account no longer has is not accepted. Times come
 * from the application clock, the same one the expiry check uses.
 *
 * A code is created inside the caller's transaction and sent only after it
 * commits (deliverCode): the message is not part of the transaction, and what
 * the provider answered is recorded on the row, not assumed.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { codeMessage } from './messages.js';
import { logger } from '../../utils/logger.js';

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_INTERVAL_MS = 60 * 1000;
export const CODES_PER_HOUR = 5;

export class CodeRateLimited extends Error {
  constructor(retryAfterSeconds) {
    super('Too many codes requested');
    this.name = 'CodeRateLimited';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function codeKey() {
  const base = process.env.EMAIL_CODE_SECRET || process.env.JWT_SECRET;
  if (!base) throw new Error('No server secret for email codes');
  return createHmac('sha256', base).update('rehearsly-email-code-v1').digest();
}

export const PURPOSES = Object.freeze(['verify', 'reset', 'change', 'confirm']);

const hashCode = (userId, purpose, email, code) =>
  createHmac('sha256', codeKey()).update(JSON.stringify([userId, purpose, email, code])).digest('hex');

/**
 * Replace the live code of this purpose with a new one. Call inside a
 * transaction that holds the user's row lock.
 * @returns {Promise<{ id: number, code: string }>}
 * @throws {CodeRateLimited} within a minute of the last code or after five in an hour
 */
export async function issueCode(tx, { userId, purpose, email, now = new Date() }) {
  if (!PURPOSES.includes(purpose)) throw new Error(`Unknown code purpose ${purpose}`);
  const recent = await tx.all(
    `SELECT created_at FROM native_email_codes
     WHERE user_id = $1 AND purpose = $2 AND created_at > $3::timestamptz
     ORDER BY created_at DESC`,
    [userId, purpose, new Date(now.getTime() - 60 * 60 * 1000).toISOString()]
  );
  if (recent.length >= CODES_PER_HOUR) {
    const oldest = new Date(recent.at(-1).created_at).getTime();
    throw new CodeRateLimited(Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now.getTime()) / 1000)));
  }
  const since = recent.length ? now.getTime() - new Date(recent[0].created_at).getTime() : Infinity;
  if (since < RESEND_INTERVAL_MS) throw new CodeRateLimited(Math.ceil((RESEND_INTERVAL_MS - since) / 1000));

  await tx.run(
    'UPDATE native_email_codes SET consumed_at = $3::timestamptz WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL',
    [userId, purpose, now.toISOString()]
  );
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const result = await tx.run(
    `INSERT INTO native_email_codes (user_id, purpose, email, code_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)`,
    [userId, purpose, email, hashCode(userId, purpose, email, code),
      new Date(now.getTime() + CODE_TTL_MS).toISOString(), now.toISOString()]
  );
  return { id: result.lastInsertId, code };
}

/**
 * Check a submitted code against the live one, for the address the caller
 * expects it to have gone to. A wrong code is a result, not an exception: the
 * spent attempt has to commit with the caller's transaction.
 *
 * The row is read FOR UPDATE, so of two concurrent checks of one code the
 * second waits, then no longer sees a live row: exactly one succeeds.
 * @returns {Promise<{ ok: true, email: string } | { ok: false, reason: string }>}
 */
export async function checkCode(tx, { userId, purpose, email, code, now = new Date() }) {
  const live = await tx.get(
    `SELECT id, email, code_hash, attempts, expires_at FROM native_email_codes
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL FOR UPDATE`,
    [userId, purpose]
  );
  if (!live) return { ok: false, reason: 'CODE_MISSING' };
  // Issued for another address — before a change of address, say. Not an
  // attempt against this code, and not a way to use it.
  if (live.email !== email) return { ok: false, reason: 'CODE_MISSING' };
  if (new Date(live.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'CODE_EXPIRED' };

  const expected = Buffer.from(live.code_hash, 'hex');
  const given = typeof code === 'string' && /^\d{6}$/.test(code)
    ? Buffer.from(hashCode(userId, purpose, live.email, code), 'hex') : null;
  if (!given || !timingSafeEqual(expected, given)) {
    const attempts = live.attempts + 1;
    const burned = attempts >= MAX_ATTEMPTS;
    // The fifth wrong code burns this one; the person asks for a new one.
    if (burned) {
      await tx.run('UPDATE native_email_codes SET attempts = $1, consumed_at = $3::timestamptz WHERE id = $2',
        [attempts, live.id, now.toISOString()]);
    } else {
      await tx.run('UPDATE native_email_codes SET attempts = $1 WHERE id = $2', [attempts, live.id]);
    }
    return { ok: false, reason: burned ? 'CODE_LOCKED' : 'CODE_INVALID' };
  }
  await tx.run('UPDATE native_email_codes SET consumed_at = $2::timestamptz WHERE id = $1', [live.id, now.toISOString()]);
  return { ok: true, email: live.email };
}

/**
 * Void every live code of this person, whatever its purpose. A reset, a change
 * of address or an OAuth takeover call this under the user row lock, so no
 * code issued before the change can be used after it.
 */
export async function voidCodes(tx, { userId, now = new Date() }) {
  await tx.run(
    'UPDATE native_email_codes SET consumed_at = $2::timestamptz WHERE user_id = $1 AND consumed_at IS NULL',
    [userId, now.toISOString()]
  );
}

/**
 * Send a code whose transaction has committed, and record what the provider
 * said. Resolves to 'sent' (accepted by the provider) or 'failed'.
 */
export async function deliverCode({ db, transport, codeId, to, code, purpose, locale }) {
  const result = await transport.send({ ...codeMessage({ to, code, purpose, locale }), idempotencyKey: `rehearsly-code-${codeId}` });
  try {
    await db.run(
      `UPDATE native_email_codes SET ${result.ok ? 'sent_at' : 'failed_at'} = NOW() WHERE id = $1`,
      [codeId]
    );
  } catch (error) {
    logger.error('[Email] Could not record a delivery result:', error?.message);
  }
  return result.ok ? 'sent' : 'failed';
}
