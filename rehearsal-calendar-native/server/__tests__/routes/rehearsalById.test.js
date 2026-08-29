/**
 * GET /api/native/rehearsals/:rehearsalId
 *
 * The details screen is reached by id, so it must be able to ask for one
 * rehearsal without holding the object. Two things matter and neither is
 * visible from SQL: who is allowed to see it, and the fact that this route is
 * one path segment long on a router that is *also* mounted under /projects.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let outsiderId;
let bystanderId;
let rehearsalId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  // In no project at all.
  outsiderId = Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`, [
      'outsider@test.com',
      'hash',
      'Out',
    ]).lastInsertId
  );

  // In the project, but not on the rehearsal.
  bystanderId = Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`, [
      'bystander@test.com',
      'hash',
      'By',
    ]).lastInsertId
  );
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, 'member', 'active')`,
    [testData.projectId, bystanderId]
  );

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
    notifyProjectInvite: noop,
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
  const projectsRouter = (await import('../../routes/native/projects.js')).default;

  app = express();
  app.use(express.json());
  // The same order server.js uses. It is what keeps GET /projects/:id away from
  // this router's one-segment /:rehearsalId, and the last test here says so.
  app.use('/api/native/projects', projectsRouter);
  app.use('/api/native/projects', rehearsalsRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');

  rehearsalId = Number(
    testDb.run(
      `INSERT INTO native_rehearsals (project_id, title, location, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        testData.projectId,
        'Прогон второго акта',
        'Малая сцена',
        '2026-09-01T17:00:00.000Z',
        '2026-09-01T19:00:00.000Z',
      ]
    ).lastInsertId
  );

  // The member is on it; the bystander is not.
  testDb.run(
    `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
    [rehearsalId, testData.memberId]
  );
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const get = (id, userId) =>
  request(app).get(`/api/native/rehearsals/${id}`).set(...auth(userId));

describe('One rehearsal by id', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get(`/api/native/rehearsals/${rehearsalId}`);
    expect(res.status).toBe(401);
  });

  it('gives it to someone who is on it', async () => {
    const res = await get(rehearsalId, testData.memberId);

    expect(res.status).toBe(200);
    expect(res.body.rehearsal.title).toBe('Прогон второго акта');
    expect(res.body.rehearsal.location).toBe('Малая сцена');
    expect(res.body.rehearsal.id).toBe(String(rehearsalId));
    expect(res.body.rehearsal.projectId).toBe(String(testData.projectId));
  });

  it('carries the caller\'s own response, which the details screen opens with', async () => {
    const res = await get(rehearsalId, testData.memberId);
    expect(res.body.rehearsal.userResponse).toBe('no');
  });

  it('gives it to an admin who is not on it', async () => {
    // Admins see everything in their project — the same rule the lists follow.
    const res = await get(rehearsalId, testData.adminId);
    expect(res.status).toBe(200);
  });

  it('hides it from a project member who is not on it', async () => {
    const res = await get(rehearsalId, bystanderId);
    expect(res.status).toBe(404);
  });

  it('hides it from someone outside the project', async () => {
    const res = await get(rehearsalId, outsiderId);
    expect(res.status).toBe(404);
  });

  it('answers 404 for a rehearsal that does not exist', async () => {
    // Same answer as "not yours", on purpose: distinguishing them would confirm
    // that an id belongs to somebody else's project.
    const res = await get(999999, testData.memberId);
    expect(res.status).toBe(404);
  });

  it('does not swallow GET /projects/:id', async () => {
    // This route is one segment long and its router is mounted under /projects
    // as well. Nothing but the mounting order keeps it from answering for
    // projects — so the order is asserted here rather than assumed.
    const res = await request(app)
      .get(`/api/native/projects/${testData.projectId}`)
      .set(...auth(testData.adminId));

    expect(res.status).toBe(200);
    expect(res.body.project ?? res.body).toBeDefined();
    expect(res.body.rehearsal).toBeUndefined();
  });
});
