import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database/db.js';
import authRoutes from './routes/auth.js';
import nativeRoutes from './routes/native.js';
import availabilityRoutes from './routes/native/availability.js';
import calendarSyncRoutes from './routes/native/calendarSync.js';
import pushTokensRouter from './routes/native/pushTokens.js';
import cronRoutes from './routes/cron.js';
import adminRoutes from './routes/admin.js';
import { logger } from './utils/logger.js';
import { generateInvitePageHTML } from './routes/invitePage.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { limitOperationIp } from './middleware/operationIpRateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';

/**
 * Assemble the HTTP app without loading .env, connecting to a database or
 * opening a listener. The caller prepares its environment and database first.
 */
export function createApp() {
  const DEBUG = toBool(process.env.DEBUG);
  const LOG_REQUESTS = DEBUG || toBool(process.env.LOG_REQUESTS);

  const app = express();

  // Deployment must provide one trusted ingress with no direct bypass. Shared
  // budgets use Express req.ip; they do not choose a forwarded address themselves.
  app.set('trust proxy', 1);

  // One strict policy for public pages and the admin dashboard.
  app.use(securityHeaders);

  // CORS — React Native app doesn't use CORS (native HTTP client),
  // but browser-based admin panel and invite pages do
  const allowedOrigins = [
    process.env.BASE_URL,
    'http://localhost:3001',
    'http://localhost:8081',
  ].filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile app, curl, Vercel Cron)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Attach db instance to requests
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'db', { value: db, enumerable: false, writable: false });
    next();
  });

  app.use((req, _res, next) => {
    if (LOG_REQUESTS) logger.debug(`Request: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Every method under these existing mounts spends the same shared IP budget,
  // before account/crypto work. Store failures deny admission; there is no local
  // MemoryStore or test-only bypass. Public pages/health remain independent.
  app.use('/api/auth', limitOperationIp('auth'));
  // Invite IP/account budgets live on the redemption handlers, so every
  // mounting path shares the same database counters and failure behavior.
  app.use('/admin/api/login', limitOperationIp('admin_login'));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve the admin document before static middleware can redirect /admin to
  // the asset directory /admin/. Unhandled asset paths continue to express.static.
  app.use('/admin', adminRoutes);

  // Marketing site, privacy policy and support pages.
  // Mounted before the API routers but after them in specificity: express.static
  // only answers for files that exist, so /api/* and /invite/* still reach their
  // handlers. Serving these from the same origin as the API is what lets
  // Universal Links work — apple-app-site-association has to sit on the very
  // domain the invite links use.
  app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      // index.html changes with every deploy; the assets are cheap to revalidate.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    },
  }));

  // Auth routes
  app.use('/api/auth', authRoutes);

  // Availability routes (at root /api level for backward compatibility)
  app.use('/api/availability', availabilityRoutes);

  // Calendar sync routes
  app.use('/api/native/calendar-sync', calendarSyncRoutes);

  // Push notification token routes
  app.use('/api/native/push-tokens', pushTokensRouter);

  // Native app routes
  app.use('/api/native', nativeRoutes);

  // Cron endpoints (for Vercel Cron Jobs)
  app.use('/api/cron', cronRoutes);

  // Apple App Site Association for Universal Links (iOS)
  app.get('/.well-known/apple-app-site-association', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      applinks: {
        apps: [],
        details: [
          {
            appID: '9N28BHP37Z.com.rehearsal.app',
            paths: ['/invite/*']
          }
        ]
      }
    });
  });

  // Android assetlinks.json for App Links
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.rehearsal.app',
          sha256_cert_fingerprints: [
            'YOUR_ANDROID_SHA256_FINGERPRINT'
          ]
        }
      }
    ]);
  });

  // Render the browser fallback without querying invitation/account data.
  app.get('/invite/:code', (req, res) => {
    res.type('html').send(generateInvitePageHTML(req.params.code, req.query.expoHost));
  });

  app.use(errorHandler);

  return app;
}
