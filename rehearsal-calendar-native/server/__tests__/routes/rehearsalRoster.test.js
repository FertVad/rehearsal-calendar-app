/**
 * The roster rule (R4: D01, D02): who is on a rehearsal and who may do what.
 *
 * Through the routes, because every defect here was a route or a service
 * deciding on its own: an admin could put a stranger on a call and write busy
 * hours into that stranger's calendar, a member could put themselves on a
 * rehearsal by answering it, anyone in the project could read the cast of a
 * rehearsal they were not on, and a leftover row kept a person who had left in
 * the announcements and the busy slots.
 */
import { jest } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let bystanderId;
let outsiderId;
let leftId;
let rehearsalId;

const notified = { created: [], updated: [], deleted: [] };
const recipients = (rows) => rows.map((row) => Number(row.user_id)).sort((a, b) => a - b);

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);
  const user = (email, name) => Number(testDb.run(
    'INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)', [email, 'hash', name]
  ).lastInsertId);

  // In the project, not on the rehearsal.
  bystanderId = user('bystander@test.com', 'By');
  testDb.run(`INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'member', 'active')`,
    [testData.projectId, bystanderId]);
  // In no project at all.
  outsiderId = user('outsider@test.com', 'Out');
  // Was on the rehearsal, has since left the project; the row stayed behind.
  leftId = user('left@test.com', 'Left');

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const noop = async () => ({ sent: 0, failed: 0, errors: [] });
  jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
    getUserPushTokens: async () => [],
    sendPushNotification: noop,
    notifyRehearsalCreated: async (_rehearsal, _project, rows) => { notified.created.push(recipients(rows)); },
    notifyRehearsalUpdated: async (_rehearsal, _project, rows) => { notified.updated.push(recipients(rows)); },
    notifyRehearsalDeleted: async (_rehearsal, _project, rows) => { notified.deleted.push(recipients(rows)); },
    notifyMemberResponse: noop,
    notifyMemberJoined: noop,
    notifyAdminAppointed: noop,
    notifyRoleChanged: noop,
    notifyMemberRemoved: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', rehearsalsRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');
  Object.values(notified).forEach((list) => { list.length = 0; });

  rehearsalId = Number(testDb.run(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, ?, ?, ?)`,
    [testData.projectId, 'Прогон', '2026-10-01T17:00:00.000Z', '2026-10-01T19:00:00.000Z']
  ).lastInsertId);
  // The member is on it. So is the leftover row of someone who has left.
  for (const userId of [testData.memberId, leftId]) {
    testDb.run(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
      [rehearsalId, userId]);
  }
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const owner = () => Number(testData.adminId);
const member = () => Number(testData.memberId);
const rosterRows = (id = rehearsalId) => testDb.all(
  'SELECT user_id, response FROM native_rehearsal_responses WHERE rehearsal_id = ? ORDER BY user_id', [id]);
const slotsOf = (userId) => testDb.all(
  `SELECT external_event_id FROM native_user_availability WHERE user_id = ? AND source = 'rehearsal'`, [userId]);
const rehearsalCount = () => Number(testDb.get('SELECT COUNT(*) AS n FROM native_rehearsals').n);
const body = (extra = {}) => ({ title: 'Новая', startsAt: '2026-10-02T17:00:00.000Z',
  endsAt: '2026-10-02T19:00:00.000Z', ...extra });
const create = (payload, userId = owner()) => request(app)
  .post(`/api/native/projects/${testData.projectId}/rehearsals`).set(...auth(userId)).send(payload);
const update = (payload, userId = owner()) => request(app)
  .put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`).set(...auth(userId)).send(payload);
const respond = (response, userId) => request(app)
  .post(`/api/native/rehearsals/${rehearsalId}/respond`).set(...auth(userId)).send({ response });

