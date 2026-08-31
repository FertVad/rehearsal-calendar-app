/**
 * Integration Test Setup
 * Creates in-memory SQLite database for real integration tests
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testDb;

/**
 * Setup in-memory database with schema
 */
export async function setupIntegrationDb() {
  // Create in-memory database
  testDb = new Database(':memory:');

  // Read schema - we'll create a simplified version for tests
  const schema = `
    -- Native users
    CREATE TABLE native_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      -- Nullable, matching production: OAuth-only users have no password.
      -- Declaring it NOT NULL here made those accounts untestable.
      password_hash TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      phone TEXT,
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      locale TEXT DEFAULT 'en',
      notifications_enabled BOOLEAN DEFAULT 1,
      email_notifications BOOLEAN DEFAULT 1,
      week_start_day TEXT DEFAULT 'monday',
      onboarding_completed BOOLEAN DEFAULT 0,
      last_login_at DATETIME,
      -- requireAuth reads this on every request to check for revoked sessions
      token_version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects
    CREATE TABLE native_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      timezone TEXT DEFAULT 'UTC',
      invite_code TEXT UNIQUE,
      invite_expires_at DATETIME,
      invite_created_by INTEGER REFERENCES native_users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Project members
    CREATE TABLE native_project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES native_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'active',
      invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, user_id)
    );

    -- User availability
    CREATE TABLE native_user_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      type TEXT DEFAULT 'busy',
      title TEXT,
      notes TEXT,
      is_all_day BOOLEAN DEFAULT 0,
      source TEXT DEFAULT 'manual',
      external_event_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Rehearsals
    CREATE TABLE native_rehearsals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES native_projects(id) ON DELETE CASCADE,
      title TEXT,
      location TEXT,
      description TEXT,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      is_all_day BOOLEAN DEFAULT 0,
      created_by INTEGER REFERENCES native_users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Rehearsal responses (RSVP)
    CREATE TABLE native_rehearsal_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      response TEXT NOT NULL CHECK(response IN ('yes', 'no')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rehearsal_id, user_id)
    );

    -- Calendar connections (for calendar sync)
    CREATE TABLE native_calendar_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      device_calendar_id TEXT,
      device_calendar_name TEXT,
      sync_enabled BOOLEAN DEFAULT 1,
      sync_direction TEXT DEFAULT 'bidirectional',
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider, device_calendar_id)
    );

    -- Calendar event mappings (tracks sync between internal and external events)
    CREATE TABLE native_calendar_event_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL REFERENCES native_calendar_connections(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      internal_event_id TEXT NOT NULL,
      external_event_id TEXT NOT NULL,
      last_sync_direction TEXT,
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(connection_id, event_type, internal_event_id)
    );

    -- Subscription plans
    -- The notification inbox. Mirrors production after 003-notifications-timestamptz:
    -- one row per intended recipient, read_at NULL until they have seen it.
    CREATE TABLE native_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      type VARCHAR(50),
      title VARCHAR(255),
      body TEXT,
      data TEXT,
      related_type VARCHAR(50),
      related_id INTEGER,
      read_at DATETIME,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Push reminders already sent. The unique pair is what stops a rehearsal
    -- being announced twice when two schedulers overlap.
    CREATE TABLE native_push_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
      reminder_type VARCHAR(10) NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rehearsal_id, reminder_type)
    );
  `;

  // Execute schema
  testDb.exec(schema);

  // Translate the PostgreSQL dialect our routes are written in into something
  // SQLite can parse. Only the constructs actually used in the codebase are
  // handled — anything else will surface as a SqliteError, which is the honest
  // signal that this helper needs extending.
  // Returns the rewritten SQL together with the parameters in the order the
  // '?' placeholders now expect them. Postgres lets one $n appear several
  // times — the RSVP upsert does exactly that — and a straight $n → ? swap
  // silently loses the repeat, leaving the statement short of values.
  function toSqlite(sql, params = []) {
    const ordered = [];
    const rewritten = (
      sql
        // $1, $2 ... → ?, remembering which value each occurrence wants
        .replace(/\$(\d+)/g, (_match, n) => {
          ordered.push(params[Number(n) - 1]);
          return '?';
        })
        // ?::date ± interval 'N day(s)' → date(?, '±N days')
        .replace(
          /\?::date\s*([+-])\s*interval\s*'(\d+)\s*days?'/gi,
          (_match, sign, amount) => `date(?, '${sign}${amount} days')`
        )
        // bare ?::date / ?::timestamptz → the value as-is
        .replace(/\?::(date|timestamptz|timestamp)\b/gi, '?')
        // NOW() → SQLite's equivalent
        .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    );

    return { sql: rewritten, params: ordered.length > 0 ? ordered : params };
  }

  // Create mock db interface matching our db.js
  const mockDb = {
    run(sql, params = []) {
      const q = toSqlite(sql, params);
      const info = testDb.prepare(q.sql).run(q.params);
      return { lastInsertId: info.lastInsertRowid, changes: info.changes };
    },
    get(sql, params = []) {
      const q = toSqlite(sql, params);
      return testDb.prepare(q.sql).get(q.params);
    },
    all(sql, params = []) {
      const q = toSqlite(sql, params);
      return testDb.prepare(q.sql).all(q.params);
    },

    // Stands in for the real thing in db.js, which checks one connection out of
    // the pool for the whole callback. Here there is only ever one connection,
    // so what this reproduces is the shape callers rely on: a handle passed in,
    // a throw that undoes everything, a return that keeps it.
    async transaction(fn) {
      testDb.prepare('BEGIN').run();
      try {
        const result = await fn(mockDb);
        testDb.prepare('COMMIT').run();
        return result;
      } catch (err) {
        try {
          testDb.prepare('ROLLBACK').run();
        } catch {
          // ignore
        }
        throw err;
      }
    },
  };

  return mockDb;
}

