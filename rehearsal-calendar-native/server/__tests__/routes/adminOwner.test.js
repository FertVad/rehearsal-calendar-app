/**
 * T-428: the switch "without the app owner's account". The owner is the
 * addresses in ADMIN_OWNER_EMAILS, comma-separated, any case. Switched on
 * (owner=1), their accounts leave every figure and the users table, and the
 * projects they own leave the cards and the tables of projects, invitations
 * and sources; the members of those projects stay people everywhere. Off — the
 * figures as before (the owner's decision of 25.11). Without the variable,
 * owner=1 answers as without it and says so.
 *
 * Through the real admin router and login, over a SQLite fixture with
 * migration 016's own DDL. Synthetic addresses only.
 *
 * "Now" is Wednesday 25 November 2026, 12:00 UTC.
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
const environmentKeys = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_SERVICE_EMAILS',
  'ADMIN_OWNER_EMAILS'];
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

// The owner of the app is listed in another case, with spaces (ADMIN_SERVICE_EMAILS' rule).
const OWNER_EMAILS = ' Boss@Example.TEST , second-owner@example.test';

// id: [email, first, last, registered]
const PEOPLE = {
  1: ['boss@example.test', 'Bob', 'Boss', ago(20 * D)], // the owner of the app
  2: ['mira@example.test', 'Mira', 'Member', ago(10 * D)], // a member of the owner's project
  3: ['stan@example.test', 'Stan', 'Stranger', ago(5 * D)], // someone else, with a project of their own
};

function seed() {
  sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA);
  sqlite.exec(MIGRATION);
  const person = sqlite.prepare('INSERT INTO native_users (id, email, first_name, last_name, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const [id, row] of Object.entries(PEOPLE)) person.run(Number(id), ...row);
  const project = sqlite.prepare('INSERT INTO native_projects VALUES (?, ?, ?)');
  project.run(1, 'Studio', ago(20 * D)); // the owner's
  project.run(2, 'Garage', ago(5 * D)); // the stranger's; the owner is a member of it
  const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)`);
  member.run(1, 1, 'owner', ago(20 * D), ago(20 * D));
  member.run(2, 1, 'member', ago(10 * D), ago(10 * D));
  member.run(3, 2, 'owner', ago(5 * D), ago(5 * D));
  member.run(1, 2, 'member', ago(4 * D), ago(4 * D));
  const rehearsal = sqlite.prepare('INSERT INTO native_rehearsals (project_id, starts_at, ends_at, created_by, created_at) VALUES (?, ?, ?, ?, ?)');
  rehearsal.run(1, ago(3 * D), ago(3 * D - 3600000), 1, ago(19 * D));
  rehearsal.run(1, ago(-2 * D), ago(-2 * D - 3600000), 1, ago(18 * D));
  rehearsal.run(2, ago(-3 * D), ago(-3 * D - 3600000), 3, ago(4 * D));
  sqlite.prepare('INSERT INTO native_push_tokens (user_id) VALUES (?), (?), (?)').run(1, 2, 3);
  const inbox = sqlite.prepare('INSERT INTO native_notifications (user_id, type, created_at, read_at) VALUES (?, ?, ?, ?)');
  inbox.run(1, 'member_joined', ago(4 * D), ago(4 * D)); // the owner's: leaves with them
  inbox.run(2, 'rehearsal_created', ago(3 * D), null);
  const code = sqlite.prepare('INSERT INTO native_email_codes (user_id, purpose, sent_at, created_at) VALUES (?, ?, ?, ?)');
  code.run(1, 'reset', ago(2 * D), ago(2 * D));
  code.run(3, 'verify', ago(5 * D), ago(5 * D));
  const day = sqlite.prepare('INSERT INTO native_usage_days (user_id, day, app_build) VALUES (?, ?, ?)');
  day.run(1, '2026-11-25', 50);
  day.run(2, '2026-11-25', 42);
  day.run(3, '2026-11-24', 42);
  const invite = sqlite.prepare('INSERT INTO native_invite_counts (project_id, day, page_opens, app_opens, joins) VALUES (?, ?, ?, ?, ?)');
  invite.run(1, '2026-11-15', 4, 1, 1);
  invite.run(2, '2026-11-21', 2, 1, 1);
}

const get = (path) => request(server).get(path).set('Authorization', `Bearer ${adminToken}`);

beforeAll(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  process.env.JWT_SECRET = 't428-user-secret-fixture-only';
  process.env.ADMIN_JWT_SECRET = 't428-admin-secret-fixture-only';
  process.env.ADMIN_PASSWORD = 't428-admin-password-fixture-only';
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

beforeEach(() => {
  seed();
  process.env.ADMIN_OWNER_EMAILS = OWNER_EMAILS;
});
afterEach(() => sqlite?.close());

afterAll(async () => {
  jest.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

/** The three answers for one query string. */
async function answers(query = '') {
  const [stats, analytics, users] = await Promise.all([
    get(`/admin/api/stats${query}`).expect(200),
    get(`/admin/api/analytics${query}`).expect(200),
    get(`/admin/api/users${query}`).expect(200),
  ]);
  return { stats: stats.body, analytics: analytics.body, users: users.body };
}

