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

    -- Subscription plans
    CREATE TABLE native_subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL UNIQUE,
      display_name_en VARCHAR(100) NOT NULL,
      display_name_ru VARCHAR(100) NOT NULL,
      price_ils DECIMAL(10,2) NOT NULL,
      price_usd DECIMAL(10,2),
      price_currency VARCHAR(3) DEFAULT 'ILS',
      billing_period VARCHAR(20) DEFAULT 'monthly',
      features_json TEXT,
      max_projects INTEGER,
      max_members_per_project INTEGER,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User subscriptions
    CREATE TABLE native_user_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      allpay_token VARCHAR(255),
      allpay_subscription_id VARCHAR(255),
      allpay_customer_id VARCHAR(255),
      current_period_start DATETIME,
      current_period_end DATETIME,
      next_billing_date DATETIME,
      started_at DATETIME,
      cancelled_at DATETIME,
      cancellation_reason TEXT,
      trial_ends_at DATETIME,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES native_subscription_plans(id)
    );

    -- Payment transactions
    CREATE TABLE native_payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subscription_id INTEGER,
      allpay_order_id VARCHAR(255) UNIQUE NOT NULL,
      allpay_transaction_id VARCHAR(255),
      allpay_payment_status INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'ILS',
      payment_method VARCHAR(50),
      transaction_type VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      allpay_response_json TEXT,
      FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES native_user_subscriptions(id) ON DELETE SET NULL
    );

    -- Webhook events
    CREATE TABLE native_allpay_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type VARCHAR(100) NOT NULL,
      allpay_order_id VARCHAR(255),
      signature VARCHAR(255),
      is_verified BOOLEAN DEFAULT 0,
      processing_status VARCHAR(20) DEFAULT 'pending',
      processing_error TEXT,
      processed_at DATETIME,
      payload_json TEXT NOT NULL,
      idempotency_key VARCHAR(255) UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Execute schema
  testDb.exec(schema);

  // Convert PostgreSQL-style $1,$2... placeholders to SQLite ? placeholders
  function toSqlite(sql) {
    return sql.replace(/\$\d+/g, '?');
  }

  // Create mock db interface matching our db.js
  const mockDb = {
    run(sql, params = []) {
      const info = testDb.prepare(toSqlite(sql)).run(params);
      return { lastInsertId: info.lastInsertRowid, changes: info.changes };
    },
    get(sql, params = []) {
      return testDb.prepare(toSqlite(sql)).get(params);
    },
    all(sql, params = []) {
      return testDb.prepare(toSqlite(sql)).all(params);
    },
  };

  return mockDb;
}

/**
 * Clear all tables (respects FK dependency order)
 */
export function clearIntegrationDb() {
  if (testDb) {
    testDb.exec('DELETE FROM native_allpay_webhook_events');
    testDb.exec('DELETE FROM native_payment_transactions');
    testDb.exec('DELETE FROM native_user_subscriptions');
    testDb.exec('DELETE FROM native_calendar_event_mappings');
    testDb.exec('DELETE FROM native_calendar_connections');
    testDb.exec('DELETE FROM native_rehearsal_responses');
    testDb.exec('DELETE FROM native_rehearsals');
    testDb.exec('DELETE FROM native_user_availability');
    testDb.exec('DELETE FROM native_project_members');
    testDb.exec('DELETE FROM native_projects');
    testDb.exec('DELETE FROM native_users');
    // Note: subscription plans are NOT cleared (seed data reused across tests)
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

/**
 * Seed subscription plans for payment tests
 */
export function seedSubscriptionPlans(db) {
  db.run(
    `INSERT INTO native_subscription_plans
     (name, display_name_en, display_name_ru, price_ils, price_usd, billing_period, max_projects, max_members_per_project, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['monthly', 'Monthly', 'Месяц', 32.00, 9.00, 'monthly', 999, 999, '["unlimited_projects"]', 1]
  );
  db.run(
    `INSERT INTO native_subscription_plans
     (name, display_name_en, display_name_ru, price_ils, price_usd, billing_period, max_projects, max_members_per_project, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['quarterly', '3 Months', '3 месяца', 54.00, 15.00, 'quarterly', 999, 999, '["unlimited_projects","save_40"]', 1]
  );
  db.run(
    `INSERT INTO native_subscription_plans
     (name, display_name_en, display_name_ru, price_ils, price_usd, billing_period, max_projects, max_members_per_project, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['lifetime', 'Lifetime', 'Навсегда', 176.00, 49.00, 'lifetime', 999, 999, '["lifetime_access"]', 1]
  );
  db.run(
    `INSERT INTO native_subscription_plans
     (name, display_name_en, display_name_ru, price_ils, price_usd, billing_period, max_projects, max_members_per_project, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['test_1min', 'Test (1 min)', 'Тест (1 мин)', 0.04, 0.01, 'test_1min', 999, 999, '["test_plan"]', 1]
  );
  db.run(
    `INSERT INTO native_subscription_plans
     (name, display_name_en, display_name_ru, price_ils, price_usd, billing_period, max_projects, max_members_per_project, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['deprecated', 'Old Plan', 'Старый', 10.00, 3.00, 'monthly', 1, 5, '[]', 0]
  );
}
