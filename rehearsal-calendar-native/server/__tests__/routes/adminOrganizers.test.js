/**
 * T-427: the organiser's funnel — those who created their own project, by
 * registration week — its median, and the same steps in the test cohort,
 * through the real admin router and login, over a SQLite fixture with
 * migration 016's own DDL.
 *
 * "Now" is Wednesday 25 November 2026, 12:00 UTC; everyone's zone is UTC.
 * Leaving a project deletes the membership row (routes/native/members.js), and
 * deleting a project deletes it and, by cascade, its invitation counts; the
 * fixture's members and rehearsals have no foreign keys, so a deleted
 * project's rows are left behind on purpose — they must not count either.
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

const MEMBERS_REGISTERED = '2026-11-16T10:00:00.000Z';
// id: [email, registered]
const PEOPLE = {
  // Week of 2 November.
  1: ['none@example.test', '2026-11-02T08:00:00.000Z'], // no project
  2: ['bare@example.test', '2026-11-02T09:00:00.000Z'], // a project, nobody invited, nothing in it
  3: ['opened@example.test', '2026-11-02T10:00:00.000Z'], // the invitation opened, nobody joined; a rehearsal 24 h on
  4: ['spread@example.test', '2026-11-03T10:00:00.000Z'], // 1 member in one project, 2 (and a service account) in another
  5: ['full@example.test', '2026-11-03T12:00:00.000Z'], // 3 in one, the third on day 9; rehearsals in someone else's project
  6: ['left@example.test', '2026-11-04T10:00:00.000Z'], // 3 joins counted, one still there, one left, one not active
  7: ['deleted@example.test', '2026-11-04T12:00:00.000Z'], // only a project since deleted
  // Week of 9 November.
  8: ['two@example.test', '2026-11-10T08:00:00.000Z'], // opened in the app; two rehearsals, the second on day 10
  // The week before the cohort below: no project.
  9: ['early@example.test', '2026-10-30T08:00:00.000Z'],
  // Week of 16 November: full@ is a member of their project, and creates rehearsals there.
  10: ['host@example.test', '2026-11-16T09:00:00.000Z'],
  // The members, all registered in the week of 16 November.
  11: ['m11@example.test', MEMBERS_REGISTERED],
  12: ['m12@example.test', MEMBERS_REGISTERED],
  13: ['m13@example.test', MEMBERS_REGISTERED],
  14: ['m14@example.test', MEMBERS_REGISTERED],
  15: ['m15@example.test', MEMBERS_REGISTERED],
  16: ['m16@example.test', MEMBERS_REGISTERED],
  17: ['m17@example.test', MEMBERS_REGISTERED],
  18: ['m18@example.test', MEMBERS_REGISTERED],
  19: ['cast@demo.rehearsly.me', MEMBERS_REGISTERED],
};

function seed() {
  sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA);
  sqlite.exec(MIGRATION);
  const person = sqlite.prepare(`INSERT INTO native_users (id, email, first_name, created_at, onboarding_completed, locale, timezone)
    VALUES (?, ?, 'Person', ?, 1, 'en', 'UTC')`);
  for (const [id, [email, created]] of Object.entries(PEOPLE)) person.run(Number(id), email, created);
  const project = sqlite.prepare('INSERT INTO native_projects VALUES (?, ?, ?)');
  for (const [id, created] of [[2, '2026-11-02T10:00'], [3, '2026-11-02T11:00'], [4, '2026-11-03T11:00'],
    [5, '2026-11-03T12:00'], [6, '2026-11-03T13:00'], [7, '2026-11-04T11:00'], [8, '2026-11-10T09:00'],
    [10, '2026-11-16T09:30'], [99, '2026-11-04T13:00']]) {
    project.run(id, `Project ${id}`, `${created}:00.000Z`);
  }
  const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const join = (user, projectId, role, at, status = 'active') => member.run(user, projectId, role, status, at, at);
  join(2, 2, 'owner', '2026-11-02T10:00:00.000Z');
  join(3, 3, 'owner', '2026-11-02T11:00:00.000Z');
  join(4, 4, 'owner', '2026-11-03T11:00:00.000Z');
  join(4, 5, 'owner', '2026-11-03T12:00:00.000Z');
  join(5, 6, 'owner', '2026-11-03T13:00:00.000Z');
  join(6, 7, 'owner', '2026-11-04T11:00:00.000Z');
  join(7, 99, 'owner', '2026-11-04T13:00:00.000Z');
  join(8, 8, 'owner', '2026-11-10T09:00:00.000Z');
  join(11, 4, 'member', '2026-11-04T10:00:00.000Z');
  join(12, 5, 'member', '2026-11-05T10:00:00.000Z');
  join(13, 5, 'member', '2026-11-05T11:00:00.000Z');
  join(19, 5, 'member', '2026-11-05T12:00:00.000Z'); // a service account is not a member here
  join(14, 6, 'member', '2026-11-04T10:00:00.000Z');
  join(15, 6, 'member', '2026-11-05T10:00:00.000Z');
  join(16, 6, 'member', '2026-11-12T13:00:00.000Z'); // the third: day 9 after full@ registered
  join(10, 10, 'owner', '2026-11-16T09:30:00.000Z');
  join(5, 10, 'member', '2026-11-16T10:00:00.000Z'); // full@ in host@'s project
  join(17, 7, 'member', '2026-11-05T10:00:00.000Z');
  join(18, 7, 'member', '2026-11-05T11:00:00.000Z', 'invited'); // not an active member
  join(11, 99, 'member', '2026-11-05T10:00:00.000Z');
  join(12, 99, 'member', '2026-11-05T10:00:00.000Z');
  join(13, 99, 'member', '2026-11-05T10:00:00.000Z');
  const rehearsal = sqlite.prepare(`INSERT INTO native_rehearsals (project_id, starts_at, ends_at, created_by, created_at)
    VALUES (?, '2026-12-01T18:00:00.000Z', '2026-12-01T20:00:00.000Z', ?, ?)`);
  rehearsal.run(3, 3, '2026-11-03T10:00:00.000Z'); // opened@: 24 h after registering
  rehearsal.run(10, 5, '2026-11-16T11:00:00.000Z'); // full@, in someone else's project: neither is theirs
  rehearsal.run(10, 5, '2026-11-16T12:00:00.000Z');
  rehearsal.run(6, 5, '2026-11-05T12:00:00.000Z'); // full@: 48 h
  rehearsal.run(6, 14, '2026-11-05T13:00:00.000Z'); // a member's, in full@'s project: not full@'s second
  rehearsal.run(8, 8, '2026-11-10T10:00:00.000Z'); // two@: 2 h
  rehearsal.run(8, 8, '2026-11-20T10:00:00.000Z'); // two@'s second, on day 10
  rehearsal.run(99, 7, '2026-11-04T14:00:00.000Z'); // in the project since deleted
  rehearsal.run(99, 7, '2026-11-04T15:00:00.000Z');
  const invite = sqlite.prepare('INSERT INTO native_invite_counts (project_id, day, page_opens, app_opens, joins) VALUES (?, ?, ?, ?, ?)');
  invite.run(2, '2026-11-03', 0, 0, 0); // a row of nothing is not an opening
  invite.run(3, '2026-11-04', 2, 0, 0);
  invite.run(7, '2026-11-05', 0, 0, 3);
  invite.run(8, '2026-11-10', 0, 1, 0);
  invite.run(99, '2026-11-05', 4, 2, 3);
  // Deleted: native_projects' cascade takes its counts with it; its members and
  // rehearsals stay behind in the fixture.
  sqlite.prepare('DELETE FROM native_projects WHERE id = 99').run();
  sqlite.prepare('INSERT INTO native_usage_days (user_id, day, app_build) VALUES (?, ?, 42)').run(11, '2026-11-02');
}

const get = (path) => request(server).get(path).set('Authorization', `Bearer ${adminToken}`);
const steps = (registered, project, invite, member, threeMembers, firstRehearsal, secondRehearsal) => ({
  registered, project, invite, member, threeMembers, firstRehearsal, secondRehearsal,
});

beforeAll(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  process.env.JWT_SECRET = 't427-user-secret-fixture-only';
  process.env.ADMIN_JWT_SECRET = 't427-admin-secret-fixture-only';
  process.env.ADMIN_PASSWORD = 't427-admin-password-fixture-only';
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

describe('the organiser funnel', () => {
  test('by registration week: own project, the invitation opened, members in one project, own rehearsals', async () => {
    const { body } = await get('/admin/api/analytics').expect(200);
    expect(body.organizers.weeks).toEqual([
      // host@ and the members: full@ joined host@'s project; rehearsals there are full@'s, not host@'s.
      { week: '2026-11-16', ...steps(9, 1, 1, 1, 0, 0, 0) },
      // two@: opened in the app, both rehearsals as of now (the second on day 10).
      { week: '2026-11-09', ...steps(1, 1, 1, 0, 0, 1, 1) },
      // Projects: bare, opened, spread, full, left — not none, not deleted.
      // Invitation: opened (an opening alone), spread and full (members), left (joins counted).
      // Members: spread (2 in one), full (3 in one), left (one still there).
      // 3 and more: full only — spread's 1 + 2 are in different projects, left's 3 joins are one member now.
      // Rehearsals: opened, full (their own project's; not the two in opened's project) — not deleted's.
      { week: '2026-11-02', ...steps(7, 5, 4, 3, 1, 2, 0) },
      { week: '2026-10-26', ...steps(1, 0, 0, 0, 0, 0, 0) },
    ]);
    expect(body.organizers.total).toEqual(steps(18, 7, 6, 4, 1, 3, 1));
    // 2 h, 24 h, 48 h.
    expect(body.organizers.median).toEqual({ toFirstRehearsalHours: 24, toFirstRehearsalOf: 3 });
  });

  test('the period and the filters choose the people, as in the newcomer funnel', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-09&to=2026-11-15').expect(200);
    expect(body.organizers).toEqual({
      weeks: [{ week: '2026-11-09', ...steps(1, 1, 1, 0, 0, 1, 1) }],
      total: steps(1, 1, 1, 0, 0, 1, 1),
      median: { toFirstRehearsalHours: 2, toFirstRehearsalOf: 1 },
    });
    const invited = await get('/admin/api/analytics?source=invite').expect(200);
    expect(invited.body.organizers.total).toEqual(steps(7, 0, 0, 0, 0, 0, 0));
    expect(invited.body.organizers.median).toEqual({ toFirstRehearsalHours: null, toFirstRehearsalOf: 0 });
  });

  test('without migration 016 the invitation counts only as a join', async () => {
    sqlite.exec('DROP TABLE native_invite_counts');
    sqlite.exec('DROP TABLE native_usage_days');
    const { body } = await get('/admin/api/analytics').expect(200);
    // opened@ and two@ had openings only; left@ still has a member.
    expect(body.organizers.total).toEqual(steps(18, 7, 4, 4, 1, 3, 1));
  });
});

describe('the organiser steps in the test cohort', () => {
  test('within seven days of registering, of those who created a project within them', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-02&to=2026-11-08&cohort=1').expect(200);
    expect(body.cohort.test).toMatchObject({
      registered: 7,
      project: { count: 5, of: 7, rate: 71.4 },
      // opened's opening on day 2, spread's and full's members, left's join.
      invite: { count: 4, of: 5, rate: 80 },
      member: { count: 3, of: 5, rate: 60 },
      // full@'s third member came on day 9.
      threeMembers: { count: 0, of: 5, rate: 0 },
      firstRehearsal: { count: 2, of: 5, rate: 40 },
      secondRehearsal: { count: 0, of: 5, rate: 0 },
    });
    // Nobody in the week before created a project: no figure, not 0 — and not
    // the empty cell of a time not yet up.
    const none = { count: 0, of: 0, rate: null };
    expect(body.cohort.before).toMatchObject({
      registered: 1, project: { count: 0, of: 1, rate: 0 },
      invite: none, member: none, threeMembers: none, firstRehearsal: none, secondRehearsal: none,
    });
  });

  test('a step whose seven days are not over is an empty cell', async () => {
    const { body } = await get('/admin/api/analytics?from=2026-11-20&to=2026-11-25&cohort=1').expect(200);
    expect(body.cohort.test).toMatchObject({
      registered: 0, project: null, invite: null, member: null, threeMembers: null, firstRehearsal: null, secondRehearsal: null,
    });
  });
});
