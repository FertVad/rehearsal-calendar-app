/**
 * Resetting a forgotten password with an emailed code (R3: A01).
 *
 * The code proves the mailbox, and that settles who owns the address: a reset
 * is also how its owner takes back an account someone else registered with it.
 * So a confirmed reset works like a Google/Apple proof of the address — every
 * session, live code and push device of the account goes and the address
 * becomes verified — and then sets the new password.
 *
 * The request answers alike whether or not the address has an account: 202,
 * with no delivery outcome, and a code too soon after the last one is simply
 * not sent. Only a missing mail transport is said, before the address is looked
 * at. Registration tells anyway whether an address is taken (409), so the time
 * a send takes, or a wrong code against a live one, reveals nothing new.
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { generateTokens } from '../middleware/jwtMiddleware.js';
import { serializeUser, SESSION_USER_COLUMNS } from '../utils/userSerializer.js';
import { InputError, inputErrorBody, checkEmail, checkPassword } from '../utils/accountInput.js';
import { recordPasswordMethod } from '../utils/accountLinking.js';
import { emailTransport } from '../services/email/transport.js';
import { issueCode, checkCode, voidCodes, deliverCode, CodeRateLimited } from '../services/email/codes.js';
import { markVerified } from '../services/email/identity.js';

const router = Router();
const EMAIL_UNAVAILABLE = { error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE' };

router.post('/password-reset/request', asyncHandler(async (req, res) => {
  let email;
  try {
    email = checkEmail(req.body?.email);
  } catch (error) {
    if (error instanceof InputError) return res.status(400).json(inputErrorBody(error));
    throw error;
  }
  const transport = emailTransport();
  if (!transport.available) return res.status(503).json(EMAIL_UNAVAILABLE);

  let issued = null;
  try {
    issued = await db.transaction(async (tx) => {
      const user = await tx.get('SELECT id, email, locale FROM native_users WHERE email = $1 FOR UPDATE', [email]);
      if (!user) return null;
      return { user, code: await issueCode(tx, { userId: user.id, purpose: 'reset', email: user.email }) };
    });
  } catch (error) {
    // Too soon after the last code. Said to nobody: the answer would tell that
    // the address has an account.
    if (!(error instanceof CodeRateLimited)) throw error;
  }
  if (issued) {
    await deliverCode({ db, transport, codeId: issued.code.id, to: issued.user.email, code: issued.code.code,
      purpose: 'reset', locale: issued.user.locale });
  }
  res.status(202).json({ status: 'reset_requested' });
}));

router.post('/password-reset/confirm', asyncHandler(async (req, res) => {
  let email;
  let password;
  try {
    email = checkEmail(req.body?.email);
    password = checkPassword(req.body?.newPassword, 'newPassword');
  } catch (error) {
    if (error instanceof InputError) return res.status(400).json(inputErrorBody(error));
    throw error;
  }
  // bcrypt is the slow part; it runs before the lock is taken.
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  // A wrong code is returned, not thrown, so its spent attempt commits.
  const outcome = await db.transaction(async (tx) => {
    const user = await tx.get('SELECT id, email FROM native_users WHERE email = $1 FOR UPDATE', [email]);
    if (!user) return { status: 400, body: { error: 'The code is not valid', code: 'CODE_MISSING' } };
    const checked = await checkCode(tx, { userId: user.id, purpose: 'reset', email: user.email, code: req.body?.code, now });
    if (!checked.ok) return { status: 400, body: { error: 'The code is not valid', code: checked.reason } };

    // The mailbox is proven: whatever got into the account before goes.
    await tx.run(
      `UPDATE native_users SET password_hash = $2, token_version = token_version + 1,
         last_login_at = $3::timestamptz, updated_at = $3::timestamptz WHERE id = $1`,
      [user.id, passwordHash, now.toISOString()]
    );
    await recordPasswordMethod(tx, user.id);
    await voidCodes(tx, { userId: user.id, now });
    await tx.run('DELETE FROM native_push_tokens WHERE user_id = $1', [user.id]);
    await markVerified(tx, { userId: user.id, email: user.email, by: 'code', now });
    // Signed with the version this reset set, read under its lock (R3-06).
    return { status: 200, user: await tx.get(`SELECT ${SESSION_USER_COLUMNS} FROM native_users WHERE id = $1`, [user.id]) };
  });
  if (outcome.status !== 200) return res.status(outcome.status).json(outcome.body);

  const { accessToken, refreshToken } = generateTokens(outcome.user.id, outcome.user.token_version);
  res.json({ user: serializeUser(outcome.user), accessToken, refreshToken });
}));

export default router;
