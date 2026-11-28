/**
 * T-293: the admin says who came from where and how far they got — from what
 * the database already keeps. Real admin router and authentication over a
 * SQLite fixture of the tables it reads; only PostgreSQL parameter syntax is
 * translated. The same routes run on PostgreSQL in __tests__/postgres/t293Admin.mjs.
 *
 * "Now" is fixed at Wednesday 25 November 2026, 12:00 UTC, so weeks, medians and
 * the 14-day edge are exact.
 */
import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

const NOW = Date.parse('2026-11-25T12:00:00.000Z');
const H = 60 * 60 * 1000;
const D = 24 * H;
const at = (ms) => new Date(ms).toISOString();
const ago = (ms) => at(NOW - ms);

let sqlite;
let server;
let adminToken;
let userToken;
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

// id: [email, first, last, registered, locale, timezone, onboarding, password]
const PEOPLE = {
  1: ['olga@example.test', 'Olga', 'Owner', ago(20 * D), 'ru', 'America/Mazatlan', 1, null],
  2: ['ivan@example.test', 'Ivan', 'Invitee', ago(10 * D), 'en', 'Europe/Berlin', 1, null],
  3: ['anna@example.test', 'Anna', 'Admin', ago(9 * D), 'en', 'UTC', 0, null],
  4: ['loner@example.test', 'Lone', 'Ranger', ago(3 * D), 'es', 'UTC', 0, null],
  5: ['left@example.test', 'Leo', 'Left', ago(8 * D), 'en', 'UTC', 1, 'hash'],
  6: ['removed@example.test', 'Rem', 'Oved', ago(60 * D), 'en', 'UTC', 1, null],
  7: ['old@example.test', 'Otto', 'Old', ago(200 * D), 'de', 'UTC', 1, null],
  // Service accounts: the two domains, and one address listed by the owner.
  8: ['demo@rehearsly.me', 'Demo', 'Director', ago(30 * D), 'en', 'UTC', 1, null],
  9: ['maria@demo.rehearsly.me', 'Maria', 'Kovacs', ago(5 * D), 'en', 'UTC', 1, null],
  10: ['Listed@Example.test', 'Lena', 'Service', ago(100 * D), 'ru', 'UTC', 1, null],
};

