/**
 * T-294: the admin's figures of use — active people, retention by
 * registration week, builds in use, each invitation from page to join, the
 * last day in the app — through the real admin router and login, over a SQLite
 * fixture with migration 016's own DDL. Without 016 it says "no data", never
 * zeros (CLAUDE.md, rule 10). The same routes run on PostgreSQL in
 * __tests__/postgres/t294Usage.mjs.
 *
 * "Now" is Wednesday 25 November 2026, 12:00 UTC: 05:00 that day in Mazatlán,
 * 13:00 in Berlin.
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

const NOW = Date.parse('2026-11-25T12:00:00.000Z');
const D = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIGRATION = readFileSync(new URL('../../migrations/016-usage-statistics.sql', import.meta.url), 'utf8');

let sqlite;
let server;
let adminToken;
const environmentKeys = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_SERVICE_EMAILS'];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

const database = Object.fromEntries(['get', 'all', 'run'].map((method) => [method, (sql, params = []) => {
  const bindings = [];
  const translated = sql.replace(/\$(\d+)/g, (_match, index) => {
    bindings.push(params[Number(index) - 1]);
    return '?';
  });
  return sqlite.prepare(translated)[method](...bindings);
}]));
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));

const SCHEMA = `
  CREATE TABLE native_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT,
    first_name TEXT NOT NULL, last_name TEXT, timezone TEXT DEFAULT 'UTC', locale TEXT DEFAULT 'en',
    onboarding_completed INTEGER DEFAULT 0, last_login_at TEXT, created_at TEXT);
  CREATE TABLE native_auth_providers (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, provider_type TEXT NOT NULL);
  CREATE TABLE native_projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT);
  CREATE TABLE native_project_members (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, project_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', joined_at TEXT, created_at TEXT);
  CREATE TABLE native_rehearsals (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL, created_by INTEGER, created_at TEXT);
  CREATE TABLE native_rehearsal_responses (id INTEGER PRIMARY KEY, rehearsal_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    response TEXT NOT NULL, notes TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE native_user_availability (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL, is_all_day INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT);
  CREATE TABLE native_calendar_connections (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT);
  CREATE TABLE native_push_tokens (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
  CREATE TABLE native_notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL,
    created_at TEXT, read_at TEXT);
  CREATE TABLE native_email_codes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, purpose TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, sent_at TEXT, failed_at TEXT, created_at TEXT NOT NULL);
`;

// id: [email, first, last, registered, timezone]
const PEOPLE = {
  1: ['olga@example.test', 'Olga', 'Owner', ago(20 * D), 'America/Mazatlan'], // 5 Nov, a Thursday
  2: ['ivan@example.test', 'Ivan', 'Invitee', ago(10 * D), 'Europe/Berlin'], // 15 Nov, a Sunday
  3: ['anna@example.test', 'Anna', 'Admin', ago(9 * D), 'UTC'], // 16 Nov, a Monday
  4: ['loner@example.test', 'Lone', 'Ranger', ago(3 * D), 'UTC'], // 22 Nov, a Sunday
  8: ['demo@rehearsly.me', 'Demo', 'Director', ago(30 * D), 'UTC'], // service account
};

function seed({ recorded = true } = {}) {
  sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA);
  if (recorded) sqlite.exec(MIGRATION);
  const person = sqlite.prepare('INSERT INTO native_users (id, email, first_name, last_name, created_at, timezone) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [id, row] of Object.entries(PEOPLE)) person.run(Number(id), ...row);
  const project = sqlite.prepare('INSERT INTO native_projects VALUES (?, ?, ?)');
  project.run(1, 'Hamlet', ago(20 * D));
  project.run(3, 'Demo Hamlet', ago(30 * D));
  const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)`);
  member.run(1, 1, 'owner', ago(20 * D), ago(20 * D));
  member.run(2, 1, 'member', ago(10 * D), ago(10 * D));
  member.run(3, 1, 'admin', ago(9 * D), ago(9 * D));
  member.run(8, 3, 'owner', ago(30 * D), ago(30 * D));
  if (!recorded) return;
  const day = sqlite.prepare('INSERT INTO native_usage_days (user_id, day, app_build) VALUES (?, ?, ?)');
  day.run(1, '2026-11-06', 40); // Olga's day 1
  day.run(1, '2026-11-12', 40); // Olga's day 7
  day.run(1, '2026-11-24', 41); // yesterday in Mazatlán
  day.run(2, '2026-11-25', 42); // today in Berlin
  day.run(3, '2026-11-17', 41); // Anna's day 1
  day.run(3, '2026-11-18', null); // a day without a build header
  day.run(8, '2026-11-25', 99); // service account: counts nowhere
  const invite = sqlite.prepare('INSERT INTO native_invite_counts (project_id, day, page_opens, app_opens, joins) VALUES (?, ?, ?, ?, ?)');
  invite.run(1, '2026-11-20', 5, 3, 2);
  invite.run(1, '2026-11-21', 1, 0, 0);
  invite.run(1, '2026-09-01', 7, 0, 0); // before the last 30 days
  invite.run(3, '2026-11-20', 9, 9, 9); // the demo troupe: left out
}

const get = (path) => request(server).get(path).set('Authorization', `Bearer ${adminToken}`);

beforeAll(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  process.env.JWT_SECRET = 't294-user-secret-fixture-only';
  process.env.ADMIN_JWT_SECRET = 't294-admin-secret-fixture-only';
  process.env.ADMIN_PASSWORD = 't294-admin-password-fixture-only';
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_SERVICE_EMAILS;
  const { default: adminRoutes } = await import('../../routes/admin.js');
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  adminToken = (await request(server).post('/admin/api/login')
    .send({ password: process.env.ADMIN_PASSWORD }).expect(200)).body.token;
});

afterEach(() => sqlite?.close());

afterAll(async () => {
  jest.restoreAllMocks();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

describe('with migration 016', () => {
  beforeEach(() => seed());

  test('active today, in 7 and in 30 days, by each person\'s own date; service accounts nowhere', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    expect(body.usage.recorded).toBe(true);
    expect(body.usage.since).toBe('2026-11-06');
    // Ivan today (Berlin); Olga yesterday in Mazatlán; Anna eight days ago.
    expect(body.usage.active).toEqual({ day: 1, week: 2, month: 3, of: 4 });
    const invited = await get('/admin/api/analytics?source=invite').expect(200);
    expect(invited.body.usage.active).toEqual({ day: 1, week: 1, month: 2, of: 2 });
  });

  test('retention by registration week: day 1, 7 and 30, only days that are over and recorded', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    const none = { opened: 0, of: 0, rate: null };
    expect(body.usage.retention).toEqual([
      { week: '2026-11-16', registered: 2, day1: { opened: 1, of: 2, rate: 50 }, day7: { opened: 0, of: 1, rate: 0 }, day30: none },
      { week: '2026-11-09', registered: 1, day1: { opened: 0, of: 1, rate: 0 }, day7: { opened: 0, of: 1, rate: 0 }, day30: none },
      { week: '2026-11-02', registered: 1, day1: { opened: 1, of: 1, rate: 100 }, day7: { opened: 1, of: 1, rate: 100 }, day30: none },
    ]);
  });

  test('builds among the people active in 30 days: each one\'s latest named build', async () => {
    const { body } = await get('/admin/api/analytics').expect(200);
    expect(body.usage.builds).toEqual([{ build: 42, people: 1 }, { build: 41, people: 2 }]);
  });

  test('each project\'s invitation from page to join, in the period, without the demo troupe', async () => {
    const month = await get('/admin/api/analytics?period=30').expect(200);
    expect(month.body.usage.invitations).toEqual([{ project: 'Hamlet', owner: 'Olga O.', pageOpens: 6, appOpens: 3, joins: 2 }]);
    const all = await get('/admin/api/analytics').expect(200);
    expect(all.body.usage.invitations).toEqual([{ project: 'Hamlet', owner: 'Olga O.', pageOpens: 13, appOpens: 3, joins: 2 }]);
  });

  test('the users table has the last day in the app', async () => {
    const { body } = await get('/admin/api/users?service=1').expect(200);
    expect(body.appDaysRecorded).toBe(true);
    expect(Object.fromEntries(body.users.map((user) => [user.email, user.lastAppDay]))).toEqual({
      'olga@example.test': '2026-11-24', 'ivan@example.test': '2026-11-25', 'anna@example.test': '2026-11-18',
      'loner@example.test': null, 'demo@rehearsly.me': '2026-11-25',
    });
  });

  test('opening the admin deletes what is older than 13 months', async () => {
    sqlite.prepare("INSERT INTO native_usage_days (user_id, day) VALUES (4, '2025-10-24'), (4, '2025-10-25')").run();
    sqlite.prepare("INSERT INTO native_invite_counts (project_id, day, page_opens) VALUES (1, '2025-10-24', 1), (1, '2025-10-25', 1)").run();
    await get('/admin/api/analytics').expect(200);
    expect(sqlite.prepare("SELECT day FROM native_usage_days WHERE user_id = 4").all()).toEqual([{ day: '2025-10-25' }]);
    expect(sqlite.prepare("SELECT day FROM native_invite_counts WHERE day < '2026-01-01'").all()).toEqual([{ day: '2025-10-25' }]);
  });
});

describe('without migration 016', () => {
  beforeEach(() => seed({ recorded: false }));

  test('the figures of use say there is no data, not zeros; the rest still answers', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    expect(body.usage).toEqual({ recorded: false });
    expect(body.people).toBe(4);
    const users = await get('/admin/api/users').expect(200);
    expect(users.body.appDaysRecorded).toBe(false);
    expect(users.body.users.every((user) => user.lastAppDay === null)).toBe(true);
  });

  test('another failure is a failure, not "no data"', async () => {
    seed();
    sqlite.exec('ALTER TABLE native_usage_days DROP COLUMN app_build');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await get('/admin/api/analytics').expect(500);
    } finally {
      error.mockRestore();
    }
  });
});
