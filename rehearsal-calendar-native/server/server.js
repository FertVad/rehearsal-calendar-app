// FIRST, before anything that reads process.env at module scope — see config/env.js.
import './config/env.js';
import { initDatabase, testConnection, isPostgres } from './database/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { readAppleAuthConfig } from './config/appleAuth.js';

// Environment diagnostics
logger.info('=== ENVIRONMENT DIAGNOSTICS ===');
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
logger.info(`DATABASE_URL: ${process.env.DATABASE_URL ? 'PROVIDED' : 'MISSING'}`);
logger.info(`PORT: ${process.env.PORT || '3001'}`);
logger.info('================================');

// Startup validation: refuse to start if critical env vars are missing in production
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'CRON_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  // Admin can be configured via either bcrypt hash or plaintext password
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
    missing.push('ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  }
  if (missing.length > 0) {
    logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Apple is optional, but an unconfigured provider must never verify without an
// audience. Diagnose its availability without stopping unrelated application
// routes or exposing configuration values. The request guard uses this same rule.
const appleAuth = readAppleAuthConfig();
if (!appleAuth.enabled) {
  logger.warn('Apple sign-in is unavailable', { reason: appleAuth.reason });
}

await initDatabase();

try {
  await testConnection();
  logger.info(`Using ${isPostgres ? 'PostgreSQL' : 'SQLite'} database`);
  logger.debug('Database connection info:', {
    type: isPostgres ? 'PostgreSQL' : 'SQLite',
    url_defined: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    node_env: process.env.NODE_ENV,
  });
} catch (err) {
  logger.error('Connection test failed', err);
  if (isPostgres) {
    process.exit(1);
  }
}

logger.info('Starting API server for Native App');
const app = createApp();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  logger.info(`Native App API server running on http://${HOST}:${PORT}`);
  logger.info(`Also accessible at http://localhost:${PORT}`);

  // The reminder scheduler is deliberately NOT started here.
  //
  // It never ran on Vercel anyway — functions are not resident between
  // requests — so the only thing it did was fire on local boots, against
  // whatever DATABASE_URL points at. That is the production database, so
  // starting a dev server sent real push notifications to real people. It did,
  // on 2026-08-25.
  //
  // Reminders are driven by GET /api/cron/reminders, called from outside. To
  // exercise them locally, call that endpoint.
});
