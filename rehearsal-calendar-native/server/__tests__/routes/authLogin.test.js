/**
 * Login and provider-unlink behaviour.
 *
 * Two properties are pinned here:
 *
 *  - an OAuth-only account (password_hash IS NULL) must answer a password
 *    attempt exactly as a wrong password does. bcrypt.compare throws on a null
 *    hash, which used to surface as a 500 and made those accounts
 *    distinguishable from unregistered addresses.
 *
 *  - unlinking the email provider must actually stop password sign-in. Login
 *    reads native_users.password_hash and never looks at native_auth_providers,
 *    so removing the row on its own left the credential live.
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  closeIntegrationDb,
} from '../integration/setup.js';

let testDb;
let app;
let request;
let unlinkAuthProvider;

const PASSWORD = 'correct-horse-battery';
let passwordUserId;
let oauthUserId;
let bcrypt;

beforeAll(async () => {
  testDb = await setupIntegrationDb();

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
    notifyPaymentFailed: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  bcrypt = (await import('bcrypt')).default;
  ({ unlinkAuthProvider } = await import('../../utils/accountLinking.js'));
  const authRouter = (await import('../../routes/auth.js')).default;

  const hash = await bcrypt.hash(PASSWORD, 10);
  passwordUserId = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`,
    ['password-user@test.com', hash, 'Password']
  ).lastInsertId;

  // Mirrors how findOrCreateOAuthUser inserts: password_hash stays NULL.
  oauthUserId = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`,
    ['oauth-user@test.com', null, 'OAuth']
  ).lastInsertId;

  testDb.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_email) VALUES (?, ?, ?)`,
    [oauthUserId, 'google', 'oauth-user@test.com']
  );
  testDb.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_email) VALUES (?, ?, ?)`,
    [passwordUserId, 'email', 'password-user@test.com']
  );
  testDb.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_email) VALUES (?, ?, ?)`,
    [passwordUserId, 'google', 'password-user@test.com']
  );

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(() => {
  closeIntegrationDb();
});

describe('POST /auth/login', () => {
  it('signs in a password account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'password-user@test.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'password-user@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('answers an OAuth-only account with 401, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'oauth-user@test.com', password: 'anything' });

    expect(res.status).toBe(401);
  });

  it('gives the same response for an OAuth-only account as for an unknown address', async () => {
    const oauth = await request(app)
      .post('/api/auth/login')
      .send({ email: 'oauth-user@test.com', password: 'anything' });

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything' });

    // Identical status and body, so neither reveals whether the address exists.
    expect(oauth.status).toBe(unknown.status);
    expect(oauth.body).toEqual(unknown.body);
  });
});

describe('unlinking the email provider', () => {
  it('stops password sign-in from working', async () => {
    const before = await request(app)
      .post('/api/auth/login')
      .send({ email: 'password-user@test.com', password: PASSWORD });
    expect(before.status).toBe(200);

    await unlinkAuthProvider(passwordUserId, 'email');

    const after = await request(app)
      .post('/api/auth/login')
      .send({ email: 'password-user@test.com', password: PASSWORD });
    expect(after.status).toBe(401);
  });

  it('clears the stored credential rather than only the provider row', () => {
    const user = testDb.get('SELECT password_hash FROM native_users WHERE id = ?', [passwordUserId]);
    expect(user.password_hash).toBeNull();
  });

  it('refuses to unlink the last remaining method', async () => {
    await expect(unlinkAuthProvider(oauthUserId, 'google')).rejects.toThrow(
      'Cannot unlink the last authentication method'
    );
  });
});
