import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase, testConnection, isPostgres } from './database/db.js';
import authRoutes from './routes/auth.js';
import nativeRoutes from './routes/native.js';
import availabilityRoutes from './routes/native/availability.js';
import calendarSyncRoutes from './routes/native/calendarSync.js';
import pushTokensRouter from './routes/native/pushTokens.js';
import cronRoutes from './routes/cron.js';
import adminRoutes from './routes/admin.js';
import { logger } from './utils/logger.js';
import { jsonForScript } from './utils/htmlEscape.js';

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

// Trust one upstream proxy (Vercel) — required for express-rate-limit
// to see the real client IP from X-Forwarded-For instead of Vercel's internal IP.
app.set('trust proxy', 1);

// Security headers
//
// CSP was once off for the whole server, to let a payment page embed an
// iframe — one page's requirement paid for with every other page's second line
// of defence. The public pages carry no inline script or style at all, so they
// get a strict policy; only /admin is widened, where it is mounted.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // The invite page carries one inline script; it is allowed by nonce
      // rather than by opening the door to every inline script on the site.
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
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
app.use(express.urlencoded({ extended: true }));

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
// An invite code is short enough to read out, which also makes it short
// enough to guess at scale. Looking one up and redeeming it are both capped.
app.use('/api/native/invite', rateLimit({
  windowMs: 60 * 1000,
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

// Admin panel
// The admin dashboard is generated with inline handlers and style attributes,
// so it is widened here rather than by weakening the policy every other page
// gets.
const relaxedCsp = (extra = {}) => helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    // helmet defaults script-src-attr to 'none', which blocks onclick= even
    // when script-src allows inline. The dashboard is built from onclick
    // handlers, so it has to be said explicitly.
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    ...extra,
  },
});

app.use('/admin', relaxedCsp(), adminRoutes);

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

// Universal deep link route - smart redirect page
app.get('/invite/:code', (req, res) => {
  const { code } = req.params;
  const expoHost = req.query.expoHost;
  const nonce = res.locals.cspNonce;

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
      <script nonce="${nonce}">
        const isRu = navigator.language.startsWith('ru');
        document.getElementById('statusText').textContent = isRu ? 'Открываем приложение...' : 'Opening the app...';
        document.getElementById('manualText').textContent = isRu ? 'Приложение не открылось автоматически?' : "App didn't open automatically?";
        document.getElementById('openButton').textContent = isRu ? 'Открыть приложение' : 'Open App';

        const code = ${jsonForScript(String(code || ''))};
        const expoHost = ${jsonForScript(expoHost || null)};

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