/**
 * Clear all tables (respects FK dependency order)
 */
export function clearIntegrationDb() {
  if (testDb) {
    testDb.exec('DELETE FROM native_calendar_event_mappings');
    testDb.exec('DELETE FROM native_calendar_connections');
    testDb.exec('DELETE FROM native_notifications');
    testDb.exec('DELETE FROM native_push_reminders');
    testDb.exec('DELETE FROM native_rehearsal_responses');
    testDb.exec('DELETE FROM native_rehearsals');
    testDb.exec('DELETE FROM native_user_availability');
    testDb.exec('DELETE FROM native_project_members');
    testDb.exec('DELETE FROM native_projects');
    testDb.exec('DELETE FROM native_users');
  }
}

/**
 * Close database
 */
export function closeIntegrationDb() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Seed test data
 */
export async function seedTestData(db) {
  // Create test users
  const user1 = db.run(
    `INSERT INTO native_users (email, password_hash, first_name, last_name)
     VALUES (?, ?, ?, ?)`,
    ['admin@test.com', 'hash123', 'Admin', 'User']
  );

  const user2 = db.run(
    `INSERT INTO native_users (email, password_hash, first_name, last_name)
     VALUES (?, ?, ?, ?)`,
    ['member@test.com', 'hash456', 'Member', 'User']
  );

  // Create test project
  const project = db.run(
    `INSERT INTO native_projects (name, description)
     VALUES (?, ?)`,
    ['Test Project', 'A project for testing']
  );

  // Add members
  db.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, ?, ?)`,
    [project.lastInsertId, user1.lastInsertId, 'owner', 'active']
  );

  db.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, ?, ?)`,
    [project.lastInsertId, user2.lastInsertId, 'member', 'active']
  );

  return {
    adminId: user1.lastInsertId,
    memberId: user2.lastInsertId,
    projectId: project.lastInsertId,
  };
}

