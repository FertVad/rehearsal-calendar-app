/**
 * Test helpers for backend API tests
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testDb;

/**
 * Setup test database before tests
 */
export async function setupTestDatabase() {
  const testDbPath = path.join(__dirname, '../test.sqlite');
  testDb = new Database(testDbPath);

  // Create native_users table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS native_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      phone TEXT,
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      locale TEXT DEFAULT 'en',
      notifications_enabled BOOLEAN DEFAULT true,
      email_notifications BOOLEAN DEFAULT true,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create projects table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create user_projects table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS user_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, project_id)
    );
  `);

  // Mock db module with test database
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
 * Clear all tables before each test
 */
export function clearDatabase() {
  if (testDb) {
    testDb.exec('DELETE FROM native_users');
    testDb.exec('DELETE FROM projects');
    testDb.exec('DELETE FROM user_projects');
  }
}

/**
 * Teardown test database after tests
 */
export function teardownTestDatabase() {
  if (testDb) {
    testDb.close();
  }
}

/**
 * Mock data generators
 */
export const mockUserData = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User',
};

export const mockUserData2 = {
  email: 'test2@example.com',
  password: 'password456',
  firstName: 'Another',
  lastName: 'User',
};
