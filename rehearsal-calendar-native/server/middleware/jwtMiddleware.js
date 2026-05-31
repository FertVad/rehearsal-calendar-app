import jwt from 'jsonwebtoken';
import db from '../database/db.js';

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
      '   Add to server/.env: JWT_SECRET=<your-secret>'
    );
  }
}

// Use provided secret or insecure dev default (only in non-production)
const SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-immediately';
const JWT_EXPIRES_IN = '30d'; // Access token expires in 30 days (mobile app convenience)
const REFRESH_TOKEN_EXPIRES_IN = '90d'; // Refresh token expires in 90 days

/**
 * Issue access + refresh tokens with the user's current token version embedded.
 * The version is checked against DB on every request — incrementing it
 * (logout, password change) invalidates all previously-issued tokens.
 */
export function generateTokens(userId, tokenVersion) {
  const tv = tokenVersion ?? 1;
  const accessToken = jwt.sign({ userId, tv, type: 'access' }, SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ userId, tv, type: 'refresh' }, SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
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

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token, 'access');
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify token_version matches current DB value (revocation check)
  const user = await db.get(
    'SELECT token_version FROM native_users WHERE id = $1',
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

  req.userId = decoded.userId;
  next();
}

// Alias for backwards compatibility
export const requireAuth = authenticateToken;
