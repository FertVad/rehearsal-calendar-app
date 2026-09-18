/**
 * H04: actual admin handlers/authentication, executing actual SQLite SQL.
 * Only PostgreSQL parameter syntax is translated; mutation/results are never
 * stubbed. No .env, server entrypoint, real account or external service.
 */
import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

let sqlite;
let server;
let adminToken;
let calls;
let loggedErrors;
const secret = 'h04-admin-secret-fixture-only';
const password = 'h04-admin-password-fixture-only';
const environmentKeys = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH'];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));

function query(sql, params = []) {
  calls.push(sql);
  const bindings = [];
  const translated = sql.replace(/\$(\d+)/g, (_match, index) => {
    bindings.push(params[Number(index) - 1]);
    return '?';
  });
  return { statement: sqlite.prepare(translated), bindings };
}
const database = Object.fromEntries(['get', 'all', 'run'].map(method => [method, (sql, params) => {
  const { statement, bindings } = query(sql, params);
  return statement[method](...bindings);
}]));
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.ADMIN_JWT_SECRET = secret;
  process.env.ADMIN_PASSWORD = password;
  delete process.env.ADMIN_PASSWORD_HASH;
  const { default: adminRoutes } = await import('../../routes/admin.js');
  const app = express();
  // Allow literal JSON null to reach the route and test its own body guard;
  // production's strict JSON parser already rejects it before this handler.
  app.use(express.json({ strict: false }));
  app.use('/admin', adminRoutes);
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  const login = await request(server).post('/admin/api/login').send({ password }).expect(200);
  expect(typeof login.body.token).toBe('string');
  adminToken = login.body.token;
});

beforeEach(() => {
  calls = [];
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE native_users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE native_projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE native_bug_reports (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES native_users(id),
      message TEXT NOT NULL, screen TEXT,
      status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'fixed')),
      created_at TEXT NOT NULL
    );
    INSERT INTO native_users VALUES (1, 'h04@example.test');
    INSERT INTO native_projects VALUES (1, 'H04 unchanged project');
    INSERT INTO native_bug_reports VALUES
      (1, 1, 'H04 first report', 'Calendar', 'new', '2030-09-17T12:00:00Z'),
      (2, 1, 'H04 unrelated report', NULL, 'in_progress', '2030-09-16T12:00:00Z'),
      (2147483647, 1, 'H04 int4 boundary', NULL, 'new', '2030-09-15T12:00:00Z');
  `);
  loggedErrors = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  loggedErrors?.mockRestore();
  sqlite?.close();
});

afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

const snapshot = () => Object.fromEntries(['native_users', 'native_projects', 'native_bug_reports']
  .map(table => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
function patch(id, body = { status: 'fixed' }, token = adminToken) {
  const req = request(server).patch(`/admin/api/bug-reports/${encodeURIComponent(id)}/status`);
  if (token !== null) req.set('Authorization', `Bearer ${token}`);
  return req.set('Content-Type', 'application/json').send(JSON.stringify(body));
}

describe('admin bug-report status contract', () => {
  test('missing report returns 404 instead of claiming success', async () => {
    const before = snapshot();
    const response = await patch('999');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Bug report not found' });
    expect(snapshot()).toEqual(before);
  });

  test('malformed report ID returns 400 before database work', async () => {
    const before = snapshot();
    const response = await patch('1x');
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  test.each(['0', '-1', '1.5', '1e0', '01', '+1', ' 1', '1 ', '2147483648', '9007199254740993'])
  ('invalid ID %s cannot issue database work', async id => {
    const before = snapshot();
    expect((await patch(id)).status).toBe(400);
    expect(calls).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  test.each([null, [], {}, { status: null }, { status: false }, { status: 1 },
    { status: ['fixed'] }, { status: {} }, { status: '' }, { status: 'FIXED' }, { status: 'fixed ' }])
  ('invalid body %j cannot issue database work', async body => {
    const before = snapshot();
    const response = await patch('1', body);
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  test.each([null, 'invalid', jwt.sign({ role: 'member' }, secret),
    jwt.sign({ role: 'admin' }, secret, { expiresIn: -1 })])
  ('authentication rejects unusable credentials before ID/body validation', async token => {
    const before = snapshot();
    expect((await patch('1x', { status: 'wrong' }, token)).status).toBe(401);
    expect((await patch('1', { status: 'fixed' }, token)).status).toBe(401);
    expect(calls).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  test('all statuses, repeated status and int4 boundary update only the selected status', async () => {
    for (const [id, status] of [[1, 'in_progress'], [1, 'fixed'], [1, 'fixed'], [1, 'new'], [2147483647, 'fixed']]) {
      const expected = snapshot();
      expected.native_bug_reports.find(row => row.id === id).status = status;
      const response = await patch(String(id), { status });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(snapshot()).toEqual(expected);
    }
  });

  test('a report deleted after it was displayed returns 404 with no other writes', async () => {
    expect(sqlite.prepare('SELECT * FROM native_bug_reports WHERE id = 1').get()).toBeDefined();
    sqlite.prepare('DELETE FROM native_bug_reports WHERE id = 1').run();
    const before = snapshot();
    expect((await patch('1')).status).toBe(404);
    expect(snapshot()).toEqual(before);
  });

  test('a failing real SQL trigger returns generic 500, rolls back and recovers', async () => {
    const before = snapshot();
    sqlite.exec(`CREATE TRIGGER h04_reject_status BEFORE UPDATE ON native_bug_reports
      BEGIN SELECT RAISE(ABORT, 'H04_INTERNAL_STORAGE_DETAIL'); END;`);
    const response = await patch('1');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to update status' });
    expect(snapshot()).toEqual(before);
    expect(loggedErrors).toHaveBeenCalledTimes(1);
    sqlite.exec('DROP TRIGGER h04_reject_status');
    expect((await patch('1')).body).toEqual({ success: true });
    before.native_bug_reports.find(row => row.id === 1).status = 'fixed';
    expect(snapshot()).toEqual(before);
  });
});
