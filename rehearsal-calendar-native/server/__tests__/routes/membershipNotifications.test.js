/**
 * Who is told when a project's membership changes.
 *
 * Both of these were pointing the wrong way and only showed up when a second
 * account joined a real project: the person who tapped Join was told they had
 * been invited, and nobody at all learned that the project had another
 * administrator.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let secondAdminId;
let joinerId;

const memberJoined = jest.fn();
const adminAppointed = jest.fn();
const roleChanged = jest.fn();

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  // A second administrator, so "everyone who runs the project" is more than one.
  secondAdminId = Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`, [
      'second-admin@test.com',
      'hash',
      'Second',
    ]).lastInsertId
  );
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, 'admin', 'active')`,
    [testData.projectId, secondAdminId]
  );

  joinerId = Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)`, [
      'joiner@test.com',
      'hash',
      'Нина',
      'Петрова',
    ]).lastInsertId
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
    notifyMemberJoined: memberJoined,
    notifyAdminAppointed: adminAppointed,
    notifyRoleChanged: roleChanged,
    notifyMemberRemoved: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  const invitesRouter = (await import('../../routes/native/invites.js')).default;
  const membersRouter = (await import('../../routes/native/members.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', membersRouter);
  app.use('/api/native/projects', invitesRouter);
  app.use('/api/native/invite', invitesRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  memberJoined.mockClear();
  adminAppointed.mockClear();
  roleChanged.mockClear();
  testDb.run(`DELETE FROM native_project_members WHERE user_id = ?`, [joinerId]);
  testDb.run(`UPDATE native_project_members SET role = 'member' WHERE user_id = ?`, [testData.memberId]);
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

/** The ids a notify* call was handed. */
const recipients = (mock) => (mock.mock.calls[0]?.[2] || []).map(Number);

const joinByCode = async () => {
  const made = await request(app)
    .post(`/api/native/projects/${testData.projectId}/invite`)
    .set(...auth(testData.adminId));
  const code = made.body.data?.inviteCode ?? made.body.inviteCode;
  if (!code) throw new Error('no invite code: ' + made.status + ' ' + JSON.stringify(made.body));

  return request(app).post(`/api/native/invite/${code}/join`).set(...auth(joinerId));
};

describe('Somebody joins a project', () => {
  it('tells the people who run it', async () => {
    const res = await joinByCode();
    expect(res.status).toBe(200);

    expect(memberJoined).toHaveBeenCalledTimes(1);
    expect(recipients(memberJoined)).toEqual(
      expect.arrayContaining([Number(testData.adminId), secondAdminId])
    );
  });

  it('does not tell the person who just joined', async () => {
    // They tapped Join a moment ago. Telling them they were invited is the
    // message this replaced.
    await joinByCode();

    expect(recipients(memberJoined)).not.toContain(joinerId);
  });

  it('names the person who joined', async () => {
    await joinByCode();

    expect(memberJoined.mock.calls[0][1]).toBe('Нина Петрова');
  });
});

describe('Somebody is made an administrator', () => {
  const promote = (actorId, targetId) =>
    request(app)
      .put(`/api/native/projects/${testData.projectId}/members/${targetId}/role`)
      .set(...auth(actorId))
      .send({ role: 'admin' });

  it('tells the person themselves', async () => {
    const res = await promote(testData.adminId, testData.memberId);
    expect(res.status).toBe(200);

    expect(roleChanged).toHaveBeenCalledTimes(1);
    expect(Number(roleChanged.mock.calls[0][1])).toBe(Number(testData.memberId));
  });

  it('tells the others who run the project', async () => {
    // Administrators may appoint administrators, so the owner cannot assume
    // they did it themselves.
    await promote(testData.adminId, testData.memberId);

    expect(adminAppointed).toHaveBeenCalledTimes(1);
    expect(recipients(adminAppointed)).toContain(secondAdminId);
  });

  it('leaves out whoever made the change', async () => {
    await promote(testData.adminId, testData.memberId);

    expect(recipients(adminAppointed)).not.toContain(Number(testData.adminId));
  });

  it('leaves out the person appointed, who is told separately', async () => {
    await promote(testData.adminId, testData.memberId);

    expect(recipients(adminAppointed)).not.toContain(Number(testData.memberId));
  });

  it('says nothing to the others when a rank is taken away', async () => {
    // Only appointments are announced. Demotion is between the two of them.
    await promote(testData.adminId, testData.memberId);
    adminAppointed.mockClear();

    await request(app)
      .put(`/api/native/projects/${testData.projectId}/members/${testData.memberId}/role`)
      .set(...auth(testData.adminId))
      .send({ role: 'member' });

    expect(adminAppointed).not.toHaveBeenCalled();
  });
});
