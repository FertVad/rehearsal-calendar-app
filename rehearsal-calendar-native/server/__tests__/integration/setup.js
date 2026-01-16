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
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      timezone TEXT DEFAULT 'UTC',
      locale TEXT DEFAULT 'en',
      notifications_enabled BOOLEAN DEFAULT 1,
      email_notifications BOOLEAN DEFAULT 1,
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
      title TEXT NOT NULL,
      location TEXT,
      description TEXT,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Rehearsal responses (RSVP)
    CREATE TABLE native_rehearsal_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      response TEXT CHECK(response IN ('yes')),
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
  `;

  // Execute schema
  testDb.exec(schema);

  // Create mock db interface matching our db.js
  const mockDb = {
    run(sql, params = []) {
      const info = testDb.prepare(sql).run(params);
      return { lastInsertId: info.lastInsertRowid };
    },
    get(sql, params = []) {
      return testDb.prepare(sql).get(params);
    },
    all(sql, params = []) {
      return testDb.prepare(sql).all(params);
    },
  };

  return mockDb;
}

/**
 * Clear all tables
 */
export function clearIntegrationDb() {
  if (testDb) {
    testDb.exec('DELETE FROM native_calendar_event_mappings');
    testDb.exec('DELETE FROM native_calendar_connections');
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