describe('Who can be put on a rehearsal (D01)', () => {
  it('refuses a list naming someone outside the project, before writing anything', async () => {
    const before = rehearsalCount();
    const res = await create(body({ participant_ids: [member(), outsiderId] }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'NOT_PROJECT_MEMBERS', userIds: [outsiderId] });
    expect(rehearsalCount()).toBe(before);
    expect(slotsOf(outsiderId)).toHaveLength(0);
    expect(slotsOf(member())).toHaveLength(0);
  });

  it('refuses a stranger on an edit and leaves the rehearsal as it was', async () => {
    const res = await update(body({ title: 'Переименована', participant_ids: [member(), outsiderId] }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_PROJECT_MEMBERS');
    expect(testDb.get('SELECT title FROM native_rehearsals WHERE id = ?', [rehearsalId]).title).toBe('Прогон');
    expect(rosterRows().map((row) => Number(row.user_id))).toEqual([member(), leftId].sort((a, b) => a - b));
    expect(slotsOf(outsiderId)).toHaveLength(0);
  });

  it('takes each person once, however often the list names them', async () => {
    const res = await create(body({ participant_ids: [member(), member(), String(member())] }));
    expect(res.status).toBe(201);
    expect(rosterRows(Number(res.body.rehearsal.id))).toEqual([{ user_id: member(), response: 'no' }]);
  });

  it('refuses entries that are not user ids', async () => {
    const before = rehearsalCount();
    for (const participants of [['abc'], [1.5], [-1], 'everyone']) {
      const res = await create(body({ participant_ids: participants }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PARTICIPANTS_INVALID');
    }
    expect(rehearsalCount()).toBe(before);
  });

  it('keeps the roster when an edit does not name it, and clears it on an empty list', async () => {
    expect((await update(body())).status).toBe(200);
    expect(rosterRows().map((row) => Number(row.user_id))).toContain(member());
    expect((await update(body({ participant_ids: [] }))).status).toBe(200);
    expect(rosterRows()).toEqual([]);
    expect(slotsOf(member())).toHaveLength(0);
  });
});

describe('Answering changes the answer, never the roster (D02)', () => {
  it('a member not on the rehearsal cannot put themselves on it', async () => {
    const res = await respond('yes', bystanderId);
    expect(res.status).toBe(404);
    expect(rosterRows().map((row) => Number(row.user_id))).not.toContain(bystanderId);
    expect(slotsOf(bystanderId)).toHaveLength(0);
  });

  it('an admin who is not on it is told so and stays off it', async () => {
    const res = await respond('yes', owner());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ON_REHEARSAL');
    expect(rosterRows().map((row) => Number(row.user_id))).not.toContain(owner());
  });

  it('someone on it answers, and the counts leave out whoever has left', async () => {
    const res = await respond('yes', member());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ confirmed: 1, invited: 1 });
    expect(rosterRows().find((row) => Number(row.user_id) === member()).response).toBe('yes');
  });

  it('refuses an answer that is neither yes nor no as a bad request', async () => {
    const res = await respond('maybe', member());
    expect(res.status).toBe(400);
  });
});

describe('Who can read a rehearsal\'s cast', () => {
  const responses = (userId) => request(app).get(`/api/native/rehearsals/${rehearsalId}/responses`).set(...auth(userId));
  const mine = (userId) => request(app).get(`/api/native/rehearsals/${rehearsalId}/my-response`).set(...auth(userId));

  it('hides it from a member who is not on the rehearsal', async () => {
    expect((await responses(bystanderId)).status).toBe(404);
    expect((await mine(bystanderId)).status).toBe(404);
  });

  it('shows it to someone on it and to an admin, without whoever has left', async () => {
    for (const userId of [member(), owner()]) {
      const res = await responses(userId);
      expect(res.status).toBe(200);
      expect(res.body.allParticipants.map((p) => Number(p.userId))).toEqual([member()]);
    }
  });
});

describe('A leftover row puts nobody anywhere', () => {
  it('leaves someone who has left out of the change announcement and the busy slots', async () => {
    const res = await update(body({ startsAt: '2026-10-03T17:00:00.000Z', endsAt: '2026-10-03T19:00:00.000Z' }));
    expect(res.status).toBe(200);
    expect(notified.updated).toEqual([[member()]]);
    expect(slotsOf(member())).toHaveLength(1);
    expect(slotsOf(leftId)).toHaveLength(0);
  });

  it('leaves them out of the cancellation', async () => {
    const res = await request(app)
      .delete(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`).set(...auth(owner()));
    expect(res.status).toBe(200);
    expect(notified.deleted).toEqual([[member()]]);
  });
});

describe('The roster lives in one place', () => {
  it('no server code outside the roster module touches the roster table', () => {
    const server = fileURLToPath(new URL('../../', import.meta.url));
    const skip = new Set(['node_modules', '__tests__', 'migrations', 'schema', 'scripts', 'public']);
    const found = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { if (!skip.has(name)) walk(full); continue; }
        if (name.endsWith('.js') && readFileSync(full, 'utf8').includes('native_rehearsal_responses')) {
          found.push(path.relative(server, full));
        }
      }
    };
    walk(server);
    expect(found).toEqual([path.join('services', 'rehearsals', 'roster.js')]);
  });
});
