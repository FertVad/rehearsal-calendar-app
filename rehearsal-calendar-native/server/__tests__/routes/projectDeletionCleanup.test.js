/**
 * Deleting a project has to take back the time its rehearsals booked.
 *
 * A rehearsal writes one busy row per participant into
 * native_user_availability, linked to the rehearsal only by source='rehearsal'
 * and an external_event_id holding its id as text. That is not a foreign key,
 * so the cascade from native_projects never reached those rows.
 *
 * Left behind they were permanent. The availability editor renders
 * source='rehearsal' slots read-only, marking a day free clears only
 * source='manual', and every endpoint that could delete them is scoped either
 * to manual rows, to imported ones, or to a project that no longer exists.
 *
 * Nor did they stay local: the members-availability endpoint selects with no
 * source filter, so phantom hours from a deleted project made someone look
 * unavailable in the Smart Planner of every other project they belonged to.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let doomedProjectId;
let survivingProjectId;
let doomedRehearsalId;
let survivingRehearsalId;

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

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', projectsRouter);
});

afterAll(() => closeIntegrationDb());

const makeProject = (name) => {
  const id = Number(
    testDb.run(`INSERT INTO native_projects (name) VALUES (?)`, [name]).lastInsertId
  );
  for (const [uid, role] of [
    [testData.adminId, 'owner'],
    [testData.memberId, 'member'],
  ]) {
    testDb.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status)
       VALUES (?, ?, ?, 'active')`,
      [id, uid, role]
    );
  }
  return id;
};

const makeRehearsal = (projectId, startsAt, endsAt) => {
  const id = Number(
    testDb.run(
      `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
       VALUES (?, 'Прогон', ?, ?)`,
      [projectId, startsAt, endsAt]
    ).lastInsertId
  );
  // The busy slot the rehearsal puts on each participant's availability.
  for (const uid of [testData.adminId, testData.memberId]) {
    testDb.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
       VALUES (?, ?, 'no')`,
      [id, uid]
    );
    testDb.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
       VALUES (?, ?, ?, 'busy', 'rehearsal', ?)`,
      [uid, startsAt, endsAt, String(id)]
    );
  }
  return id;
};

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');
  testDb.run(`DELETE FROM native_project_members WHERE project_id != ?`, [testData.projectId]);
  testDb.run(`DELETE FROM native_projects WHERE id != ?`, [testData.projectId]);

  doomedProjectId = makeProject('Проект под снос');
  survivingProjectId = makeProject('Второй проект');

  doomedRehearsalId = makeRehearsal(
    doomedProjectId,
    '2026-12-01T17:00:00.000Z',
    '2026-12-01T19:00:00.000Z'
  );
  survivingRehearsalId = makeRehearsal(
    survivingProjectId,
    '2026-12-02T17:00:00.000Z',
    '2026-12-02T19:00:00.000Z'
  );

  // Something the user entered by hand, which must survive untouched.
  testDb.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
     VALUES (?, '2026-12-01T09:00:00.000Z', '2026-12-01T11:00:00.000Z', 'busy', 'manual')`,
    [testData.memberId]
  );
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const deleteProject = (projectId, asUser = testData.adminId) =>
  request(app)
    .delete(`/api/native/projects/${projectId}`)
    .set(...auth(asUser));

const slotsFor = (rehearsalId) =>
  testDb.all(
    `SELECT user_id FROM native_user_availability
     WHERE source = 'rehearsal' AND external_event_id = ?`,
    [String(rehearsalId)]
  );

describe('Deleting a project', () => {
  it('succeeds for the owner', async () => {
    const res = await deleteProject(doomedProjectId);
    expect(res.status).toBe(200);
  });

  it('takes back the busy time its rehearsals booked, for every participant', async () => {
    expect(slotsFor(doomedRehearsalId)).toHaveLength(2);

    await deleteProject(doomedProjectId);

    expect(slotsFor(doomedRehearsalId)).toHaveLength(0);
  });

  it('leaves another project’s rehearsal slots alone', async () => {
    await deleteProject(doomedProjectId);

    expect(slotsFor(survivingRehearsalId)).toHaveLength(2);
  });

  it('leaves hand-entered availability alone', async () => {
    await deleteProject(doomedProjectId);

    const manual = testDb.all(
      `SELECT id FROM native_user_availability WHERE source = 'manual' AND user_id = ?`,
      [testData.memberId]
    );
    expect(manual).toHaveLength(1);
  });

  it('books nobody back when a non-owner is refused', async () => {
    const res = await deleteProject(doomedProjectId, testData.memberId);

    expect(res.status).toBe(403);
    expect(slotsFor(doomedRehearsalId)).toHaveLength(2);
  });
});
