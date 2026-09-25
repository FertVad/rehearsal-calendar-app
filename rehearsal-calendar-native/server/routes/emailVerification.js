/**
 * Confirming a sign-in address with an emailed code (R3: A01).
 *
 * Both endpoints take the password too. The code proves the mailbox; the
 * password proves it is the person who registered, so a code read by the
 * address's owner cannot confirm a stranger's registration of it. Wrong
 * credentials answer exactly as a failed login does.
 *
 * Works for a pending registration and for an account from before R3, whose
 * address was never proven; a confirmed address answers 409.
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { generateTokens } from '../middleware/jwtMiddleware.js';
import { serializeUser } from '../utils/userSerializer.js';
import { normalizeEmail } from '../utils/accountInput.js';
import { emailTransport } from '../services/email/transport.js';
import { issueCode, checkCode, deliverCode, CodeRateLimited } from '../services/email/codes.js';
import { identityOf, isVerified, markVerified } from '../services/email/identity.js';

const router = Router();
const INVALID_LOGIN = { error: 'Invalid email or password' };
const ALREADY_VERIFIED = { error: 'This address is already confirmed', code: 'ALREADY_VERIFIED' };

// The account whose password this is, or null. The hash is returned so the
// caller can check, under the row lock, that it has not changed since.
async function passwordHolder(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const user = await db.get('SELECT id, email, password_hash, locale FROM native_users WHERE email = $1', [email]);
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) return null;
  return user;
}

// Lock the user and confirm the password checked outside is still the one.
async function lockHolder(tx, holder) {
  const row = await tx.get('SELECT email, password_hash FROM native_users WHERE id = $1 FOR UPDATE', [holder.id]);
  return row && row.password_hash === holder.password_hash && row.email === holder.email;
}

router.post('/verify-email', asyncHandler(async (req, res) => {
  const holder = await passwordHolder(normalizeEmail(req.body?.email), req.body?.password);
  if (!holder) return res.status(401).json(INVALID_LOGIN);
  const now = new Date();

  // A wrong code is returned, not thrown, so its spent attempt commits.
  const outcome = await db.transaction(async (tx) => {
    if (!(await lockHolder(tx, holder))) return { status: 401, body: INVALID_LOGIN };
    if (isVerified(await identityOf(tx, holder.id), holder.email)) return { status: 409, body: ALREADY_VERIFIED };
    const checked = await checkCode(tx, { userId: holder.id, purpose: 'verify', email: holder.email, code: req.body?.code, now });
    if (!checked.ok) return { status: 400, body: { error: 'The code is not valid', code: checked.reason } };
    await markVerified(tx, { userId: holder.id, email: holder.email, by: 'code', now });
    await tx.run('UPDATE native_users SET last_login_at = NOW() WHERE id = $1', [holder.id]);
    return { status: 200 };
  });
  if (outcome.status !== 200) return res.status(outcome.status).json(outcome.body);

  const user = await db.get(
    `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
            notifications_enabled, email_notifications, week_start_day,
            onboarding_completed, created_at, token_version
     FROM native_users WHERE id = $1`,
    [holder.id]
  );
  const { accessToken, refreshToken } = generateTokens(user.id, user.token_version);
  res.json({ user: serializeUser(user), accessToken, refreshToken });
}));

router.post('/verify-email/resend', asyncHandler(async (req, res) => {
  const holder = await passwordHolder(normalizeEmail(req.body?.email), req.body?.password);
  if (!holder) return res.status(401).json(INVALID_LOGIN);
  const transport = emailTransport();
  if (!transport.available) {
    return res.status(503).json({ error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE' });
  }

  let issued;
  try {
    issued = await db.transaction(async (tx) => {
      if (!(await lockHolder(tx, holder))) return { status: 401, body: INVALID_LOGIN };
      if (isVerified(await identityOf(tx, holder.id), holder.email)) return { status: 409, body: ALREADY_VERIFIED };
      return { status: 202, code: await issueCode(tx, { userId: holder.id, purpose: 'verify', email: holder.email }) };
    });
  } catch (error) {
    if (!(error instanceof CodeRateLimited)) throw error;
    return res.status(429).json({ error: 'Wait before asking for another code', code: 'RATE_LIMITED',
      retryAfter: error.retryAfterSeconds });
  }
  if (issued.status !== 202) return res.status(issued.status).json(issued.body);

  const delivery = await deliverCode({ db, transport, codeId: issued.code.id, to: holder.email,
    code: issued.code.code, purpose: 'verify', locale: holder.locale });
  res.status(202).json({ status: 'code_sent', delivery });
}));

export default router;
