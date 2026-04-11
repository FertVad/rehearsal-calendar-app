import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import db, { initDatabase, testConnection, isPostgres } from './database/db.js';
import authRoutes from './routes/auth.js';
import nativeRoutes from './routes/native.js';
import availabilityRoutes from './routes/native/availability.js';
import calendarSyncRoutes from './routes/native/calendarSync.js';
import pushTokensRouter from './routes/native/pushTokens.js';
import cronRoutes from './routes/cron.js';
import adminRoutes from './routes/admin.js';
import { startReminderScheduler } from './services/notifications/reminderScheduler.js';
import { runRecurringBilling } from './jobs/recurringBilling.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);
const LOG_REQUESTS = DEBUG || toBool(process.env.LOG_REQUESTS);

// Environment diagnostics
logger.info('=== ENVIRONMENT DIAGNOSTICS ===');
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
logger.info(`DATABASE_URL: ${process.env.DATABASE_URL ? 'PROVIDED' : 'MISSING'}`);
logger.info(`PORT: ${process.env.PORT || '3001'}`);
logger.info('================================');

// Safety guard: test mode must never run in production (would allow webhook bypass)
if (process.env.NODE_ENV === 'production' && process.env.ALLPAY_TEST_MODE === 'true') {
  logger.error('FATAL: ALLPAY_TEST_MODE=true is not allowed in production. Shutting down.');
  process.exit(1);
}

// Startup validation: warn about missing critical env variables
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'ADMIN_PASSWORD', 'CRON_SECRET', 'ALLPAY_WEBHOOK_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
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

const app = express();

// Security headers
app.use(helmet({
  // Relax CSP — AllPay checkout page loads iframe from allpay.co.il
  contentSecurityPolicy: false,
}));

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
app.use(express.urlencoded({ extended: true })); // Parse form-urlencoded (AllPay webhooks)

logger.info('Starting API server for Native App');

// Attach db instance to requests
app.use((req, _res, next) => {
  Object.defineProperty(req, 'db', { value: db, enumerable: false, writable: false });
  next();
});

app.use((req, _res, next) => {
  if (LOG_REQUESTS) logger.debug(`Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Rate limiting
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));
app.use('/admin/api/login', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
}));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Admin panel
app.use('/admin', adminRoutes);

// Apple App Site Association for Universal Links (iOS)
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: 'TEAM_ID.com.rehearsal.app',
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

// Universal deep link route - smart redirect page
app.get('/invite/:code', (req, res) => {
  const { code } = req.params;
  const expoHost = req.query.expoHost;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Join Project - Rehearsal App</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
          max-width: 500px;
        }
        h1 { margin-bottom: 1rem; font-size: 2rem; }
        p { margin-bottom: 1rem; font-size: 1.1rem; opacity: 0.9; }
        .button {
          display: inline-block;
          margin: 0.5rem;
          padding: 1rem 2rem;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
        }
        .spinner {
          margin: 2rem auto;
          width: 50px; height: 50px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎭 Rehearsal App</h1>
        <div id="status">
          <div class="spinner"></div>
          <p id="statusText"></p>
        </div>
        <div id="manual" style="display: none;">
          <p id="manualText"></p>
          <a href="#" onclick="openApp(); return false;" class="button" id="openButton"></a>
        </div>
      </div>
      <script>
        const isRu = navigator.language.startsWith('ru');
        document.getElementById('statusText').textContent = isRu ? 'Открываем приложение...' : 'Opening the app...';
        document.getElementById('manualText').textContent = isRu ? 'Приложение не открылось автоматически?' : "App didn't open automatically?";
        document.getElementById('openButton').textContent = isRu ? 'Открыть приложение' : 'Open App';

        const code = '${code}';
        const expoHost = ${JSON.stringify(expoHost || null)};

        function openApp() {
          const schemes = [];
          if (expoHost) {
            schemes.push('exp://' + expoHost + '/--/invite/' + code);
          }
          schemes.push('rehearsalapp://invite/' + code);

          let tried = 0;
          schemes.forEach((scheme, index) => {
            setTimeout(() => {
              window.location.href = scheme;
              tried++;
              if (tried === schemes.length) {
                setTimeout(() => {
                  document.getElementById('status').style.display = 'none';
                  document.getElementById('manual').style.display = 'block';
                }, 2000);
              }
            }, index * 500);
          });
        }

        window.onload = () => { openApp(); };
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: String(err) });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  logger.info(`Native App API server running on http://${HOST}:${PORT}`);
  logger.info(`Also accessible at http://localhost:${PORT}`);

  // Start reminder scheduler for push notifications
  startReminderScheduler();

  // Start recurring billing cron job (daily at 2:00 AM UTC)
  // Note: On Vercel (serverless), this does NOT run - Vercel Cron Jobs handle it via GET /api/cron/recurring-billing
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Cron] Triggering recurring billing job');
    try {
      await runRecurringBilling();
    } catch (error) {
      logger.error('[Cron] Recurring billing job failed:', error);
    }
  });
  logger.info('[Cron] Recurring billing scheduler initialized (daily at 2:00 AM UTC)');
});
