/**
 * The notification inbox.
 *
 * Two properties matter most here and neither is visible from SQL: that a row
 * is written for *every* intended recipient — including one with no device, who
 * would otherwise never learn what happened — and that one user can never read
 * or mark another's. Both live in the handler and the store, so these go over
 * HTTP through the real router.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let store;

let strangerId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  const stranger = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`,
    ['stranger@test.com', 'hash', 'Str']
  );
  strangerId = Number(stranger.lastInsertId);

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  store = await import('../../services/notifications/notificationStore.js');

  const notificationsRouter = (await import('../../routes/native/notifications.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/notifications', notificationsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_notifications');
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const send = (userIds, overrides = {}) =>
  store.recordNotifications(userIds, {
    title: 'Репетиция завтра',
    body: 'The girls: Прогон',
    data: { type: 'rehearsal_reminder_24h', rehearsalId: 42, projectId: 7 },
    ...overrides,
  });

describe('Notification inbox', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/native/notifications');
    expect(res.status).toBe(401);
  });

  it('records one row per recipient, whatever devices they have', async () => {
    await send([testData.adminId, testData.memberId, strangerId]);

    for (const userId of [testData.adminId, testData.memberId, strangerId]) {
      const res = await request(app).get('/api/native/notifications').set(...auth(userId));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
    }
  });

  it('returns the notification with what it was about', async () => {
    await send([testData.adminId]);

    const res = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    const item = res.body.notifications[0];

    expect(item.title).toBe('Репетиция завтра');
    expect(item.type).toBe('rehearsal_reminder_24h');
    expect(item.data.rehearsalId).toBe(42);
    expect(item.relatedType).toBe('rehearsal');
    expect(item.relatedId).toBe(42);
    expect(item.read).toBe(false);
  });

  it('points at the project when there is no rehearsal', async () => {
    await send([testData.adminId], { data: { type: 'project_invite', projectId: 7 } });

    const res = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    expect(res.body.notifications[0].relatedType).toBe('project');
    expect(res.body.notifications[0].relatedId).toBe(7);
  });

  it('shows one user nothing of another\'s', async () => {
    await send([testData.adminId]);

    const res = await request(app).get('/api/native/notifications').set(...auth(strangerId));
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.unreadCount).toBe(0);
  });

  it('counts the unread', async () => {
    await send([testData.adminId]);
    await send([testData.adminId]);

    const res = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    expect(res.body.unreadCount).toBe(2);
  });

  it('marks the whole inbox read and answers with what remains', async () => {
    await send([testData.adminId]);
    await send([testData.adminId]);

    const res = await request(app)
      .post('/api/native/notifications/read')
      .set(...auth(testData.adminId))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);

    const after = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    expect(after.body.notifications.every((n) => n.read)).toBe(true);
  });

  it('marks only the ids it was given', async () => {
    await send([testData.adminId]);
    await send([testData.adminId]);

    const list = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    const first = list.body.notifications[0].id;

    const res = await request(app)
      .post('/api/native/notifications/read')
      .set(...auth(testData.adminId))
      .send({ ids: [first] });

    expect(res.body.unreadCount).toBe(1);
  });

  it('cannot be used to mark someone else\'s as read', async () => {
    await send([testData.adminId]);
    const list = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    const victimId = list.body.notifications[0].id;

    await request(app)
      .post('/api/native/notifications/read')
      .set(...auth(strangerId))
      .send({ ids: [victimId] });

    const after = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    expect(after.body.unreadCount).toBe(1);
    expect(after.body.notifications[0].read).toBe(false);
  });

  it('refuses ids that are not a list', async () => {
    const res = await request(app)
      .post('/api/native/notifications/read')
      .set(...auth(testData.adminId))
      .send({ ids: 'all' });

    expect(res.status).toBe(400);
  });

  it('reports the unread count on its own', async () => {
    await send([testData.adminId]);

    const res = await request(app)
      .get('/api/native/notifications/unread-count')
      .set(...auth(testData.adminId));

    expect(res.body.unreadCount).toBe(1);
  });

  it('hands back the newest first', async () => {
    await send([testData.adminId], { title: 'Первое' });
    await send([testData.adminId], { title: 'Второе' });

    const res = await request(app).get('/api/native/notifications').set(...auth(testData.adminId));
    expect(res.body.notifications.map((n) => n.title)).toEqual(['Второе', 'Первое']);
  });
});
