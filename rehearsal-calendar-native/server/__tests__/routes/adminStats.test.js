/**
 * H03: the admin's 30-day figure counts what it names — people not signed in
 * for 30 days — and nothing it cannot know. It was "churn" / "inactive users",
 * but a session renews itself without a sign-in and nothing records use, so it
 * never measured use; and anyone who never signed in after registering was left
 * out. Actual admin handler and authentication, executing actual SQLite SQL;
 * only PostgreSQL parameter syntax is translated.
 */
import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

let sqlite;
let server;
let adminToken;
const secret = 'h03-admin-secret-fixture-only';
const password = 'h03-admin-password-fixture-only';
const environmentKeys = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH'];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));

const database = Object.fromEntries(['get', 'all', 'run'].map(method => [method, (sql, params = []) => {
  const bindings = [];
  const translated = sql.replace(/\$(\d+)/g, (_match, index) => {
    bindings.push(params[Number(index) - 1]);
    return '?';
  });
  return sqlite.prepare(translated)[method](...bindings);
}]));
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.ADMIN_JWT_SECRET = secret;
  process.env.ADMIN_PASSWORD = password;
  delete process.env.ADMIN_PASSWORD_HASH;
  const { default: adminRoutes } = await import('../../routes/admin.js');
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  adminToken = (await request(server).post('/admin/api/login').send({ password }).expect(200)).body.token;
});

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE native_users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL, last_login_at TEXT);
    CREATE TABLE native_projects (id INTEGER PRIMARY KEY);
    CREATE TABLE native_rehearsals (id INTEGER PRIMARY KEY);
  `);
  const insert = sqlite.prepare('INSERT INTO native_users VALUES (?, ?, ?, ?)');
  // Signed in yesterday.
  insert.run(1, 'recent@example.test', daysAgo(400), daysAgo(1));
  // Last signed in 40 days ago — in the app every day since, perhaps, on a
  // session that renews itself; all this figure can say is the sign-in.
  insert.run(2, 'renewing@example.test', daysAgo(400), daysAgo(40));
  // Registered 40 days ago and never signed in since: left out before.
  insert.run(3, 'never@example.test', daysAgo(40), null);
  // Registered two days ago, never signed in.
  insert.run(4, 'new@example.test', daysAgo(2), null);
});

afterEach(() => sqlite?.close());

afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test('names sign-ins, not use, and counts those who never signed in since registering', async () => {
  const response = await request(server).get('/admin/api/stats')
    .set('Authorization', `Bearer ${adminToken}`).expect(200);

  expect(response.body.signIns).toEqual({ notInLast30Days: 2, rate: 50 });
  expect(response.body).not.toHaveProperty('churn');
  expect(response.body.users).toEqual({ total: 4, newThisWeek: 1, newThisMonth: 1 });
});
