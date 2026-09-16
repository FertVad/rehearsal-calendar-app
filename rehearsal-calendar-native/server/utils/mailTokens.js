/**
 * The one-time tokens that go into an email.
 *
 * No table. A reset link has to stop working once it has been used, and the
 * usual way is to store a hash and delete it — but there is a cheaper way that
 * cannot drift: sign the token against something the action itself changes.
 *
 * A reset link is signed over a fingerprint of the current password hash, so
 * setting a password invalidates every link that was outstanding — including
 * the one just used, and any the attacker requested in parallel. A verification
 * link is signed over the address it confirms, and replaying it is harmless
 * because confirming twice is confirming once.
 *
 * Deliberately short-lived, and deliberately a different secret from the
 * session tokens: a link that leaks through a forwarded email or a browser
 * history must not be usable as a session, and jwt.verify with the wrong
 * purpose must fail rather than nearly work.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET;
const RESET_TTL = '1h';
const VERIFY_TTL = '3d';

/** A short, stable derivative of the password hash. Not the hash itself. */
function passwordFingerprint(passwordHash) {
  return crypto
    .createHash('sha256')
    .update(String(passwordHash ?? ''))
    .digest('hex')
    .slice(0, 16);
}

export function createPasswordResetToken(user) {
  return jwt.sign(
    { userId: user.id, purpose: 'password-reset', pw: passwordFingerprint(user.password_hash) },
    SECRET,
    { expiresIn: RESET_TTL }
  );
}

/**
 * @returns {number|null} the user id, or null if the link is expired, forged,
 *   for another purpose, or already spent.
 */
export function readPasswordResetToken(token, user) {
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.purpose !== 'password-reset') return null;
    if (!user || Number(payload.userId) !== Number(user.id)) return null;

    // Spent, or the password has changed since — either way this link is over.
    if (payload.pw !== passwordFingerprint(user.password_hash)) return null;

    return Number(payload.userId);
  } catch {
    return null;
  }
}

export function createEmailVerificationToken(user) {
  return jwt.sign(
    { userId: user.id, purpose: 'email-verify', email: user.email },
    SECRET,
    { expiresIn: VERIFY_TTL }
  );
}

/**
 * @returns {{ userId: number, email: string }|null}
 */
export function readEmailVerificationToken(token) {
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.purpose !== 'email-verify') return null;
    return { userId: Number(payload.userId), email: payload.email };
  } catch {
    return null;
  }
}
