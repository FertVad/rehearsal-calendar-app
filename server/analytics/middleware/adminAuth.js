// Admin authentication middleware
// Protects admin endpoints with password authentication

import jwt from 'jsonwebtoken';

// Session expiry time: 24 hours
const SESSION_EXPIRY = '24h';

/**
 * Get JWT secret from environment
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'fallback-secret-change-in-production';

  if (secret === 'fallback-secret-change-in-production') {
    console.warn('[Admin Auth] Using fallback JWT secret - set JWT_SECRET in environment variables!');
  }

  return secret;
}

/**
 * Validate admin password
 */
function validatePassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('[Admin Auth] ADMIN_PASSWORD not set in environment');
    return false;
  }

  return password === adminPassword;
}

/**
 * Create JWT token
 */
function createToken() {
  const payload = {
    admin: true,
    iat: Math.floor(Date.now() / 1000)
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: SESSION_EXPIRY
  });

  const decoded = jwt.decode(token);
  const expiresAt = decoded.exp * 1000;

  return { token, expiresAt };
}

/**
 * Validate JWT token
 */
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded.admin === true;
  } catch (err) {
    return false;
  }
}

/**
 * Middleware: Require admin authentication
 * Checks for JWT token in Authorization header
 */
export function requireAdminAuth(req, res, next) {
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  if (!validateToken(token)) {
    return res.status(401).json({
      success: false,
      error: 'Token expired or invalid',
      code: 'INVALID_TOKEN'
    });
  }

  // Token is valid
  req.adminAuth = { token };

  next();
}

/**
 * Login endpoint handler
 * POST /api/analytics/admin/auth/login
 */
export async function handleLogin(req, res) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    if (!validatePassword(password)) {
      // Add delay to prevent brute force
      await new Promise(resolve => setTimeout(resolve, 1000));

      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    const { token, expiresAt } = createToken();

    res.json({
      success: true,
      token,
      expiresAt,
      expiresIn: 24 * 60 * 60 * 1000
    });
  } catch (err) {
    console.error('[Admin Auth] Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

/**
 * Logout endpoint handler
 * POST /api/analytics/admin/auth/logout
 * With JWT, logout is handled client-side by removing the token
 */
export function handleLogout(req, res) {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('[Admin Auth] Logout error:', err);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
}

/**
 * Check session endpoint handler
 * GET /api/analytics/admin/auth/check
 */
export function handleCheckSession(req, res) {
  const { token } = req.adminAuth || {};

  if (!token) {
    return res.status(401).json({
      success: false,
      authenticated: false
    });
  }

  try {
    const decoded = jwt.decode(token);

    res.json({
      success: true,
      authenticated: true,
      expiresAt: decoded.exp * 1000,
      expiresIn: (decoded.exp * 1000) - Date.now()
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      authenticated: false
    });
  }
}

export default {
  requireAdminAuth,
  handleLogin,
  handleLogout,
  handleCheckSession
};
