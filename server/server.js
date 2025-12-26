import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase, testConnection, isPostgres } from './database/db.js';
import authRoutes from './routes/auth.js';
import nativeRoutes from './routes/native.js';
import availabilityRoutes from './routes/native/availability.js';
import calendarSyncRoutes from './routes/native/calendarSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);
const LOG_REQUESTS = DEBUG || toBool(process.env.LOG_REQUESTS);

// Environment diagnostics
console.log('=== ENVIRONMENT DIAGNOSTICS ===');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'PROVIDED' : 'MISSING');
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

const app = express();
app.use(cors());
app.use(express.json());

console.log('[Server] Starting API server for Native App');

// Attach db instance to requests
app.use((req, _res, next) => {
  Object.defineProperty(req, 'db', { value: db, enumerable: false, writable: false });
  next();
});

app.use((req, _res, next) => {
  if (LOG_REQUESTS) console.log(`[Request] ${req.method} ${req.originalUrl}`);
  next();
});

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

// Native app routes
app.use('/api/native', nativeRoutes);

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

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: String(err) });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[Server] Native App API server running on http://${HOST}:${PORT}`);
  console.log(`[Server] Also accessible at http://localhost:${PORT}`);
});
