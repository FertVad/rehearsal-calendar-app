/**
 * "X has seen the rehearsal" reaches the admins once per person (T-034).
 *
 * Every mark used to be announced: unmark and mark again, and the admins were
 * told the same thing twice. Now once per rehearsal, and again only when its
 * date, time or place changed since (seenNotice.js). Through the real router,
 * since the decision to send is taken in the handler.
 *
 * Two marks at the same instant are shown on PostgreSQL as well
 * (__tests__/postgres/r8Reminders.mjs), where they really overlap.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let rehearsalId;

const told = jest.fn(async () => ({ sent: 0, failed: 0, errors: [] }));

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
    notifyAddedToRehearsal: noop,
    notifyRemovedFromRehearsal: noop,
    notifyMemberResponse: told,
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

const STARTS = '2030-10-01T17:00:00.000Z';
const ENDS = '2030-10-01T19:00:00.000Z';

beforeEach(() => {
  testDb.run('DELETE FROM native_push_reminders');
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');
  told.mockClear();

  rehearsalId = Number(testDb.run(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, location) VALUES (?, ?, ?, ?, ?)`,
    [testData.projectId, 'Прогон', STARTS, ENDS, 'Зал 1']
  ).lastInsertId);
  testDb.run(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
    [rehearsalId, testData.memberId]);
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const member = () => Number(testData.memberId);
const admin = () => Number(testData.adminId);

const mark = async (response) => {
  const res = await request(app).post(`/api/native/rehearsals/${rehearsalId}/respond`)
    .set(...auth(member())).send({ response });
  expect(res.status).toBe(200);
  return res;
};
const edit = async (changes) => {
  const res = await request(app).put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
    .set(...auth(admin()))
    .send({ title: 'Прогон', startsAt: STARTS, endsAt: ENDS, location: 'Зал 1', ...changes });
  expect(res.status).toBe(200);
};

describe('"Seen" is told to the admins once per person', () => {
  it('a mark tells the admins once', async () => {
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(1);
    expect(told.mock.calls[0][3]).toEqual([admin()]);
  });

  it('unmarking tells nobody, and marking again tells nobody either', async () => {
    await mark('yes');
    told.mockClear();
    await mark('no');
    await mark('yes');
    await mark('no');
    await mark('yes');
    expect(told).not.toHaveBeenCalled();
  });

  it('a second "yes" in a row is not news', async () => {
    await mark('yes');
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('after the rehearsal moved, marking it again tells the admins once', async () => {
    await mark('yes');
    await mark('no');
    told.mockClear();
    await edit({ startsAt: '2030-10-02T17:00:00.000Z', endsAt: '2030-10-02T19:00:00.000Z' });
    await mark('yes');
    await mark('no');
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('a new end time or place counts as a change too; a new title does not', async () => {
    await mark('yes');
    told.mockClear();
    await edit({ endsAt: '2030-10-01T20:00:00.000Z' });
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(1);
    await edit({ endsAt: '2030-10-01T20:00:00.000Z', location: 'Зал 2' });
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(2);
    await edit({ endsAt: '2030-10-01T20:00:00.000Z', location: 'Зал 2', title: 'Новое название' });
    await mark('no');
    await mark('yes');
    expect(told).toHaveBeenCalledTimes(2);
  });

  it('two marks at once tell the admins once', async () => {
    await Promise.all([mark('yes'), mark('yes')]);
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('a mark that is refused claims nothing', async () => {
    // The admin is not on the rehearsal: refused, and nothing is kept for them.
    const res = await request(app).post(`/api/native/rehearsals/${rehearsalId}/respond`)
      .set(...auth(admin())).send({ response: 'yes' });
    expect(res.status).toBe(403);
    expect(testDb.all('SELECT * FROM native_push_reminders')).toEqual([]);
    expect(told).not.toHaveBeenCalled();
  });
});
