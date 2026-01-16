import jwt from 'jsonwebtoken';

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

export function generateTokens(userId) {
  const accessToken = jwt.sign({ userId, type: 'access' }, SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ userId, type: 'refresh' }, SECRET, {
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

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token, 'access');
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = decoded.userId;
  next();
}

// Alias for backwards compatibility
export const requireAuth = authenticateToken;
