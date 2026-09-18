import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
import { jsonForScript } from './utils/htmlEscape.js';
import { securityHeaders } from './middleware/securityHeaders.js';

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

  // Trust one upstream proxy (Vercel) — required for express-rate-limit
  // to see the real client IP from X-Forwarded-For instead of Vercel's internal IP.
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

  return app;
}