function seed() {
  sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA);
  const person = sqlite.prepare('INSERT INTO native_users VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)');
  for (const [id, [email, first, last, created, locale, zone, onboarding, password]] of Object.entries(PEOPLE)) {
    person.run(Number(id), email, password, first, last, zone, locale, onboarding, created);
  }
  const provider = sqlite.prepare('INSERT INTO native_auth_providers (user_id, provider_type) VALUES (?, ?)');
  [[1, 'apple'], [2, 'google'], [3, 'apple'], [3, 'email'], [4, 'email']].forEach((row) => provider.run(...row));

  const project = sqlite.prepare('INSERT INTO native_projects VALUES (?, ?, ?)');
  project.run(1, 'Hamlet', ago(20 * D));
  project.run(2, 'Second', ago(5 * D));
  project.run(3, 'Demo Hamlet', ago(30 * D));
  project.run(4, "Owner's troupe", ago(150 * D));
  const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  member.run(1, 1, 'owner', 'active', ago(20 * D - 1 * H), ago(20 * D - 1 * H));
  member.run(2, 1, 'member', 'active', ago(10 * D - 3 * H), ago(10 * D - 3 * H));
  // Joined Hamlet by invitation and was made an admin; created a project of their own later.
  member.run(3, 1, 'admin', 'active', ago(9 * D - 1 * H), ago(9 * D - 1 * H));
  member.run(3, 2, 'owner', 'active', ago(5 * D), ago(5 * D));
  member.run(9, 1, 'member', 'active', ago(4 * D), ago(4 * D));
  member.run(8, 3, 'owner', 'active', ago(30 * D), ago(30 * D));
  member.run(9, 3, 'member', 'active', ago(5 * D), ago(5 * D));
  member.run(10, 4, 'owner', 'active', ago(150 * D), ago(150 * D));
  member.run(7, 4, 'member', 'active', ago(100 * D), ago(100 * D));
  // Removed from Hamlet: the membership is gone, a leftover roster row is not.

  const rehearsal = sqlite.prepare('INSERT INTO native_rehearsals (id, project_id, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?)');
  rehearsal.run(1, 1, ago(2 * D), ago(2 * D - 2 * H), 1);
  rehearsal.run(3, 1, at(NOW + 3 * D), at(NOW + 3 * D + 2 * H), 1);
  rehearsal.run(4, 1, ago(1 * D), ago(1 * D - 2 * H), 3);
  rehearsal.run(5, 3, ago(3 * D), ago(3 * D - 2 * H), 8);
  rehearsal.run(6, 4, ago(50 * D), ago(50 * D - 2 * H), 10);
  const answer = sqlite.prepare(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`);
  answer.run(1, 1, 'yes', ago(4 * D), ago(3 * D));
  answer.run(1, 2, 'yes', ago(4 * D), ago(2 * D + 1 * H));
  answer.run(1, 3, 'no', ago(4 * D), ago(4 * D));
  answer.run(1, 6, 'yes', ago(4 * D), ago(3 * D)); // removed from the project: on nothing
  answer.run(4, 3, 'yes', ago(3 * D), ago(12 * H)); // seen after the start
  answer.run(3, 2, 'yes', ago(2 * D), ago(1 * D)); // not started yet

  const mark = sqlite.prepare(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  // Today is 25 November (UTC); the 14 dates run to 8 December. 9 December is outside.
  mark.run(1, '2026-12-08T00:00:00.000Z', '2026-12-08T23:59:59.999Z', 1, 'manual', ago(20 * D - 2 * H));
  // Ends at 03:00 UTC on the 10th: the 9th in Mazatlán.
  mark.run(1, '2026-12-10T01:00:00.000Z', '2026-12-10T03:00:00.000Z', 0, 'manual', ago(19 * D));
  mark.run(2, '2026-12-09T00:00:00.000Z', '2026-12-09T23:59:59.999Z', 1, 'manual', ago(10 * D - 5 * H));
  mark.run(2, ago(2 * D), ago(2 * D - 1 * H), 0, 'manual', ago(9 * D));
  mark.run(2, at(NOW + 1 * D), at(NOW + 1 * D + 2 * H), 0, 'rehearsal', ago(1 * D)); // booked by the server: not a mark
  mark.run(3, at(NOW + 2 * H), at(NOW + 3 * H), 0, 'apple_calendar', ago(9 * D - 4 * H));
  mark.run(9, at(NOW + 2 * H), at(NOW + 3 * H), 0, 'manual', ago(1 * D)); // service account
  sqlite.prepare('INSERT INTO native_calendar_connections (user_id) VALUES (3)').run();
  sqlite.prepare('INSERT INTO native_push_tokens (user_id) VALUES (1)').run();
  sqlite.prepare('INSERT INTO native_push_tokens (user_id) VALUES (9)').run();

  const notice = sqlite.prepare('INSERT INTO native_notifications (user_id, type, created_at, read_at) VALUES (?, ?, ?, ?)');
  notice.run(1, 'member_joined', ago(10 * D), ago(10 * D - 30 * 60 * 1000));
  notice.run(1, 'member_joined', ago(9 * D), null);
  notice.run(2, 'rehearsal_created', ago(4 * D), ago(4 * D - 60 * 60 * 1000));
  notice.run(9, 'rehearsal_created', ago(4 * D), ago(4 * D - 1000)); // service account
  notice.run(1, 'member_joined', ago(40 * D), null); // before the period

  const code = sqlite.prepare(`INSERT INTO native_email_codes (id, user_id, purpose, attempts, consumed_at, sent_at, failed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  code.run(1, 4, 'verify', 0, ago(3 * D - 2 * 60 * 1000), ago(3 * D), null, ago(3 * D)); // replaced by 2
  code.run(2, 4, 'verify', 1, ago(3 * D - 5 * 60 * 1000), ago(3 * D - 2 * 60 * 1000), null, ago(3 * D - 2 * 60 * 1000)); // used
  code.run(3, 4, 'reset', 0, null, null, ago(2 * D), ago(2 * D)); // refused by the provider
  code.run(4, 5, 'reset', 5, ago(7 * D), ago(8 * D), null, ago(8 * D)); // locked
  code.run(5, 9, 'verify', 0, ago(1 * D), ago(1 * D), null, ago(1 * D)); // service account
}

const get = (path, token = adminToken) => request(server).get(path).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  process.env.JWT_SECRET = 't293-user-secret-fixture-only';
  process.env.ADMIN_JWT_SECRET = 't293-admin-secret-fixture-only';
  process.env.ADMIN_PASSWORD = 't293-admin-password-fixture-only';
  delete process.env.ADMIN_PASSWORD_HASH;
  const { default: adminRoutes } = await import('../../routes/admin.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  adminToken = (await request(server).post('/admin/api/login')
    .send({ password: process.env.ADMIN_PASSWORD }).expect(200)).body.token;
  userToken = generateTokens(1, 1).accessToken;
});

