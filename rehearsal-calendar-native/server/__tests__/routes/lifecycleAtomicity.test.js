/**
 * Each lifecycle operation commits whole or not at all (R4, cause fix 10:
 * B01, B02, D03).
 *
 * Removing a member, creating and deleting a project, creating, editing and
 * deleting a rehearsal: each is several writes, and each used to commit them
 * one by one. A failure half-way left the first writes standing — a project
 * with no owner, a rehearsal with no busy slots, a removed member whose
 * rehearsal rows and busy hours stayed for good because the retry answered 404.
 *
 * The failure is injected with a trigger on the last table each operation
 * writes, so everything before it has already run. What is checked is that
 * nothing of it remains, and that the same request succeeds once the fault is
 * gone. The same contract on PostgreSQL is scenario R4_LIFECYCLE.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

const START = '2030-03-10T17:00:00.000Z';
const END = '2030-03-10T19:00:00.000Z';

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

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
    notifyRehearsalCreated: noop,
    notifyRehearsalUpdated: noop,
    notifyRehearsalDeleted: noop,
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

  const projectsRouter = (await import('../../routes/native/projects.js')).default;
  const membersRouter = (await import('../../routes/native/members.js')).default;
  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', projectsRouter);
  app.use('/api/native/projects', membersRouter);
  app.use('/api/native/projects', rehearsalsRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

const owner = () => Number(testData.adminId);
const member = () => Number(testData.memberId);
const project = () => Number(testData.projectId);
const auth = (userId = owner()) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const count = (sql, params = []) => Number(Object.values(testDb.get(`SELECT COUNT(*) AS n FROM ${sql}`, params))[0]);

// A statement on `table` fails, as a dropped connection or a timeout would.
const failOn = (event, table) =>
  testDb.run(`CREATE TRIGGER injected_failure BEFORE ${event} ON ${table}
    BEGIN SELECT RAISE(ABORT, 'INJECTED_FAILURE'); END`);
const heal = () => testDb.run('DROP TRIGGER IF EXISTS injected_failure');

// A rehearsal the owner and the member are on, with their busy slots and a
// reminder already claimed for the member — what the operations below undo.
function seedRehearsal() {
  const id = Number(testDb.run(
    `INSERT INTO native_rehearsals (project_id, title, location, starts_at, ends_at, created_by)
     VALUES (?, 'Прогон', 'Малая сцена', ?, ?, ?)`,
    [project(), START, END, owner()]
  ).lastInsertId);
  for (const userId of [owner(), member()]) {
    testDb.run(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`, [id, userId]);
    testDb.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
       VALUES (?, ?, ?, 'busy', 'rehearsal', ?)`,
      [userId, START, END, String(id)]
    );
  }
  testDb.run(`INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type) VALUES (?, ?, '24h')`, [id, member()]);
  return id;
}

// Everything the lifecycle operations touch, to compare before and after.
const snapshot = () => Object.fromEntries([
  'native_projects', 'native_project_members', 'native_rehearsals',
  'native_rehearsal_responses', 'native_user_availability', 'native_push_reminders',
].map((table) => [table, testDb.all(`SELECT * FROM ${table} ORDER BY id`)]));

beforeEach(() => {
  heal();
  for (const table of ['native_push_reminders', 'native_user_availability', 'native_rehearsal_responses', 'native_rehearsals']) {
    testDb.run(`DELETE FROM ${table}`);
  }
  testDb.run('DELETE FROM native_project_members WHERE project_id <> ?', [project()]);
  testDb.run('DELETE FROM native_projects WHERE id <> ?', [project()]);
  testDb.run(`INSERT OR IGNORE INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'member', 'active')`,
    [project(), member()]);
});

afterEach(() => heal());

describe('Removing a member (B01)', () => {
  const remove = () => request(app).delete(`/api/native/projects/${project()}/members/${member()}`).set(...auth());

  it('fails whole: they stay a member, on the rehearsal, with its busy slot', async () => {
    seedRehearsal();
    const before = snapshot();
    failOn('DELETE', 'native_user_availability');

    expect((await remove()).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('so the retry finds them and finishes the job', async () => {
    seedRehearsal();
    failOn('DELETE', 'native_user_availability');
    await remove();
    heal();

    expect((await remove()).status).toBe(200);
    expect(count('native_project_members WHERE user_id = ?', [member()])).toBe(0);
    expect(count('native_rehearsal_responses WHERE user_id = ?', [member()])).toBe(0);
    expect(count('native_user_availability WHERE user_id = ?', [member()])).toBe(0);
  });
});

describe('Creating a project (B02)', () => {
  const create = () => request(app).post('/api/native/projects').set(...auth()).send({ name: 'Новый проект' });

  it('fails whole: no project is left without its owner', async () => {
    const before = snapshot();
    failOn('INSERT', 'native_project_members');

    expect((await create()).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('succeeds with its owner', async () => {
    const res = await create();

    expect(res.status).toBe(201);
    expect(testDb.get('SELECT role FROM native_project_members WHERE project_id = ? AND user_id = ?',
      [Number(res.body.project.id), owner()])).toEqual({ role: 'owner' });
  });
});

describe('Deleting a project (B02)', () => {
  let doomed;
  let rehearsalId;

  beforeEach(() => {
    doomed = Number(testDb.run(`INSERT INTO native_projects (name) VALUES ('Удаляемый')`).lastInsertId);
    testDb.run(`INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`,
      [doomed, owner()]);
    rehearsalId = Number(testDb.run(
      `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, 'Последний', ?, ?)`,
      [doomed, START, END]
    ).lastInsertId);
    testDb.run(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`, [rehearsalId, owner()]);
    testDb.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
       VALUES (?, ?, ?, 'busy', 'rehearsal', ?)`,
      [owner(), START, END, String(rehearsalId)]
    );
  });

  const destroy = () => request(app).delete(`/api/native/projects/${doomed}`).set(...auth());

  it('fails whole: the busy slots stay with the rehearsals that still stand', async () => {
    const before = snapshot();
    failOn('DELETE', 'native_projects');

    expect((await destroy()).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('succeeds, taking the busy slots with it', async () => {
    expect((await destroy()).status).toBe(200);
    expect(count('native_projects WHERE id = ?', [doomed])).toBe(0);
    expect(count(`native_user_availability WHERE external_event_id = ?`, [String(rehearsalId)])).toBe(0);
  });
});

describe('Creating a rehearsal (D03)', () => {
  const create = () => request(app)
    .post(`/api/native/projects/${project()}/rehearsals`).set(...auth())
    .send({ title: 'Прогон', startsAt: START, endsAt: END, participant_ids: [owner(), member()] });

  it('fails whole: no rehearsal is left without its busy slots', async () => {
    const before = snapshot();
    failOn('INSERT', 'native_user_availability');

    expect((await create()).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('so a second try makes one rehearsal, not two', async () => {
    failOn('INSERT', 'native_user_availability');
    await create();
    heal();

    expect((await create()).status).toBe(201);
    expect(count('native_rehearsals')).toBe(1);
    expect(count('native_user_availability')).toBe(2);
  });
});

describe('Editing a rehearsal (D03)', () => {
  const MOVED_START = '2030-03-12T17:00:00.000Z';
  const MOVED_END = '2030-03-12T19:00:00.000Z';
  const edit = (id) => request(app)
    .put(`/api/native/projects/${project()}/rehearsals/${id}`).set(...auth())
    .send({ title: 'Перенесён', startsAt: MOVED_START, endsAt: MOVED_END, participant_ids: [owner()] });

  it('fails whole: the old time, the old cast, their slots and claims all stay', async () => {
    const id = seedRehearsal();
    const before = snapshot();
    failOn('INSERT', 'native_user_availability');

    expect((await edit(id)).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('succeeds whole', async () => {
    const id = seedRehearsal();

    expect((await edit(id)).status).toBe(200);
    expect(testDb.get('SELECT title, starts_at FROM native_rehearsals WHERE id = ?', [id]))
      .toEqual({ title: 'Перенесён', starts_at: MOVED_START });
    expect(testDb.all('SELECT user_id, starts_at FROM native_user_availability').map((r) => [Number(r.user_id), r.starts_at]))
      .toEqual([[owner(), MOVED_START]]);
    expect(count('native_push_reminders WHERE rehearsal_id = ?', [id])).toBe(0);
  });
});

describe('Deleting a rehearsal (D03)', () => {
  const destroy = (id) => request(app).delete(`/api/native/projects/${project()}/rehearsals/${id}`).set(...auth());

  it('fails whole: the cast and the busy slots stay with the rehearsal', async () => {
    const id = seedRehearsal();
    const before = snapshot();
    failOn('DELETE', 'native_rehearsals');

    expect((await destroy(id)).status).toBe(500);
    expect(snapshot()).toEqual(before);
  });

  it('succeeds whole', async () => {
    const id = seedRehearsal();

    expect((await destroy(id)).status).toBe(200);
    expect(count('native_rehearsals WHERE id = ?', [id])).toBe(0);
    expect(count('native_rehearsal_responses')).toBe(0);
    expect(count('native_user_availability')).toBe(0);
  });
});
