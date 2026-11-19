/**
 * Those who run a project are told when somebody leaves it or is removed
 * from it (T-271).
 *
 * Anyone could leave since 2026-09-05 (DELETE on one's own membership), and
 * administrators can remove members — but only the person removed was told.
 * The owner and the other administrators learned nothing, so a cast quietly
 * shrank. They are told now, the same people who hear "New member", with the
 * name of whoever went (aboutUserId, so deleting that account removes it).
 *
 * Whoever leaves of their own accord is told nothing: they tapped Leave. They
 * were told "You were removed from the project", which they were not.
 *
 * Through the route and the real notification service: the rows are the
 * inbox, and the push goes where a row was written. Nobody has a device.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let ownerId;
let adminId; // a second administrator
let goingId; // Нина Уходящая — the member who leaves or is removed

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
  goingId = person('going@test.com', 'Нина', 'Уходящая');
  testDb.run(
    "INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'admin', 'active')",
    [testData.projectId, adminId]
  );
  // Read in Russian, where a careless participle would agree with a gender.
  testDb.run("UPDATE native_users SET locale = 'ru'");

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const membersRouter = (await import('../../routes/native/members.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', membersRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_notifications');
  testDb.run('DELETE FROM native_project_members WHERE user_id = ?', [goingId]);
  testDb.run(
    "INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'member', 'active')",
    [testData.projectId, goingId]
  );
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const inboxOf = (userId) => testDb.all(
  'SELECT type, title, body, data FROM native_notifications WHERE user_id = ? ORDER BY id',
  [userId]
).map((row) => ({ ...row, data: JSON.parse(row.data) }));

const removes = (actorId, targetId) => request(app)
  .delete(`/api/native/projects/${testData.projectId}/members/${targetId}`)
  .set(...auth(actorId));

describe('A member leaves of their own accord', () => {
  it('tells the owner and every administrator, naming who left', async () => {
    const res = await removes(goingId, goingId);
    expect(res.status).toBe(200);

    for (const reader of [ownerId, adminId]) {
      const inbox = inboxOf(reader);
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({
        type: 'member_left',
        title: 'Участник покинул проект',
        data: { type: 'member_left', aboutUserId: goingId },
      });
      expect(inbox[0].body).toContain('Нина Уходящая');
      // No word agrees with her: the server knows no one's gender (T-251).
      expect(inbox[0].body).toBe('Нина Уходящая больше не в проекте «Test Project»');
      expect(Number(inbox[0].data.projectId)).toBe(Number(testData.projectId));
    }
  });

  it('tells the one who left nothing: they tapped Leave', async () => {
    await removes(goingId, goingId);

    expect(inboxOf(goingId)).toEqual([]);
  });

  it('tells an ordinary member nothing', async () => {
    await removes(goingId, goingId);

    expect(inboxOf(Number(testData.memberId))).toEqual([]);
  });
});

describe('A member is removed by an administrator', () => {
  it('tells the owner, naming who was removed', async () => {
    const res = await removes(adminId, goingId);
    expect(res.status).toBe(200);

    const inbox = inboxOf(ownerId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: 'member_left',
      title: 'Участник удалён',
      data: { type: 'member_left', aboutUserId: goingId },
    });
    expect(inbox[0].body).toBe('Из проекта «Test Project» удалили участника: Нина Уходящая');
  });

  it('leaves out the administrator who removed them: they were there', async () => {
    await removes(adminId, goingId);

    expect(inboxOf(adminId)).toEqual([]);
  });

  it('tells the person removed that they were, and only that', async () => {
    await removes(adminId, goingId);

    expect(inboxOf(goingId).map((row) => row.type)).toEqual(['member_removed']);
  });

  it('tells the other administrators when the owner removes', async () => {
    await removes(ownerId, goingId);

    expect(inboxOf(adminId).map((row) => row.type)).toEqual(['member_left']);
    expect(inboxOf(ownerId)).toEqual([]);
  });
});
