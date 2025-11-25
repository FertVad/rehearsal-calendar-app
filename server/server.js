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