beforeEach(() => {
  process.env.ADMIN_SERVICE_EMAILS = ' listed@example.test , other@example.test';
  seed();
});
afterEach(() => sqlite?.close());

afterAll(async () => {
  jest.restoreAllMocks();
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

const byEmail = (users) => Object.fromEntries(users.map((user) => [user.email, user]));

describe('service accounts', () => {
  test('count in no figure: both domains and the listed addresses', async () => {
    const { body } = await get('/admin/api/stats').expect(200);
    expect(body.users).toEqual({ total: 7, newThisWeek: 1, newThisMonth: 5 });
    // Demo Hamlet goes (its owner is on rehearsly.me); the listed owner's troupe stays.
    expect(body.usage).toEqual({ projects: 3, rehearsals: 4 });
    // Registered 60 and 200 days ago and never signed in.
    expect(body.signIns).toEqual({ notInLast30Days: 2, rate: 28.6 });
  });

  test('an address counts again once it is no longer listed', async () => {
    delete process.env.ADMIN_SERVICE_EMAILS;
    const { body } = await get('/admin/api/stats').expect(200);
    expect(body.users.total).toBe(8);
    expect(body.usage.projects).toBe(3);
  });

  test('are hidden from the users table, and shown marked when asked', async () => {
    const hidden = await get('/admin/api/users').expect(200);
    expect(hidden.body.total).toBe(7);
    expect(hidden.body.users.map((user) => user.email)).toEqual([
      'loner@example.test', 'left@example.test', 'anna@example.test', 'ivan@example.test',
      'olga@example.test', 'removed@example.test', 'old@example.test']);
    expect(hidden.body.users.every((user) => user.service === false)).toBe(true);

    const shown = await get('/admin/api/users?service=1').expect(200);
    expect(shown.body.total).toBe(10);
    const service = shown.body.users.filter((user) => user.service).map((user) => user.email).sort();
    expect(service).toEqual(['Listed@Example.test', 'demo@rehearsly.me', 'maria@demo.rehearsly.me']);
  });
});

describe('the users table', () => {
  test('says where each person came from by their earliest active membership', async () => {
    const users = byEmail((await get('/admin/api/users?service=1').expect(200)).body.users);
    expect(users['olga@example.test'].source).toEqual({ kind: 'own', project: 'Hamlet', owner: null });
    expect(users['ivan@example.test'].source).toEqual({ kind: 'invite', project: 'Hamlet', owner: 'Olga O.' });
    // Made an admin, then created a project of their own: still an invitation.
    expect(users['anna@example.test'].source).toEqual({ kind: 'invite', project: 'Hamlet', owner: 'Olga O.' });
    expect(users['loner@example.test'].source).toEqual({ kind: 'none', project: null, owner: null });
    // Removed from Hamlet: no membership row left.
    expect(users['removed@example.test'].source).toEqual({ kind: 'none', project: null, owner: null });
    expect(users['old@example.test'].source).toEqual({ kind: 'invite', project: "Owner's troupe", owner: 'Lena S.' });
  });

  test('sign-in, language, zone and the steps', async () => {
    const users = byEmail((await get('/admin/api/users').expect(200)).body.users);
    expect(users['olga@example.test']).toMatchObject({
      signIn: ['apple'], locale: 'ru', timezone: 'America/Mazatlan',
      steps: { onboarding: true, projects: 1, roles: { owner: 1, admin: 0, member: 0 }, manualMarks: 2,
        // The all-day mark is 8 December in UTC; the timed one ends on the 9th in Mazatlán.
        marksUntil: '2026-12-09', calendarMarks: 0, calendar: false, device: true, seen: 1, onRoster: 1, rehearsals: 2 },
    });
    // Her one mark is from her calendar: no hand marks, no last date.
    expect(users['anna@example.test']).toMatchObject({
      signIn: ['apple', 'email'],
      steps: { onboarding: false, projects: 2, roles: { owner: 1, admin: 1, member: 0 }, manualMarks: 0, marksUntil: null,
        calendarMarks: 1, calendar: true, device: false, seen: 1, onRoster: 2, rehearsals: 1 },
    });
    // A password and no recorded method: an account from before they were recorded.
    expect(users['left@example.test'].signIn).toEqual(['email']);
    expect(users['loner@example.test'].steps).toMatchObject({ projects: 0, manualMarks: 0, calendarMarks: 0,
      marksUntil: null, seen: 0, onRoster: 0 });
    // The removed member's leftover row puts them on nothing.
    expect(users['removed@example.test'].steps).toMatchObject({ seen: 0, onRoster: 0 });
    expect(users['olga@example.test'].createdAt).toBe(ago(20 * D));
  });

  test('calendar sync used: busy times imported from a calendar, or rehearsals exported to one (T-295)', async () => {
    const calendarOf = async (query = '') => Object.fromEntries((await get(`/admin/api/users${query}`).expect(200)).body.users
      .map((user) => [user.email, user.steps.calendar]));
    // Anna has both; drop her export record: import alone still counts.
    sqlite.prepare('DELETE FROM native_calendar_connections WHERE user_id = 3').run();
    // Leo exports only; Olga has only marks of her own, Ivan a slot booked for a rehearsal.
    sqlite.prepare('INSERT INTO native_calendar_connections (user_id) VALUES (5)').run();
    // Maria, a service account, imports from her calendar.
    sqlite.prepare(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
      VALUES (9, ?, ?, 0, 'google_calendar', ?)`).run(at(NOW + 5 * H), at(NOW + 6 * H), ago(1 * D));
    const calendar = await calendarOf();
    expect(calendar['anna@example.test']).toBe(true);
    expect(calendar['left@example.test']).toBe(true);
    expect(calendar['olga@example.test']).toBe(false);
    expect(calendar['ivan@example.test']).toBe(false);
    expect(calendar['loner@example.test']).toBe(false);
    // The service account is not counted; shown only when asked, marked.
    expect(Object.keys(calendar)).not.toContain('maria@demo.rehearsly.me');
    const shown = (await get('/admin/api/users?service=1').expect(200)).body.users
      .find((user) => user.email === 'maria@demo.rehearsly.me');
    expect(shown).toMatchObject({ service: true, steps: { calendar: true } });
  });

  test('filters by period, source and language, and pages', async () => {
    const month = (await get('/admin/api/users?period=30').expect(200)).body;
    expect(month.total).toBe(5);
    const invited = (await get('/admin/api/users?source=invite').expect(200)).body;
    expect(invited.users.map((user) => user.email)).toEqual(['anna@example.test', 'ivan@example.test', 'old@example.test']);
    const russian = (await get('/admin/api/users?lang=ru&service=1').expect(200)).body;
    expect(russian.users.map((user) => user.email)).toEqual(['olga@example.test', 'Listed@Example.test']);
    const second = (await get('/admin/api/users?limit=2&offset=2').expect(200)).body;
    expect(second.total).toBe(7);
    expect(second.users.map((user) => user.email)).toEqual(['anna@example.test', 'ivan@example.test']);
  });
});

describe('analytics', () => {
  test('the newcomer funnel by week of registration, invited apart from the rest, with medians', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    expect(body.people).toBe(5);
    expect(body.funnel.total).toEqual({
      // Ivan marks by hand, Anna has her calendar (an import and an export).
      invite: { registered: 2, onboarding: 1, project: 2, calendar: 1, manual: 1, engaged: 2 },
      other: { registered: 3, onboarding: 2, project: 1, calendar: 0, manual: 1, engaged: 1 },
    });
    expect(body.funnel.weeks.map((week) => week.week)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02']);
    expect(body.funnel.weeks[0]).toEqual({ week: '2026-11-16',
      invite: { registered: 1, onboarding: 0, project: 1, calendar: 1, manual: 0, engaged: 1 },
      other: { registered: 2, onboarding: 1, project: 0, calendar: 0, manual: 0, engaged: 0 } });
    // Invited: Ivan in a project 3 h after registering, Anna 1 h; Anna's import
    // after 4 h (her export record has no time), Ivan's first hand mark after 5 h.
    // The rest: Olga, 1 h and a hand mark after 2 h.
    expect(body.funnel.medians).toEqual({
      invite: { toProjectHours: 2, toProjectOf: 2, toCalendarHours: 4, toCalendarOf: 1, toManualHours: 5, toManualOf: 1 },
      other: { toProjectHours: 1, toProjectOf: 1, toCalendarHours: null, toCalendarOf: 0, toManualHours: 2, toManualOf: 1 },
    });
  });

  test('where people come from, which projects brought them, languages and zones', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    expect(body.sources.byDay).toEqual([
      { date: '2026-11-22', invite: 0, own: 0, none: 1 },
      { date: '2026-11-17', invite: 0, own: 0, none: 1 },
      { date: '2026-11-16', invite: 1, own: 0, none: 0 },
      { date: '2026-11-15', invite: 1, own: 0, none: 0 },
      { date: '2026-11-05', invite: 0, own: 1, none: 0 },
    ]);
    expect(body.sources.byWeek[0]).toEqual({ date: '2026-11-16', invite: 1, own: 0, none: 2 });
    // Maria joined Hamlet in the period too, but she is a service account.
    expect(body.sources.projects).toEqual([{ project: 'Hamlet', owner: 'Olga O.', joined: 2, newcomers: 2 }]);
    expect(body.sources.languages).toEqual([{ value: 'en', people: 3 }, { value: 'es', people: 1 }, { value: 'ru', people: 1 }]);
    expect(body.sources.timezones[0]).toEqual({ value: 'UTC', people: 3 });
    expect(body.languages).toEqual(['de', 'en', 'es', 'ru']);

    const all = (await get('/admin/api/analytics').expect(200)).body;
    expect(all.sources.projects).toContainEqual({ project: "Owner's troupe", owner: 'Lena S.', joined: 1, newcomers: 1 });
  });

  test('projects: seen before the start leaves out the removed member; coverage stops at the 14th date', async () => {
    const { body } = await get('/admin/api/analytics').expect(200);
    // Most real members first, then most rehearsals; Demo Hamlet's owner is on rehearsly.me.
    expect(body.projects.map((project) => project.name)).toEqual(['Hamlet', "Owner's troupe", 'Second']);
    expect(body.projects[0]).toEqual({
      id: 1, name: 'Hamlet', owner: 'Olga O.', createdAt: ago(20 * D),
      members: 3, rehearsals: 3, rehearsalsLastFourWeeks: 2, nextRehearsalAt: at(NOW + 3 * D),
      // Olga and Ivan before the start; Anna's "no" and her mark after the start
      // do not count; the removed member's leftover "yes" is on no roster.
      seenBeforeStart: { seen: 2, of: 4, rate: 50 },
      // Olga: all-day on 8 December, inside. Ivan: all-day on 9 December, outside,
      // and a busy slot booked for a rehearsal is not a mark. Anna: a calendar event.
      coverage: { people: 2, of: 3, rate: 66.7 },
      // Anna alone has her calendar connected.
      calendar: { people: 1, of: 3, rate: 33.3 },
    });
    // Projects created or rehearsing in the period.
    const week = (await get('/admin/api/analytics?period=7').expect(200)).body;
    expect(week.projects.map((project) => project.name)).toEqual(['Hamlet', 'Second']);
  });

  test('coverage counts an all-day stretch that began before today and has not ended', async () => {
    const mark = sqlite.prepare(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const hamlet = async () => (await get('/admin/api/analytics').expect(200)).body.projects
      .find((project) => project.name === 'Hamlet').coverage;
    // Today is 25 November (UTC). A stretch that ended on the 24th is behind.
    mark.run(2, '2026-11-20T00:00:00.000Z', '2026-11-24T23:59:59.999Z', 1, 'google_calendar', ago(1 * D));
    expect(await hamlet()).toEqual({ people: 2, of: 3, rate: 66.7 });
    // A tour from the 20th to the 30th: Ivan is away today and for five more days.
    mark.run(2, '2026-11-20T00:00:00.000Z', '2026-11-30T23:59:59.999Z', 1, 'google_calendar', ago(1 * D));
    expect(await hamlet()).toEqual({ people: 3, of: 3, rate: 100 });
  });

  test('notifications, inbox and email codes, without service accounts', async () => {
    const { body } = await get('/admin/api/analytics?period=30').expect(200);
    expect(body.notifications.devices).toEqual({ people: 1, of: 5, rate: 20 });
    expect(body.notifications.inbox).toEqual([
      { type: 'member_joined', created: 2, read: 1, readRate: 50, medianMinutesToRead: 30 },
      { type: 'rehearsal_created', created: 1, read: 1, readRate: 100, medianMinutesToRead: 60 },
    ]);
    expect(body.notifications.emailCodes).toEqual([
      { purpose: 'reset', created: 2, sent: 1, failed: 1, used: 0, replaced: 0, locked: 1 },
      { purpose: 'verify', created: 2, sent: 2, failed: 0, used: 1, replaced: 1, locked: 0 },
    ]);
  });

  test('carries no address', async () => {
    const { body } = await get('/admin/api/analytics').expect(200);
    expect(JSON.stringify(body)).not.toMatch(/@/);
    const stats = (await get('/admin/api/stats').expect(200)).body;
    expect(JSON.stringify(stats)).not.toMatch(/@/);
  });

  test('the source and language filters apply to every section', async () => {
    const invited = (await get('/admin/api/analytics?period=30&source=invite').expect(200)).body;
    expect(invited.people).toBe(2);
    expect(invited.funnel.total.other.registered).toBe(0);
    expect(invited.projects[0]).toMatchObject({ members: 2, coverage: { people: 1, of: 2, rate: 50 } });
    expect(invited.notifications.inbox).toEqual([
      { type: 'rehearsal_created', created: 1, read: 1, readRate: 100, medianMinutesToRead: 60 }]);
    const spanish = (await get('/admin/api/analytics?period=30&lang=es').expect(200)).body;
    expect(spanish.people).toBe(1);
    expect(spanish.notifications.emailCodes.map((row) => row.purpose)).toEqual(['reset', 'verify']);
    const stats = (await get('/admin/api/stats?source=own').expect(200)).body;
    expect(stats.users.total).toBe(1);
  });
});

/**
 * T-426: the calendar connected apart from marks made by hand. Six people
 * registered on 13 November (UTC), apart from everyone above: Cora owns
 * "Calendars", the five others joined it an hour after registering.
 */
describe('the calendar apart from hand marks (T-426)', () => {
  const R = NOW - 12 * D; // 2026-11-13T12:00Z
  const DAY = 'from=2026-11-13&to=2026-11-13';
  const CAST = {
    11: 'cora@example.test', // owner, nothing at all
    12: 'manu@example.test', // hand marks only
    13: 'ines@example.test', // imported from a calendar only
    14: 'edgar@example.test', // exported rehearsals only
    15: 'bea@example.test', // a hand mark, an import and an export
    16: 'wendy@example.test', // only weekends busy by default
  };
  function cast() {
    const person = sqlite.prepare(`INSERT INTO native_users (id, email, first_name, last_name, timezone, locale,
      onboarding_completed, created_at) VALUES (?, ?, ?, 'Test', 'UTC', 'en', 1, ?)`);
    for (const [id, email] of Object.entries(CAST)) person.run(Number(id), email, email.split('@')[0], at(R));
    sqlite.prepare('INSERT INTO native_projects VALUES (5, ?, ?)').run('Calendars', at(R));
    const member = sqlite.prepare(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
      VALUES (?, 5, ?, 'active', ?, ?)`);
    member.run(11, 'owner', at(R), at(R));
    for (const id of [12, 13, 14, 15, 16]) member.run(id, 'member', at(R + 1 * H), at(R + 1 * H));
    const mark = sqlite.prepare(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    mark.run(12, '2026-11-30T00:00:00.000Z', '2026-11-30T23:59:59.999Z', 1, 'manual', at(R + 2 * H));
    mark.run(12, '2026-12-02T00:00:00.000Z', '2026-12-02T23:59:59.999Z', 1, 'manual', at(R + 30 * H));
    mark.run(13, at(NOW + 1 * D), at(NOW + 1 * D + 2 * H), 0, 'apple_calendar', at(R + 3 * H));
    mark.run(15, '2026-12-01T00:00:00.000Z', '2026-12-01T23:59:59.999Z', 1, 'manual', at(R + 1 * H));
    // Imported after her first export, and reaching further than her own marks.
    mark.run(15, '2026-12-20T00:00:00.000Z', '2026-12-20T23:59:59.999Z', 1, 'google_calendar', at(R + 10 * D));
    mark.run(16, '2026-11-28T00:00:00.000Z', '2026-11-28T23:59:59.999Z', 1, 'weekend', at(R + 30 * 60 * 1000));
    const connection = sqlite.prepare('INSERT INTO native_calendar_connections (user_id, created_at) VALUES (?, ?)');
    connection.run(14, at(R + 5 * H));
    connection.run(15, at(R + 4 * H));
  }

  test('the funnel has two steps, the calendar connected and hand marks; weekends are neither', async () => {
    cast();
    const { body } = await get(`/admin/api/analytics?period=dates&${DAY}&source=invite`).expect(200);
    expect(body.funnel.total.invite).toEqual({
      registered: 5, onboarding: 5, project: 5, calendar: 3, manual: 2, engaged: 0 });
    // Calendar: Ines 3 h (import), Edgar 5 h (export), Bea 4 h (her export, before
    // her import). Hand marks: Manu 2 h, Bea 1 h. Wendy's weekend is in neither.
    expect(body.funnel.medians.invite).toEqual({
      toProjectHours: 1, toProjectOf: 5, toCalendarHours: 4, toCalendarOf: 3, toManualHours: 1.5, toManualOf: 2 });
  });

  test('the users table: hand marks with their last date, marks from a calendar, calendar connected', async () => {
    cast();
    const users = byEmail((await get(`/admin/api/users?period=dates&${DAY}`).expect(200)).body.users);
    const steps = (email) => {
      const { manualMarks, marksUntil, calendarMarks, calendar } = users[email].steps;
      return { manualMarks, marksUntil, calendarMarks, calendar };
    };
    expect(steps('manu@example.test')).toEqual({ manualMarks: 2, marksUntil: '2026-12-02', calendarMarks: 0, calendar: false });
    expect(steps('ines@example.test')).toEqual({ manualMarks: 0, marksUntil: null, calendarMarks: 1, calendar: true });
    expect(steps('edgar@example.test')).toEqual({ manualMarks: 0, marksUntil: null, calendarMarks: 0, calendar: true });
    // The last date is by her own mark, not by the import on the 20th.
    expect(steps('bea@example.test')).toEqual({ manualMarks: 1, marksUntil: '2026-12-01', calendarMarks: 1, calendar: true });
    expect(steps('wendy@example.test')).toEqual({ manualMarks: 0, marksUntil: null, calendarMarks: 0, calendar: false });
  });

  test('projects: the share of members with the calendar connected, beside an unchanged coverage', async () => {
    cast();
    const { body } = await get(`/admin/api/analytics?period=dates&${DAY}`).expect(200);
    const calendars = body.projects.find((project) => project.name === 'Calendars');
    // Ines, Edgar and Bea of six; coverage: Manu, Ines and Bea — not Wendy's weekend.
    expect(calendars).toMatchObject({ members: 6,
      coverage: { people: 3, of: 6, rate: 50 }, calendar: { people: 3, of: 6, rate: 50 } });
    // The filters apply: the owner is not invited.
    const invited = (await get(`/admin/api/analytics?period=dates&${DAY}&source=invite`).expect(200)).body;
    expect(invited.projects.find((project) => project.name === 'Calendars'))
      .toMatchObject({ members: 5, calendar: { people: 3, of: 5, rate: 60 } });
  });

  test('the test cohort has the same two steps, within 7 days of registering', async () => {
    cast();
    // Without a project of their own everyone but Cora reads "no project": in the cohort.
    sqlite.prepare('DELETE FROM native_project_members WHERE project_id = 5 AND user_id <> 11').run();
    const { body } = await get(`/admin/api/analytics?period=dates&${DAY}&cohort=1`).expect(200);
    expect(body.cohort.test).toMatchObject({ registered: 6,
      calendar: { count: 3, of: 6, rate: 50 }, manual: { count: 2, of: 6, rate: 33.3 } });
    expect(body.cohort.test).not.toHaveProperty('marks');
  });
});

describe('access', () => {
  test.each(['/admin/api/stats', '/admin/api/users', '/admin/api/analytics'])('%s refuses without the admin token', async (path) => {
    await request(server).get(path).expect(401);
    await get(path, userToken).expect(401);
  });

  test.each(['period=365', 'source=friends', 'lang=%3Cb%3E'])('refuses a malformed filter: %s', async (query) => {
    await get(`/admin/api/analytics?${query}`).expect(400);
    await get(`/admin/api/users?${query}`).expect(400);
  });
});
