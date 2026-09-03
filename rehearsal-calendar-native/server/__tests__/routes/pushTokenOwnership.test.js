/**
 * Who a device token belongs to.
 *
 * A push token identifies a phone, and only one person is signed in on it. The
 * unique key is (user_id, device_token), so registration on its own adds a row
 * rather than moving one — and a session that ends without the client reaching
 * DELETE /push-tokens leaves the previous row behind. Signing out on a second
 * device bumps token_version and invalidates this phone silently; a refresh can
 * fail; a sign-out with no network swallows the error and proceeds.
 *
 * The consequence is not abstract: the previous owner's pushes keep being
 * addressed to a phone that is now someone else's, carrying project names,
 * rehearsal titles and members' names on its lock screen.
 *
 * This goes over HTTP through the real router, because what is being pinned is
 * what the handler decides — the SQL underneath cannot express it.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

let strangerId;

const PHONE = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const OTHER_DEVICE = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  strangerId = Number(
    testDb.run(`INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`, [
      'stranger@test.com',
      'hash',
      'Str',
    ]).lastInsertId
  );

  // Not in the shared harness schema — this suite is the only reader.
  testDb.run(
    `CREATE TABLE IF NOT EXISTS native_push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
      device_token VARCHAR(255) NOT NULL,
      device_type VARCHAR(20),
      device_name VARCHAR(100),
      last_active_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, device_token)
    )`
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
  const pushTokensRouter = (await import('../../routes/native/pushTokens.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/push-tokens', pushTokensRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_push_tokens');
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const register = (userId, deviceToken, deviceName = 'iPhone') =>
  request(app)
    .post('/api/native/push-tokens')
    .set(...auth(userId))
    .send({ deviceToken, deviceType: 'ios', deviceName });

const rowsFor = (deviceToken) =>
  testDb.all('SELECT user_id FROM native_push_tokens WHERE device_token = ?', [deviceToken]);

describe('POST /api/native/push-tokens — device token ownership', () => {
  it('moves a token to whoever signed in last, rather than adding a second holder', async () => {
    // The previous owner's session ended without the client deleting the row.
    await register(testData.adminId, PHONE);
    expect(rowsFor(PHONE)).toHaveLength(1);

    const res = await register(strangerId, PHONE);

    expect(res.status).toBe(200);
    const rows = rowsFor(PHONE);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].user_id)).toBe(strangerId);
  });

  it('leaves the previous owner no claim on the token', async () => {
    await register(testData.adminId, PHONE);
    await register(strangerId, PHONE);

    // This is the query pushNotificationService sends when addressing a user.
    const stillAddressed = testDb.all(
      'SELECT device_token FROM native_push_tokens WHERE user_id = ?',
      [testData.adminId]
    );
    expect(stillAddressed).toHaveLength(0);
  });

  it('does not disturb the new owner’s other devices', async () => {
    await register(strangerId, OTHER_DEVICE, 'iPad');
    await register(testData.adminId, PHONE);

    await register(strangerId, PHONE);

    const all = testDb
      .all('SELECT device_token FROM native_push_tokens WHERE user_id = ?', [strangerId])
      .map((r) => r.device_token)
      .sort();
    expect(all).toEqual([PHONE, OTHER_DEVICE].sort());
  });

  it('does not disturb a different token held by someone else', async () => {
    await register(testData.memberId, OTHER_DEVICE, 'Pixel');
    await register(testData.adminId, PHONE);

    await register(strangerId, PHONE);

    const rows = rowsFor(OTHER_DEVICE);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].user_id)).toBe(testData.memberId);
  });

  it('still upserts when the same user re-registers, without duplicating', async () => {
    await register(testData.adminId, PHONE, 'iPhone');
    const res = await register(testData.adminId, PHONE, 'iPhone 15');

    expect(res.status).toBe(200);
    const rows = testDb.all(
      'SELECT device_name FROM native_push_tokens WHERE device_token = ? AND user_id = ?',
      [PHONE, testData.adminId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].device_name).toBe('iPhone 15');
  });
});
