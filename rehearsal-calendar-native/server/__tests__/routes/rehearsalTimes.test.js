/**
 * A rehearsal is an interval (cause fix 15: DF04).
 *
 * The older request format, a date with two clock times, put the end on the
 * start's date whatever it said, so 23:00–01:00 went in ending before it
 * began. And a request ending where or before it started reached the schema's
 * CHECK (ends_at > starts_at) and came back as a 500. Now an end before the
 * start is the next morning, by the app's rule, and a range that is not one
 * is refused with 400 before anything is written.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

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
  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/native/projects', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');
});

const auth = () => ['Authorization', `Bearer ${generateTokens(Number(testData.adminId), 1).accessToken}`];
const create = (body) => request(app).post(`/api/native/projects/${testData.projectId}/rehearsals`)
  .set(...auth()).send({ participant_ids: [], ...body });
const rehearsalCount = () => Number(testDb.get('SELECT COUNT(*) AS n FROM native_rehearsals').n);
const HOUR = 60 * 60 * 1000;

it('a date with 23:00–01:00 is two hours into the next morning', async () => {
  const res = await create({ title: 'Night run', date: '2026-10-02', startTime: '23:00', endTime: '01:00' });

  expect(res.status).toBe(201);
  const { startsAt, endsAt } = res.body.rehearsal;
  expect(Date.parse(endsAt) - Date.parse(startsAt)).toBe(2 * HOUR);
});

it('refuses with 400 a rehearsal ending before it starts, and writes nothing', async () => {
  const res = await create({ startsAt: '2026-10-02T23:00:00.000Z', endsAt: '2026-10-02T01:00:00.000Z' });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('TIME_RANGE_INVALID');
  expect(rehearsalCount()).toBe(0);
});

it('refuses with 400 a date whose two times are the same', async () => {
  const res = await create({ date: '2026-10-02', startTime: '19:00', endTime: '19:00' });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('TIME_RANGE_INVALID');
  expect(rehearsalCount()).toBe(0);
});

it('refuses an edit to an end before the start, and keeps the rehearsal as it was', async () => {
  const id = Number(testDb.run(
    'INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, ?, ?, ?)',
    [testData.projectId, 'Run', '2026-10-01T17:00:00.000Z', '2026-10-01T19:00:00.000Z']
  ).lastInsertId);

  const res = await request(app).put(`/api/native/projects/${testData.projectId}/rehearsals/${id}`)
    .set(...auth()).send({ startsAt: '2026-10-01T19:00:00.000Z', endsAt: '2026-10-01T17:00:00.000Z', participant_ids: [] });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('TIME_RANGE_INVALID');
  const row = testDb.get('SELECT starts_at, ends_at FROM native_rehearsals WHERE id = ?', [id]);
  expect(new Date(row.starts_at).toISOString()).toBe('2026-10-01T17:00:00.000Z');
});
