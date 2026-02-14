import jwt from 'jsonwebtoken';

function getSecret() {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? `admin-panel-${pw}` : null;
}

export function adminLogin(req, res) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    return res.status(503).json({ error: 'Admin panel not configured' });
  }
  const { password } = req.body;
  if (password !== pw) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: '24h' });
  res.json({ token });
}

export function requireAdmin(req, res, next) {
  const secret = getSecret();
  if (!secret) {
    return res.status(503).json({ error: 'Admin panel not configured' });
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}
