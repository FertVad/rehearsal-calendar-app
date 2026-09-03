/**
 * Deleting an account takes projects with it. The people in them have to hear.
 *
 * When the departing user is the last active owner or admin, their project is
 * deleted for everyone in it. Until now auth.js imported nothing from
 * services/notifications — unlike the ordinary project-delete path — so a
 * member's whole project vanished with no push and no inbox row, leaving them
 * to notice on their own.
 *
 * The busy hours its rehearsals had booked stayed behind too. That link is
 * source='rehearsal' plus an external_event_id holding the id as text, which is
 * no foreign key, so nothing cascaded and no endpoint could reach them
 * afterwards — they kept people looking unavailable in their other projects'
 * planners, for rehearsals that no longer existed.
 *
 * A project that still has another admin is left alone: nobody loses it, so
 * nobody is told and nothing is cleared.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let notifyProjectDeleted;

let leavingUserId;
let bystanderId;
let doomedProjectId;
let survivingProjectId;
let doomedRehearsalId;
let survivingRehearsalId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  testDb.run(
    `CREATE TABLE IF NOT EXISTS native_auth_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider_type TEXT NOT NULL,
      provider_user_id TEXT,
      provider_email TEXT,
      provider_metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME
    )`
  );

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  notifyProjectDeleted = jest.fn(async () => ({ sent: 0, failed: 0, errors: [] }));
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
    notifyProjectDeleted,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  const authRouter = (await import('../../routes/auth.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(() => closeIntegrationDb());

const makeUser = (email) =>
  Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`, [
      email,
      'hash',
      email.split('@')[0],
    ]).lastInsertId
  );

const addMember = (projectId, userId, role) =>
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, ?, 'active')`,
    [projectId, userId, role]
  );

const makeRehearsal = (projectId, participants) => {
  const id = Number(
    testDb.run(
      `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
       VALUES (?, 'Прогон', '2026-12-01T17:00:00.000Z', '2026-12-01T19:00:00.000Z')`,
      [projectId]
    ).lastInsertId
  );
  for (const uid of participants) {
    testDb.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
       VALUES (?, '2026-12-01T17:00:00.000Z', '2026-12-01T19:00:00.000Z', 'busy', 'rehearsal', ?)`,
      [uid, String(id)]
    );
  }
  return id;
};

beforeEach(() => {
  notifyProjectDeleted.mockClear();

  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsals');
  testDb.run(`DELETE FROM native_project_members WHERE project_id != ?`, [testData.projectId]);
  testDb.run(`DELETE FROM native_projects WHERE id != ?`, [testData.projectId]);
  testDb.run(`DELETE FROM native_users WHERE id NOT IN (?, ?)`, [
    testData.adminId,
    testData.memberId,
  ]);

  leavingUserId = makeUser('leaving@test.com');
  bystanderId = makeUser('bystander@test.com');

  // Only the departing user administers this one, so it goes with the account.
  doomedProjectId = Number(
    testDb.run(`INSERT INTO native_projects (name) VALUES ('Театр под снос')`).lastInsertId
  );
  addMember(doomedProjectId, leavingUserId, 'owner');
  addMember(doomedProjectId, bystanderId, 'member');

  // This one keeps another admin, so it survives untouched.
  survivingProjectId = Number(
    testDb.run(`INSERT INTO native_projects (name) VALUES ('Второй театр')`).lastInsertId
  );
  addMember(survivingProjectId, leavingUserId, 'owner');
  addMember(survivingProjectId, testData.adminId, 'admin');
  addMember(survivingProjectId, bystanderId, 'member');

  doomedRehearsalId = makeRehearsal(doomedProjectId, [leavingUserId, bystanderId]);
  survivingRehearsalId = makeRehearsal(survivingProjectId, [leavingUserId, bystanderId]);
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const deleteAccount = () =>
  request(app)
    .delete('/api/auth/me')
    .set(...auth(leavingUserId));

const slotsFor = (rehearsalId) =>
  testDb.all(
    `SELECT user_id FROM native_user_availability
     WHERE source = 'rehearsal' AND external_event_id = ?`,
    [String(rehearsalId)]
  );

describe('Deleting an account', () => {
  it('succeeds', async () => {
    const res = await deleteAccount();
    expect(res.status).toBe(200);
    expect(res.body.deletedProjects).toBe(1);
  });

  it('tells the members of the project that went with it', async () => {
    await deleteAccount();

    expect(notifyProjectDeleted).toHaveBeenCalledTimes(1);
    const [projectName, memberIds] = notifyProjectDeleted.mock.calls[0];
    expect(projectName).toBe('Театр под снос');
    expect(memberIds.map(Number)).toEqual([bystanderId]);
  });

  it('does not tell them about a project that survived', async () => {
    await deleteAccount();

    const names = notifyProjectDeleted.mock.calls.map((c) => c[0]);
    expect(names).not.toContain('Второй театр');
  });

  it('takes back the busy hours the deleted project had booked', async () => {
    expect(slotsFor(doomedRehearsalId)).toHaveLength(2);

    await deleteAccount();

    expect(slotsFor(doomedRehearsalId)).toHaveLength(0);
  });

  it('leaves the surviving project’s hours alone', async () => {
    await deleteAccount();

    const remaining = slotsFor(survivingRehearsalId).map((r) => Number(r.user_id));
    expect(remaining).toContain(bystanderId);
  });

  it('still deletes the account when the notification throws', async () => {
    notifyProjectDeleted.mockRejectedValueOnce(new Error('Expo is down'));

    const res = await deleteAccount();

    expect(res.status).toBe(200);
    expect(testDb.get('SELECT id FROM native_users WHERE id = ?', [leavingUserId])).toBeUndefined();
  });
});
