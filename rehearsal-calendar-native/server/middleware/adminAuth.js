import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { asyncHandler } from './asyncHandler.js';

// JWT secret is independent of the password — changing password doesn't invalidate tokens
function getJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-dev-secret';
}

export const adminLogin = asyncHandler(async function adminLogin(req, res) {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const passwordPlain = process.env.ADMIN_PASSWORD;

  if (!passwordHash && !passwordPlain) {
    return res.status(503).json({ error: 'Admin panel not configured' });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password must be a non-empty string' });
  }

  // Prefer bcrypt hash; fall back to plaintext for backwards compatibility
  const isValid = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === passwordPlain;

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: '24h' });
  res.json({ token });
});

export function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'admin') throw new Error('Not admin');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}
