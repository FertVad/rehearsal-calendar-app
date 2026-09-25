/**
 * Changing the sign-in address (R3: HP01).
 *
 * PUT /me used to drop a new email while the app said "saved"; it now refuses
 * one and points here. A session is not enough to move an account: a stolen
 * token and the thief's own mailbox would take it. So the request needs the
 * current password, or — for an account without one (Google/Apple only) — a
 * code sent to the current address, and the change takes effect only with the
 * code sent to the new address, which proves that mailbox.
 *
 * The address waiting for confirmation is the one the live 'change' code went
 * to: one live code per purpose, so a new request replaces the target.
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, generateTokens, lockSession, SESSION_REVOKED } from '../middleware/jwtMiddleware.js';
import { serializeUser, SESSION_USER_COLUMNS } from '../utils/userSerializer.js';
import { InputError, inputErrorBody, checkEmail } from '../utils/accountInput.js';
import { emailTransport } from '../services/email/transport.js';
import { addressChangedMessage } from '../services/email/messages.js';
import { issueCode, checkCode, voidCodes, deliverCode, CodeRateLimited } from '../services/email/codes.js';
import { markVerified } from '../services/email/identity.js';
import { logger } from '../utils/logger.js';

const router = Router();
const EMAIL_TAKEN = { error: 'An account with this email already exists', code: 'EMAIL_TAKEN', field: 'newEmail' };
const refused = (status, body) => ({ status, body });

router.post('/me/email/change', requireAuth, asyncHandler(async (req, res) => {
  let newEmail;
  try {
    newEmail = checkEmail(req.body?.newEmail);
  } catch (error) {
    if (error instanceof InputError) return res.status(400).json({ ...inputErrorBody(error), field: 'newEmail' });
    throw error;
  }
  const transport = emailTransport();
  if (!transport.available) return res.status(503).json({ error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE' });

  let outcome;
  try {
    outcome = await db.transaction(async (tx) => {
      const user = await lockSession(tx, req, 'email, password_hash, locale');
      if (!user) return refused(401, SESSION_REVOKED);
      if (newEmail === user.email) {
        return refused(400, { error: 'This is already your address', code: 'EMAIL_UNCHANGED', field: 'newEmail' });
      }
      // The password proves the account holder; without one, a code to the
      // current address does. A code to the new address proves only that mailbox.
      if (user.password_hash) {
        const proof = req.body?.currentPassword;
        if (typeof proof !== 'string' || !(await bcrypt.compare(proof, user.password_hash))) {
          return refused(403, { error: 'Current password is incorrect', code: 'CURRENT_PASSWORD_INVALID', field: 'currentPassword' });
        }
      }
      if (await tx.get('SELECT id FROM native_users WHERE email = $1', [newEmail])) return refused(409, EMAIL_TAKEN);
      const change = await issueCode(tx, { userId: req.userId, purpose: 'change', email: newEmail });
      const confirm = user.password_hash ? null
        : await issueCode(tx, { userId: req.userId, purpose: 'confirm', email: user.email });
      return { status: 202, user, change, confirm };
    });
  } catch (error) {
    if (!(error instanceof CodeRateLimited)) throw error;
    return res.status(429).json({ error: 'Wait before asking for another code', code: 'RATE_LIMITED',
      retryAfter: error.retryAfterSeconds });
  }
  if (outcome.status !== 202) return res.status(outcome.status).json(outcome.body);

  const { user, change, confirm } = outcome;
  const delivery = { newAddress: await deliverCode({ db, transport, codeId: change.id, to: newEmail, code: change.code,
    purpose: 'change', locale: user.locale }) };
  if (confirm) {
    delivery.currentAddress = await deliverCode({ db, transport, codeId: confirm.id, to: user.email, code: confirm.code,
      purpose: 'confirm', locale: user.locale });
  }
  res.status(202).json({ status: 'codes_sent', currentCodeRequired: Boolean(confirm), delivery });
}));

router.post('/me/email/change/confirm', requireAuth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    let outcome;
    try {
      // A wrong code is returned, not thrown, so its spent attempt commits.
      outcome = await db.transaction(async (tx) => {
        const user = await lockSession(tx, req, 'email, password_hash, locale');
        if (!user) return refused(401, SESSION_REVOKED);
        const pending = await tx.get(
          "SELECT email FROM native_email_codes WHERE user_id = $1 AND purpose = 'change' AND consumed_at IS NULL",
          [req.userId]
        );
        if (!pending) return refused(400, { error: 'The code is not valid', code: 'CODE_MISSING', field: 'code' });
        // Without a password the current address is proven first, so a wrong
        // current code leaves the new-address code unspent.
        if (!user.password_hash) {
          const current = await checkCode(tx, { userId: req.userId, purpose: 'confirm', email: user.email,
            code: req.body?.currentCode, now });
          if (!current.ok) return refused(400, { error: 'The code is not valid', code: current.reason, field: 'currentCode' });
        }
        const checked = await checkCode(tx, { userId: req.userId, purpose: 'change', email: pending.email,
          code: req.body?.code, now });
        if (!checked.ok) return refused(400, { error: 'The code is not valid', code: checked.reason, field: 'code' });
        if (await tx.get('SELECT id FROM native_users WHERE email = $1 AND id <> $2', [checked.email, req.userId])) {
          return refused(409, EMAIL_TAKEN);
        }

        // One transaction: the address, its proof, its sign-in method row; every
        // other session and every live code goes. This device gets a new pair.
        await tx.run(
          'UPDATE native_users SET email = $2, token_version = token_version + 1, updated_at = $3::timestamptz WHERE id = $1',
          [req.userId, checked.email, now.toISOString()]
        );
        await markVerified(tx, { userId: req.userId, email: checked.email, by: 'code', now });
        await tx.run(
          "UPDATE native_auth_providers SET provider_email = $2, updated_at = $3::timestamptz WHERE user_id = $1 AND provider_type = 'email'",
          [req.userId, checked.email, now.toISOString()]
        );
        await voidCodes(tx, { userId: req.userId, now });
        return { status: 200, oldEmail: user.email, locale: user.locale,
          user: await tx.get(`SELECT ${SESSION_USER_COLUMNS} FROM native_users WHERE id = $1`, [req.userId]) };
      });
    } catch (error) {
      // Registered by someone else while this waited: the unique key decides.
      if (error?.code !== '23505') throw error;
      outcome = refused(409, EMAIL_TAKEN);
    }
    if (outcome.status !== 200) return res.status(outcome.status).json(outcome.body);

    // The old address hears about it; the change stands whatever the provider says.
    const transport = emailTransport();
    const notice = await transport.send(addressChangedMessage({ to: outcome.oldEmail, newAddress: outcome.user.email,
      locale: outcome.locale }));
    if (!notice.ok) logger.warn(`[EmailChange] Notice to the old address not sent: ${notice.reason}`);

    const { accessToken, refreshToken } = generateTokens(outcome.user.id, outcome.user.token_version);
    res.json({ user: serializeUser(outcome.user), accessToken, refreshToken });
  }));

export default router;
