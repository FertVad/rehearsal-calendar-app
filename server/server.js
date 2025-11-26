import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase, testConnection, isPostgres } from './database/db.js';
import projectRoutes from './routes/project.js';
import rehearsalsRoutes from './routes/rehearsals.js';
import actorsRoutes from './routes/actors.js';
import globalRoutes from './routes/global.js';
import webappRoutes from './routes/webapp.js';
import settingsRoutes from './routes/settings.js';
import authRoutes from './routes/auth.js'; // Native app auth
import nativeRoutes from './routes/native.js'; // Native app endpoints
import availabilityRoutes from './routes/availability.js'; // Native app availability
import analyticsTrackRoutes from './analytics/routes/track.js';
import analyticsAdminRoutes from './analytics/routes/admin.js';
import analyticsAuthRoutes from './analytics/routes/auth.js';
import { createBot } from './bot/index.js';
import { ensureWebhook } from './bot/webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);
const LOG_REQUESTS = DEBUG || toBool(process.env.LOG_REQUESTS);
const LOG_WEBHOOK = DEBUG || toBool(process.env.LOG_WEBHOOK);
// Critical diagnostics for environment variables
console.log('=== ENVIRONMENT DIAGNOSTICS ===');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('[ENV] TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? `${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...${process.env.TELEGRAM_BOT_TOKEN.slice(-5)}` : 'MISSING!!!');
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'PROVIDED' : 'MISSING');
console.log('[ENV] WEBHOOK_URL:', process.env.WEBHOOK_URL || 'NOT SET');
console.log('[ENV] PORT:', process.env.PORT || '3001');
console.log('================================');
await initDatabase();

try {
  await testConnection();
  console.log(`[DB] Using ${isPostgres ? 'PostgreSQL' : 'SQLite'} database`);
  console.log('[DB] Database connection info:', {
    type: isPostgres ? 'PostgreSQL' : 'SQLite',
    url_defined: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    node_env: process.env.NODE_ENV,
  });
} catch (err) {
  console.error('[DB] Connection test failed', err);
  if (isPostgres) {
    process.exit(1);
  }
}

// Run analytics migration
try {
  console.log('[Analytics] Running migration...');
  const migrationPath = path.join(__dirname, 'analytics/migrations/add_analytics_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  if (!isPostgres) {
    // SQLite - convert syntax
    const sqliteSql = sql
      .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/JSONB/g, 'TEXT')
      .replace(/TIMESTAMP/g, 'DATETIME')
      .replace(/NOW\(\)/g, "CURRENT_TIMESTAMP")
      .replace(/IF NOT EXISTS/g, '')
      .replace(/COMMENT ON .*/g, '');

    const statements = sqliteSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.run(stmt);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
  } else {
    // PostgreSQL - split statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await db.run(stmt);
      } catch (err) {
        if (!err.message.includes('already exists') && err.code !== '42P07' && err.code !== '42710') {
          throw err;
        }
      }
    }
  }
  console.log('[Analytics] Migration completed successfully');
} catch (err) {
  console.error('[Analytics] Migration failed:', err);
  // Don't exit - app can still run without analytics
}

// Telegram bot is optional (only for notifications)
const ENABLE_NOTIFICATIONS = toBool(process.env.ENABLE_NOTIFICATIONS);
let bot = null;

if (ENABLE_NOTIFICATIONS && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your-telegram-bot-token') {
  console.log('[Telegram] Initializing bot for notifications...');
  bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
  ensureWebhook(bot, process.env.WEBHOOK_URL);
} else {
  console.log('[Telegram] Bot disabled (ENABLE_NOTIFICATIONS=false or no token)');
}

const app = express();
app.use(cors());
app.use(express.json());

console.log('[Server] Starting API server');

// Attach db instance to requests (for helpers/scripts expecting req.db)
app.use((req, _res, next) => {
  // non-enumerable to avoid logging large objects
  Object.defineProperty(req, 'db', { value: db, enumerable: false, writable: false });
  next();
});

app.use((req, _res, next) => {
  if (LOG_REQUESTS) console.log(`[Request] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint for monitoring/deployment
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes); // Native app authentication
app.use('/api/native', nativeRoutes); // Native app endpoints (projects, rehearsals)
app.use('/api/availability', availabilityRoutes); // Native app availability
app.use('/api', projectRoutes);
app.use('/api', rehearsalsRoutes);
app.use('/api', actorsRoutes);
app.use('/api/global', globalRoutes);
app.use('/api', webappRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsTrackRoutes);
app.use('/api/analytics/admin/auth', analyticsAuthRoutes);
app.use('/api/analytics/admin', analyticsAdminRoutes);

// Apple App Site Association for Universal Links (iOS)
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: 'TEAM_ID.com.rehearsal.app', // Will need actual Team ID for production
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
          // Will need actual SHA256 fingerprint from keystore
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
          <p>Открываем приложение...</p>
        </div>
        <div id="manual" style="display: none;">
          <p>Приложение не открылось автоматически?</p>
          <a href="#" onclick="openApp(); return false;" class="button">Открыть приложение</a>
        </div>
      </div>
      <script>
        const code = '${code}';
        ${expoHost ? `const expoHost = '${expoHost}';` : 'const expoHost = null;'}

        function openApp() {
          const schemes = [];
          if (expoHost) {
            schemes.push('exp://' + expoHost + '/--/invite/' + code);
          }
          schemes.push('rehearsalapp://invite/' + code);

          let tried = 0;
          schemes.forEach((scheme, index) => {
            setTimeout(() => {
              console.log('Trying:', scheme);
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

// Webhook route (only if bot is enabled)
if (bot) {
  app.use(
    '/webhook',
    (req, _res, next) => {
      if (LOG_WEBHOOK) console.log('[Webhook] update received', Object.keys(req.body || {}));
      next();
    },
    bot.webhookCallback(),
  );
} else {
  app.post('/webhook', (req, res) => {
    res.status(503).json({ error: 'Telegram bot is disabled' });
  });
}

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'admin.html'));
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: String(err) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Server] API server running on ${PORT}`);
});
