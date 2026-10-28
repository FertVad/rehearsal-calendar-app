/**
 * GET /api/cron/reminders — what the schedulers see (R8: GR03).
 *
 * Both schedulers alarm on the HTTP status and nothing else. A run that could
 * not read what was due answered 200 with zero counts, exactly like a night
 * with nothing to send, so a broken query or a database that did not answer
 * went unnoticed until people noticed their missing reminders.
 *
 * Nothing is due in these tests and no ticket is waiting, so the real Expo
 * client is never called.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let testDb;
let app;
let request;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));
  jest.unstable_mockModule('../../utils/logger.js', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  const cronRouter = (await import('../../routes/cron.js')).default;
  app = express();
  app.use('/api/cron', cronRouter);
});

afterAll(() => closeIntegrationDb());

const SECRET = 'test-cron-secret';
beforeEach(() => { process.env.CRON_SECRET = SECRET; });
afterEach(() => { delete process.env.CRON_SECRET; });

const ping = () => request(app).get('/api/cron/reminders').set('Authorization', `Bearer ${SECRET}`);

it('answers 200 with the counts when the run worked and nothing was due', async () => {
  const res = await ping();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, found: { '24h': 0, '1h': 0 }, errors: [] });
});

it('answers 500 with what failed when the run could not read what was due', async () => {
  testDb.run('ALTER TABLE native_push_reminders RENAME TO native_push_reminders_away');
  let res;
  try {
    res = await ping();
  } finally {
    testDb.run('ALTER TABLE native_push_reminders_away RENAME TO native_push_reminders');
  }

  expect(res.status).toBe(500);
  expect(res.body.success).toBe(false);
  expect(res.body.errors.map((e) => e.step)).toEqual(['24h', '1h']);
});

it('answers 500 when the receipts cannot be read', async () => {
  testDb.run('ALTER TABLE native_push_tickets RENAME TO native_push_tickets_away');
  let res;
  try {
    res = await ping();
  } finally {
    testDb.run('ALTER TABLE native_push_tickets_away RENAME TO native_push_tickets');
  }

  expect(res.status).toBe(500);
  expect(res.body.errors.map((e) => e.step)).toEqual(['receipts']);
});

it('still refuses without the secret, and is closed without one configured', async () => {
  expect((await request(app).get('/api/cron/reminders')).status).toBe(401);
  delete process.env.CRON_SECRET;
  expect((await ping()).status).toBe(503);
});
