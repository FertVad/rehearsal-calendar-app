// Load only an explicitly selected environment file before config consumers.
import './config/env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntimeApp } from './runtime.js';
import { logger } from './utils/logger.js';
import { readAppleAuthConfig } from './config/appleAuth.js';

// Security configuration errors remain explicit startup errors. A database
// outage is handled separately by the lazy runtime, without taking down HTML.
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'CRON_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
    missing.push('ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const appleAuth = readAppleAuthConfig();
if (!appleAuth.enabled) logger.warn('Apple sign-in is unavailable', { reason: appleAuth.reason });

const app = createRuntimeApp();
export default app;

// Vercel owns the listener. Importing the handler as a library also acquires no
// listener or DB connection; running this file directly starts a local server.
const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && !process.env.VERCEL) {
  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';
  app.listen(port, host, () => {
    logger.info('Native App API server is listening');
  });
}

// Reminder schedulers are deliberately never started by the server. Their
// production re-enablement remains a separate operational decision after R8.
