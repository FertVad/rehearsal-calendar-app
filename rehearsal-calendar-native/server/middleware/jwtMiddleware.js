import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { asyncHandler } from './asyncHandler.js';
import { readTokenTtls } from '../config/tokenTtl.js';

// Fail-fast: Require JWT_SECRET in production
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isProduction) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production. ' +
      'Generate a secure secret: openssl rand -base64 32'
    );
  } else {
    console.warn(
      '⚠️  WARNING: JWT_SECRET not set. Using insecure default for development only.\n' +
      '   Generate a secret: openssl rand -base64 32\n' +
      '   Set JWT_SECRET in the process environment or an explicit SERVER_ENV_FILE'
    );
  }
}

// Use provided secret or insecure dev default (only in non-production)
const SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-immediately';
// Validate once before routes can perform writes and issue tokens. Passing
// numeric seconds also avoids jsonwebtoken treating unitless strings as ms.
const { accessSeconds, refreshSeconds } = readTokenTtls();

/**
 * Issue access + refresh tokens with the user's current token version embedded.
 * The version is checked against DB on every request — incrementing it
 * (logout, password change) invalidates all previously-issued tokens.
 */
export function generateTokens(userId, tokenVersion) {
  const tv = tokenVersion ?? 1;
  const accessToken = jwt.sign({ userId, tv, type: 'access' }, SECRET, {
    expiresIn: accessSeconds,
  });

  const refreshToken = jwt.sign({ userId, tv, type: 'refresh' }, SECRET, {
    expiresIn: refreshSeconds,
  });

  return { accessToken, refreshToken };
}

export function verifyToken(token, type = 'access') {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

export const authenticateToken = asyncHandler(async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token, 'access');
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify token_version matches current DB value (revocation check), and
  // read whether the address is pending with it.
  const user = await db.get(
    `SELECT u.token_version, i.status AS email_status FROM native_users u
     LEFT JOIN native_email_identities i ON i.user_id = u.id WHERE u.id = $1`,
    [decoded.userId]
  );
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }
  // Treat null token version as 1 (legacy users issued before this column existed)
  const dbVersion = user.token_version ?? 1;
  const tokenVer = decoded.tv ?? 1;
  if (tokenVer < dbVersion) {
    return res.status(401).json({ error: 'Session revoked' });
  }
  // No route issues a session to a pending account (R3: A01). Should one
  // exist anyway, it reaches nothing — PUT /me included, which would hand out
  // a fresh pair.
  if (user.email_status === 'pending') {
    return res.status(403).json({ error: 'Confirm your email address first', code: 'EMAIL_NOT_VERIFIED' });
  }

  req.userId = decoded.userId;
  req.tokenVersion = tokenVer;
  next();
});

export const SESSION_REVOKED = Object.freeze({ error: 'Session revoked' });

/**
 * Lock the signed-in user's row and confirm the session is still current.
 *
 * authenticateToken checks the version before the handler runs, outside any
 * lock. A revocation committed in between — a password removed because
 * Google or Apple proved the address (R3-01), a logout elsewhere — shows only
 * under the row lock. So a handler that changes credentials or the account
 * itself checks again here, or a request admitted just before the revocation
 * would act after it: set a first password on the account the rule had just
 * cleared, and keep it (review R3-09).
 *
 * @returns the locked row with the requested columns, or null when the
 *   session was revoked meanwhile
 */
export async function lockSession(tx, req, columns = 'id') {
  // FOR NO KEY UPDATE, not FOR UPDATE: it still waits for every writer of a
  // revocation (their FOR UPDATE, an UPDATE of the version), but not for the
  // FOR KEY SHARE a foreign key takes. With FOR UPDATE at the start of
  // DELETE /me, a rehearsal rebuild inserting this person's busy slot waited
  // for the user row while DELETE /me waited for the slots the rebuild had
  // deleted: a deadlock, and the account stayed (review R3-14).
  const row = await tx.get(`SELECT ${columns}, token_version FROM native_users WHERE id = $1 FOR NO KEY UPDATE`, [req.userId]);
  return row && (row.token_version ?? 1) <= req.tokenVersion ? row : null;
}

// Alias for backwards compatibility
export const requireAuth = authenticateToken;
