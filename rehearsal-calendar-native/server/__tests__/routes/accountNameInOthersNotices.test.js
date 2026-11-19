/**
 * Deleting an account takes the person's name out of other people's inboxes
 * (T-278).
 *
 * Three notices carry a member's name as text into the inboxes of those who run
 * the project: "joined", "is now an administrator", "has seen a rehearsal". A
 * row belongs to its reader and goes with the reader's account only; nothing in
 * it said whose name it held. So DELETE /me left the name of a deleted account
 * in every owner's and administrator's inbox, while the deletion screen
 * promised that all of the person's data would be gone.
 *
 * Now each of those notices records whom it names (data.aboutUserId), and the
 * deletion removes every one naming the account, in its own transaction. The
 * other notices — about someone else, or naming nobody — stay where they are.
 *
 * Everything goes through the routes and the real notification service; nobody
 * has a device, so nothing is sent anywhere.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let notifyMemberJoined;

let ownerId;
let adminId; // a second administrator: told of the appointment too
let leavingId; // Лена Уходящая — joins, is made an administrator, marks "seen", then deletes her account
let stayingId; // Макс Остающийся — joins and marks "seen", and stays
let rehearsalId;

const LEAVING = { first: 'Лена', last: 'Уходящая' };
const STAYING = { first: 'Макс', last: 'Остающийся' };

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);
  ownerId = Number(testData.adminId);

  const person = (email, first, last) => Number(testDb.run(
    'INSERT INTO native_users (email, password_hash, first_name, last_name, timezone) VALUES (?, ?, ?, ?, ?)',
    [email, 'hash', first, last, 'UTC']
  ).lastInsertId);
  adminId = person('second-admin@test.com', 'Второй', 'Админ');
  leavingId = person('leaving@test.com', LEAVING.first, LEAVING.last);
  stayingId = person('staying@test.com', STAYING.first, STAYING.last);
  testDb.run(
    "INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'admin', 'active')",
    [testData.projectId, adminId]
  );

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  ({ notifyMemberJoined } = await import('../../services/notifications/pushNotificationService.js'));

  const authRouter = (await import('../../routes/auth.js')).default;
  const projectInvitesRouter = (await import('../../routes/native/projectInvites.js')).default;
  const inviteRedemptionRouter = (await import('../../routes/native/inviteRedemption.js')).default;
  const membersRouter = (await import('../../routes/native/members.js')).default;
  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/native/projects', membersRouter);
  app.use('/api/native/projects', projectInvitesRouter);
  app.use('/api/native/invite', inviteRedemptionRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const inboxOf = (userId) => testDb.all(
  'SELECT id, type, body, data FROM native_notifications WHERE user_id = ? ORDER BY id',
  [userId]
).map((row) => ({ ...row, data: JSON.parse(row.data) }));

const allRows = () => testDb.all('SELECT id, user_id, type, body, data FROM native_notifications ORDER BY id')
  .map((row) => ({ ...row, data: JSON.parse(row.data) }));

const joins = async (userId) => {
  const made = await request(app)
    .post(`/api/native/projects/${testData.projectId}/invite`)
    .set(...auth(ownerId));
  const code = made.body.data?.inviteCode ?? made.body.inviteCode;
  if (!code) throw new Error(`no invite code: ${made.status} ${JSON.stringify(made.body)}`);
  const res = await request(app).post(`/api/native/invite/${code}/join`).set(...auth(userId));
  expect(res.status).toBe(200);
};

const marksSeen = async (userId) => {
  const res = await request(app).post(`/api/native/rehearsals/${rehearsalId}/respond`)
    .set(...auth(userId)).send({ response: 'yes' });
  expect(res.status).toBe(200);
};

describe('Deleting an account removes the notices naming it from the others\' inboxes', () => {
  let before;

  beforeAll(async () => {
    // Both join through an invite: the owner and the second admin are told.
    await joins(leavingId);
    await joins(stayingId);

    // The owner makes Лена an administrator: the second admin is told.
    const promoted = await request(app)
      .put(`/api/native/projects/${testData.projectId}/members/${leavingId}/role`)
      .set(...auth(ownerId)).send({ role: 'admin' });
    expect(promoted.status).toBe(200);

    // Both are on a rehearsal and mark it seen: those who run it are told.
    rehearsalId = Number(testDb.run(
      'INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, ?, ?, ?)',
      [testData.projectId, 'Прогон', '2030-10-01T17:00:00.000Z', '2030-10-01T19:00:00.000Z']
    ).lastInsertId);
    for (const userId of [leavingId, stayingId]) {
      testDb.run("INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')",
        [rehearsalId, userId]);
    }
    await marksSeen(leavingId);
    await marksSeen(stayingId);

    // A notice that names nobody, in the owner's inbox.
    testDb.run(
      "INSERT INTO native_notifications (user_id, type, title, body, data) VALUES (?, 'rehearsal_created', 'Новая репетиция', 'Test Project: Прогон', ?)",
      [ownerId, JSON.stringify({ type: 'rehearsal_created', rehearsalId })]
    );

    before = allRows();
  });

  it('each of the three notices records whom it names', () => {
    const naming = (type) => before.filter((row) => row.type === type && row.body.includes(LEAVING.first));
    for (const type of ['member_joined', 'admin_appointed', 'member_response']) {
      expect(naming(type).length).toBeGreaterThan(0);
      for (const row of naming(type)) expect(Number(row.data.aboutUserId)).toBe(leavingId);
    }
    for (const row of before.filter((r) => r.body.includes(STAYING.first))) {
      expect(Number(row.data.aboutUserId)).toBe(stayingId);
    }
  });

  it('leaves none naming her, and every other notice in place', async () => {
    // The owner and the second admin each hold her name: joined, has seen;
    // the second admin also "is now an administrator".
    expect(inboxOf(ownerId).filter((row) => row.body.includes(LEAVING.first))).toHaveLength(2);
    expect(inboxOf(adminId).filter((row) => row.body.includes(LEAVING.first))).toHaveLength(3);

    const res = await request(app).delete('/api/auth/me').set(...auth(leavingId));
    expect(res.status).toBe(200);
    expect(res.body.deletedProjects).toBe(0);

    const after = allRows();
    expect(after.filter((row) => row.body.includes(LEAVING.first) || row.body.includes(LEAVING.last))).toEqual([]);
    expect(after.filter((row) => Number(row.data.aboutUserId) === leavingId)).toEqual([]);

    // Everything else that was not hers stays, untouched: what names Макс, and
    // what names nobody.
    const kept = before.filter((row) => Number(row.user_id) !== leavingId && !row.body.includes(LEAVING.first));
    expect(kept.some((row) => row.body.includes(STAYING.first))).toBe(true);
    expect(kept.some((row) => row.type === 'rehearsal_created')).toBe(true);
    expect(after).toEqual(kept);
  });

  it('writes no notice naming an account that no longer exists', async () => {
    const count = () => testDb.get('SELECT COUNT(*) AS n FROM native_notifications').n;
    const was = count();
    await notifyMemberJoined('Test Project', { id: leavingId, name: `${LEAVING.first} ${LEAVING.last}` }, [ownerId], testData.projectId);
    expect(count()).toBe(was);
  });

  it('will not name someone without saying whom', async () => {
    await expect(notifyMemberJoined('Test Project', 'Лена Уходящая', [ownerId], testData.projectId))
      .rejects.toThrow(TypeError);
  });
});