/** Everything the switch changes, off: the figures as before T-428. */
function expectEveryone({ stats, analytics, users }) {
  expect(stats.users.total).toBe(3);
  expect(stats.usage).toEqual({ projects: 2, rehearsals: 3 });
  expect(analytics.people).toBe(3);
  expect(analytics.funnel.total.other.registered).toBe(2);
  expect(analytics.funnel.total.invite.registered).toBe(1);
  expect(analytics.organizers.total).toMatchObject({ registered: 3, project: 2, member: 2 });
  expect(analytics.projects.map((project) => [project.name, project.members])).toEqual([['Studio', 2], ['Garage', 2]]);
  expect(analytics.sources.projects.map((row) => row.project)).toEqual(['Studio', 'Garage']);
  expect(analytics.usage.active).toEqual({ day: 2, week: 3, month: 3, of: 3 });
  expect(analytics.usage.builds).toEqual([{ build: 50, people: 1 }, { build: 42, people: 2 }]);
  expect(analytics.usage.invitations.map((row) => row.project)).toEqual(['Studio', 'Garage']);
  expect(analytics.notifications.devices).toEqual({ people: 3, of: 3, rate: 100 });
  expect(analytics.notifications.inbox.map((row) => row.type)).toEqual(['member_joined', 'rehearsal_created']);
  expect(analytics.notifications.emailCodes.map((row) => row.purpose)).toEqual(['reset', 'verify']);
  expect(users.total).toBe(3);
  expect(users.users.map((user) => user.id)).toEqual([3, 2, 1]);
}

describe('the switch without the app owner\'s account', () => {
  it('off: every figure as before, the owner and their project in them', async () => {
    const off = await answers();
    expectEveryone(off);
    for (const body of Object.values(off)) expect(body.owner).toEqual({ configured: true, excluded: false });
    expectEveryone(await answers('?owner=0'));
  });

  it('on: neither the owner nor their project; their project\'s member stays', async () => {
    const { stats, analytics, users } = await answers('?owner=1');
    for (const body of [stats, analytics, users]) expect(body.owner).toEqual({ configured: true, excluded: true });

    // The cards: two people; the stranger's project and its one rehearsal.
    expect(stats.users).toEqual({ total: 2, newThisWeek: 1, newThisMonth: 2 });
    expect(stats.usage).toEqual({ projects: 1, rehearsals: 1 });

    // People: the member stays, invited into the owner's project.
    expect(analytics.people).toBe(2);
    expect(analytics.funnel.total.invite.registered).toBe(1);
    expect(analytics.funnel.total.other.registered).toBe(1);
    // The owner is no member of the stranger's project in the organiser funnel.
    expect(analytics.organizers.total).toMatchObject({ registered: 2, project: 1, member: 0 });
    expect(analytics.sources.byDay.map((row) => [row.date, row.invite, row.own])).toEqual([
      ['2026-11-20', 0, 1], ['2026-11-15', 1, 0]]);

    // Projects: the owner's leaves the table, and they leave the other's members.
    expect(analytics.projects.map((project) => [project.name, project.members])).toEqual([['Garage', 1]]);
    // Where people come from: Studio is the owner's; nobody counted joined Garage.
    expect(analytics.sources.projects).toEqual([]);

    // Use: the owner's day and build; the owner's project's invitation.
    expect(analytics.usage.active).toEqual({ day: 1, week: 2, month: 2, of: 2 });
    expect(analytics.usage.builds).toEqual([{ build: 42, people: 2 }]);
    expect(analytics.usage.invitations.map((row) => row.project)).toEqual(['Garage']);

    // Notifications and codes: the owner's leave with them.
    expect(analytics.notifications.devices).toEqual({ people: 2, of: 2, rate: 100 });
    expect(analytics.notifications.inbox.map((row) => row.type)).toEqual(['rehearsal_created']);
    expect(analytics.notifications.emailCodes.map((row) => row.purpose)).toEqual(['verify']);

    // The users table: the member, with where they came from.
    expect(users.total).toBe(2);
    expect(users.users.map((user) => user.id)).toEqual([3, 2]);
    expect(users.users[1].source).toEqual({ kind: 'invite', project: 'Studio', owner: 'Bob B.' });
  });

  it('on, with the service accounts shown: the owner still out of the users table', async () => {
    const { body } = await get('/admin/api/users?owner=1&service=1').expect(200);
    expect(body.users.map((user) => user.id)).toEqual([3, 2]);
  });

  it('without ADMIN_OWNER_EMAILS: owner=1 answers as without it, and says so', async () => {
    delete process.env.ADMIN_OWNER_EMAILS;
    const unset = await answers('?owner=1');
    expectEveryone(unset);
    for (const body of Object.values(unset)) expect(body.owner).toEqual({ configured: false, excluded: false });
    process.env.ADMIN_OWNER_EMAILS = ' , ';
    const blank = await answers('?owner=1');
    expectEveryone(blank);
    for (const body of Object.values(blank)) expect(body.owner).toEqual({ configured: false, excluded: false });
  });

  it('refuses anything but 0 or 1', async () => {
    for (const path of ['stats', 'analytics', 'users']) {
      const { body } = await get(`/admin/api/${path}?owner=yes`).expect(400);
      expect(body.error).toBe('owner must be 0 or 1');
    }
  });
});
