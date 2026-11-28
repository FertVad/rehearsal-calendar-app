/**
 * T-425: registration dates to the day, the test cohort and the week before it,
 * through the real admin router and login, over a SQLite fixture with
 * migration 016's own DDL.
 *
 * "Now" is Wednesday 25 November 2026, 12:00 UTC. The test runs 10–16 November
 * (UTC, both days in); the week before it is 3–9 November. Everyone's zone is
 * UTC, so their own dates (usage.js) are the UTC ones.
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

const NOW = Date.parse('2026-11-25T12:00:00.000Z');
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
    ends_at TEXT NOT NULL, created_by INTEGER);
  CREATE TABLE native_rehearsal_responses (id INTEGER PRIMARY KEY, rehearsal_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    response TEXT NOT NULL, notes TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE native_user_availability (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL, is_all_day INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT);
  CREATE TABLE native_calendar_connections (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
  CREATE TABLE native_push_tokens (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
  CREATE TABLE native_notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL,
    created_at TEXT, read_at TEXT);
  CREATE TABLE native_email_codes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, purpose TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, sent_at TEXT, failed_at TEXT, created_at TEXT NOT NULL);
`;

// id: [email, registered, onboarding, locale]
const PEOPLE = {
  // The test's first instant: an own project the same day, marks, back on days 1 and 7.
  1: ['first@example.test', '2026-11-10T00:00:00.000Z', 1, 'en'],
  // The test's last millisecond: no project, nothing else.
  2: ['last@example.test', '2026-11-16T23:59:59.999Z', 0, 'en'],
  // Midnight after the test: in neither column.
  3: ['after@example.test', '2026-11-17T00:00:00.000Z', 0, 'en'],
  // Invited during the test: never in the cohort.
  4: ['invited@example.test', '2026-11-12T09:00:00.000Z', 1, 'en'],
  // The last millisecond of the week before; their project came ten days later.
  5: ['late@example.test', '2026-11-09T23:59:59.999Z', 1, 'en'],
  // The first day of the week before: marks, back on day 1.
  6: ['early@example.test', '2026-11-03T00:00:00.000Z', 0, 'en'],
  // Before the week before.
  7: ['before@example.test', '2026-11-02T23:59:59.999Z', 1, 'en'],
  // During the test, but another language.
  8: ['german@example.test', '2026-11-11T08:00:00.000Z', 1, 'de'],
  // During the test, a service account.
  9: ['demo@demo.rehearsly.me', '2026-11-11T08:00:00.000Z', 1, 'en'],
  // Five days ago: their seven days are not over.
  10: ['recent@example.test', '2026-11-20T10:00:00.000Z', 1, 'en'],
};

function seed() {
  sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA);
  sqlite.exec(MIGRATION);
  const person = sqlite.prepare(`INSERT INTO native_users (id, email, first_name, created_at, onboarding_completed, locale, timezone)
    VALUES (?, ?, 'Person', ?, ?, ?, 'UTC')`);
  for (const [id, [email, created, onboarding, locale]] of Object.entries(PEOPLE)) {
    person.run(Number(id), email, created, onboarding, locale);
  }
  const project = sqlite.prepare('INSERT INTO native_projects VALUES (?, ?, ?)');
  project.run(1, 'First', '2026-11-10T05:00:00.000Z');
  project.run(5, 'Late', '2026-11-20T10:00:00.000Z');
  project.run(10, 'Recent', '2026-11-20T11:00:00.000Z');
  const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)`);
  member.run(1, 1, 'owner', '2026-11-10T05:00:00.000Z', '2026-11-10T05:00:00.000Z');
  member.run(4, 1, 'member', '2026-11-12T09:30:00.000Z', '2026-11-12T09:30:00.000Z');
  member.run(5, 5, 'owner', '2026-11-20T10:00:00.000Z', '2026-11-20T10:00:00.000Z');
  member.run(10, 10, 'owner', '2026-11-20T11:00:00.000Z', '2026-11-20T11:00:00.000Z');
  const mark = sqlite.prepare(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
    VALUES (?, ?, ?, 0, 'manual', ?)`);
  mark.run(1, '2026-11-13T10:00:00.000Z', '2026-11-13T12:00:00.000Z', '2026-11-12T08:00:00.000Z');
  mark.run(6, '2026-11-06T10:00:00.000Z', '2026-11-06T12:00:00.000Z', '2026-11-05T08:00:00.000Z');
  const day = sqlite.prepare('INSERT INTO native_usage_days (user_id, day, app_build) VALUES (?, ?, 42)');
  day.run(6, '2026-11-04'); // day 1 of the first day of the week before; records begin here
  day.run(1, '2026-11-11'); // day 1
  day.run(1, '2026-11-17'); // day 7
  day.run(10, '2026-11-21'); // day 1
}

const get = (path) => request(server).get(path).set('Authorization', `Bearer ${adminToken}`);
const TEST = '/admin/api/analytics?from=2026-11-10&to=2026-11-16&cohort=1';

beforeAll(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  process.env.JWT_SECRET = 't425-user-secret-fixture-only';
  process.env.ADMIN_JWT_SECRET = 't425-admin-secret-fixture-only';
  process.env.ADMIN_PASSWORD = 't425-admin-password-fixture-only';
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

beforeEach(() => seed());
afterEach(() => sqlite?.close());

afterAll(async () => {
  jest.restoreAllMocks();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

describe('the test cohort and the week before it', () => {
  test('both columns: registrations, onboarding now, steps within seven days, days 1 and 7', async () => {
    const { body } = await get(TEST + '&lang=en').expect(200);
    expect(body.cohort).toEqual({
      stepDays: 7,
      recorded: true,
      test: {
        from: '2026-11-10', to: '2026-11-16', days: 7, registered: 2, perDay: 0.3,
        onboarding: { count: 1, of: 2, rate: 50 },
        project: { count: 1, of: 2, rate: 50 },
        inProject: { count: 1, of: 2, rate: 50 },
        marks: { count: 1, of: 2, rate: 50 },
        day1: { count: 1, of: 2, rate: 50 },
        day7: { count: 1, of: 2, rate: 50 },
      },
      before: {
        from: '2026-11-03', to: '2026-11-09', days: 7, registered: 2, perDay: 0.3,
        onboarding: { count: 1, of: 2, rate: 50 },
        // Their project came ten days after registering: not within seven.
        project: { count: 0, of: 2, rate: 0 },
        inProject: { count: 0, of: 2, rate: 0 },
        marks: { count: 1, of: 2, rate: 50 },
        day1: { count: 1, of: 2, rate: 50 },
        day7: { count: 0, of: 2, rate: 0 },
      },
    });
    // Every other section reads the same people: the cohort itself.
    expect(body.people).toBe(2);
    expect(body.sources.byDay.map((row) => row.date)).toEqual(['2026-11-16', '2026-11-10']);
  });

  test('without a language filter, every language the cohort has; the service account nowhere', async () => {
    const { body } = await get(TEST).expect(200);
    expect(body.cohort.test.registered).toBe(3);
    expect(body.cohort.test.perDay).toBe(0.4);
  });

  test('a step whose seven days are not over is an empty cell, not 0; so is a day not yet over', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-20&to=2026-11-25&cohort=1').expect(200);
    expect(body.cohort.test).toMatchObject({
      from: '2026-11-20', to: '2026-11-25', days: 6, registered: 1,
      onboarding: { count: 1, of: 1, rate: 100 },
      project: null, inProject: null, marks: null,
      day1: { count: 1, of: 1, rate: 100 },
      day7: null,
    });
  });

  test('a single day', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-16&to=2026-11-16&cohort=1&lang=en').expect(200);
    expect(body.cohort.test).toMatchObject({ from: '2026-11-16', to: '2026-11-16', days: 1, registered: 1, perDay: 1 });
    expect(body.cohort.before).toMatchObject({ from: '2026-11-09', to: '2026-11-15', registered: 2 });
  });

  test('a test still running: per day over the days begun, today (UTC) in; none begun, no figure', async () => {
    // 20–30 November with "now" 25 November: six days begun (20–25), not eleven.
    const running = await get('/admin/api/analytics?from=2026-11-20&to=2026-11-30&cohort=1').expect(200);
    expect(running.body.cohort.test).toMatchObject({ from: '2026-11-20', to: '2026-11-30', days: 11, registered: 1, perDay: 0.2 });
    // The week before is always whole: divided by seven.
    expect(running.body.cohort.before).toMatchObject({ from: '2026-11-13', to: '2026-11-19', registered: 2, perDay: 0.3 });
    // Starts tomorrow: nothing to divide by, an empty cell rather than 0.
    const future = await get('/admin/api/analytics?from=2026-11-26&to=2026-11-30&cohort=1').expect(200);
    expect(future.body.cohort.test).toMatchObject({ days: 5, registered: 0, perDay: null });
  });

  test('without migration 016 the days are empty, the steps still counted', async () => {
    sqlite.exec('DROP TABLE native_usage_days');
    const { body } = await get(TEST + '&lang=en').expect(200);
    expect(body.cohort.recorded).toBe(false);
    expect(body.cohort.test).toMatchObject({ day1: null, day7: null, project: { count: 1, of: 2, rate: 50 } });
  });
});

describe('dates without the cohort', () => {
  test('both days in, to the millisecond; every source', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-10&to=2026-11-16').expect(200);
    expect(body.period).toBe('dates');
    expect(body.cohort).toBeUndefined();
    // first, last, invited, german — not "after", not the service account.
    expect(body.people).toBe(4);
    const users = await get('/admin/api/users?from=2026-11-10&to=2026-11-16').expect(200);
    expect(users.body.users.map((user) => user.email).sort())
      .toEqual(['first@example.test', 'german@example.test', 'invited@example.test', 'last@example.test']);
    const cohort = await get('/admin/api/users?from=2026-11-10&to=2026-11-16&cohort=1').expect(200);
    expect(cohort.body.total).toBe(3);
  });

  test('the period still means what it did without dates', async () => {
    const { body } = await get('/admin/api/analytics?period=7').expect(200);
    expect(body.people).toBe(1);
    expect(body.cohort).toBeUndefined();
  });
});

describe('refused before any work', () => {
  test.each([
    ['from after to', 'from=2026-11-16&to=2026-11-10', 'DATES_ORDER'],
    ['no such day', 'from=2026-11-31&to=2026-12-01', 'DATES_FORMAT'],
    ['not the format', 'from=2026-1-5&to=2026-11-10', 'DATES_FORMAT'],
    ['a time in it', 'from=2026-11-01T00:00&to=2026-11-10', 'DATES_FORMAT'],
    ['one of the two', 'from=2026-11-01', 'DATES_MISSING'],
    ['longer than the cap', 'from=2025-11-24&to=2026-11-25', 'DATES_TOO_LONG'],
    ['the millennium', 'from=0001-01-01&to=9999-12-31', 'DATES_TOO_LONG'],
    ['dates and a period', 'period=30&from=2026-11-10&to=2026-11-16', 'DATES_PERIOD'],
    ['the cohort without dates', 'period=30&cohort=1', 'COHORT_DATES'],
    ['the cohort with a source', 'from=2026-11-10&to=2026-11-16&cohort=1&source=invite', 'COHORT_SOURCE'],
  ])('%s', async (_name, query, code) => {
    for (const route of ['analytics', 'stats', 'users']) {
      const { body } = await get(`/admin/api/${route}?${query}`).expect(400);
      expect(body.code).toBe(code);
      expect(typeof body.error).toBe('string');
    }
  });

  test('the cap is 366 days, both ends counted', async () => {
    const { body } = await get('/admin/api/analytics?from=2025-11-24&to=2026-11-25').expect(400);
    expect(body).toMatchObject({ code: 'DATES_TOO_LONG', maxDays: 366 });
    await get('/admin/api/analytics?from=2025-11-25&to=2026-11-25').expect(200);
  });
});
