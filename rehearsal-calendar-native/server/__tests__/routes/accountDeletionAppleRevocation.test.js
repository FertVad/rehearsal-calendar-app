/**
 * Deleting an account revokes its Sign in with Apple (T-279, App Review 5.1.1(v)).
 *
 * The app sends the authorization code of a fresh Apple confirmation with
 * DELETE /me; the server exchanges it at Apple's /auth/token with a client
 * secret signed by our key and revokes exactly the token Apple gave back.
 * The account goes whatever Apple does: off, down, refusing, or never asked.
 * The log says revoked or not and why — never the code, the token or the secret.
 *
 * Apple is a stub in place of fetch; the client secret is checked against the
 * public half of a key generated here.
 */
import { jest } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

const CLIENT_ID = 'com.example.t279';
const TEAM_ID = 'T279TEAMID';
const KEY_ID = 'T279KEYID1';
const APPLE_SUB = 't279-apple-subject';
const CODE = 'c0de-t279-authorization-code-from-apple';
const REFRESH = 'r.t279-refresh-token-from-apple';
const ACCESS = 'a.t279-access-token-from-apple';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PEM = privateKey.export({ format: 'pem', type: 'pkcs8' });
const ENV_NAMES = ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_SIGNIN_KEY_ID', 'APPLE_SIGNIN_PRIVATE_KEY'];
const savedEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));

let testDb;
let app;
let request;
let generateTokens;
let appleUserId;
let passwordUserId;
let fetchSpy;
let logged;
const logSpies = [];

// What Apple answers; each test may replace it.
let apple;
function idTokenFor(sub) {
  return jwt.sign({ sub, aud: CLIENT_ID, iss: 'https://appleid.apple.com' }, 'not-checked');
}
function json(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function appleAnswers() {
  return {
    token: () => json(200, { access_token: ACCESS, refresh_token: REFRESH, id_token: idTokenFor(APPLE_SUB), token_type: 'Bearer' }),
    revoke: () => json(200, {}),
  };
}

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb, isPostgres: false, initDatabase: async () => testDb, testConnection: async () => true,
  }));
  const noop = async () => ({ sent: 0, failed: 0, errors: [] });
  jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
    getUserPushTokens: async () => [], sendPushNotification: noop, notifyRehearsalCreated: noop,
    notifyRehearsalUpdated: noop, notifyRehearsalDeleted: noop, notifyAddedToRehearsal: noop,
    notifyRemovedFromRehearsal: noop, notifyMemberResponse: noop, notifyMemberJoined: noop,
    notifyAdminAppointed: noop, notifyRoleChanged: noop, notifyMemberRemoved: noop,
    notifyMemberLeft: noop, notifyProjectDeleted: noop, notifyRehearsal24h: noop, notifyRehearsal1h: noop,
  }));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const authRouter = (await import('../../routes/auth.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(() => {
  closeIntegrationDb();
  for (const name of ENV_NAMES) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

beforeEach(() => {
  process.env.APPLE_CLIENT_ID = CLIENT_ID;
  process.env.APPLE_TEAM_ID = TEAM_ID;
  process.env.APPLE_SIGNIN_KEY_ID = KEY_ID;
  process.env.APPLE_SIGNIN_PRIVATE_KEY = PEM;
  apple = appleAnswers();

  testDb.run('DELETE FROM native_auth_providers');
  testDb.run('DELETE FROM native_users');
  appleUserId = Number(testDb.run(
    'INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)',
    ['apple@t279.test', null, 'Apple'],
  ).lastInsertId);
  testDb.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email, created_at, updated_at)
     VALUES (?, 'apple', ?, ?, ?, ?)`,
    [appleUserId, APPLE_SUB, 'apple@t279.test', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'],
  );
  passwordUserId = Number(testDb.run(
    'INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)',
    ['password@t279.test', 'hash', 'Password'],
  ).lastInsertId);

  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === 'https://appleid.apple.com/auth/token') return apple.token();
    if (url === 'https://appleid.apple.com/auth/revoke') return apple.revoke();
    throw new Error(`unexpected request to ${url}`);
  });

  logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    logSpies.push(jest.spyOn(console, method).mockImplementation((...args) => {
      logged.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    }));
  }
});

afterEach(() => {
  fetchSpy?.mockRestore();
  logSpies.splice(0).forEach((spy) => spy.mockRestore());
});

const deleteAccount = (userId, body) => {
  const call = request(app).delete('/api/auth/me').set('Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`);
  return body === undefined ? call : call.send(body);
};
const accountExists = (userId) => Boolean(testDb.get('SELECT id FROM native_users WHERE id = ?', [userId]));
const form = (callIndex) => Object.fromEntries(new URLSearchParams(fetchSpy.mock.calls[callIndex][1].body));
const appleLines = () => logged.filter((line) => /apple/i.test(line));

function expectNothingSecretLogged() {
  const all = logged.join('\n');
  for (const secret of [CODE, REFRESH, ACCESS, PEM.split('\n')[1]]) expect(all).not.toContain(secret);
  // Nor the client secret, nor anything else shaped like a JWT.
  expect(all).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
}

it('exchanges the code with a client secret signed by our key and revokes exactly the token Apple returned', async () => {
  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
    'https://appleid.apple.com/auth/token',
    'https://appleid.apple.com/auth/revoke',
  ]);

  const exchange = form(0);
  expect(exchange).toEqual({
    client_id: CLIENT_ID, client_secret: expect.any(String), code: CODE, grant_type: 'authorization_code',
  });
  const secret = jwt.verify(exchange.client_secret, publicKey, {
    algorithms: ['ES256'], issuer: TEAM_ID, subject: CLIENT_ID, audience: 'https://appleid.apple.com',
  });
  expect(jwt.decode(exchange.client_secret, { complete: true }).header).toMatchObject({ alg: 'ES256', kid: KEY_ID });
  expect(secret.exp - secret.iat).toBeGreaterThan(0);
  expect(secret.exp - secret.iat).toBeLessThanOrEqual(3600);

  const revoke = form(1);
  expect(revoke).toEqual({
    client_id: CLIENT_ID, client_secret: expect.any(String), token: REFRESH, token_type_hint: 'refresh_token',
  });
  jwt.verify(revoke.client_secret, publicKey, { algorithms: ['ES256'] });

  expect(appleLines()).toEqual([expect.stringMatching(/revoked/i)]);
  expect(appleLines()[0]).not.toMatch(/not revoked/i);
  expectNothingSecretLogged();
});

it('without the key variables deletes the account, asks Apple nothing and logs one line that revocation is off', async () => {
  delete process.env.APPLE_TEAM_ID;
  delete process.env.APPLE_SIGNIN_KEY_ID;
  delete process.env.APPLE_SIGNIN_PRIVATE_KEY;

  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(appleLines()).toEqual([expect.stringMatching(/revocation is off.*APPLE_TEAM_ID/)]);
  expectNothingSecretLogged();
});

it('takes the .p8 pasted as one line with its breaks written as \\n', async () => {
  process.env.APPLE_SIGNIN_PRIVATE_KEY = PEM.trim().replace(/\n/g, '\\n');

  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  jwt.verify(form(0).client_secret, publicKey, { algorithms: ['ES256'] });
  expect(appleLines()).toEqual([expect.stringMatching(/Apple sign-in revoked/)]);
});

it('an unusable key is reported by name, the account still goes and Apple is not asked', async () => {
  process.env.APPLE_SIGNIN_PRIVATE_KEY = 'not a key at all';

  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(appleLines()).toEqual([expect.stringMatching(/revocation is off \(APPLE_SIGNIN_PRIVATE_KEY is not a private key\)/)]);
  expect(logged.join('\n')).not.toContain('not a key at all');
});

it.each([
  ['Apple is down', () => { apple.token = () => json(503, { error: 'temporarily_unavailable' }); }, 1, /Apple refused the code: HTTP 503/],
  ['Apple refuses the code', () => { apple.token = () => json(400, { error: 'invalid_grant' }); }, 1, /HTTP 400 invalid_grant/],
  ['Apple cannot be reached', () => { apple.token = () => { throw new TypeError('fetch failed'); }; }, 1, /could not be reached/],
  ['Apple refuses the revocation', () => { apple.revoke = () => json(500, {}); }, 2, /Apple refused the revocation: HTTP 500/],
])('deletes the account when %s, and logs why it was not revoked', async (_label, arrange, calls, reason) => {
  arrange();
  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy).toHaveBeenCalledTimes(calls);
  expect(appleLines()).toEqual([expect.stringMatching(/not revoked/)]);
  expect(appleLines()[0]).toMatch(reason);
  expectNothingSecretLogged();
});

it('deletes the account when the person closed Apple’s sheet and no code came', async () => {
  const res = await deleteAccount(appleUserId);

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(appleLines()).toEqual([expect.stringMatching(/not revoked.*no authorization code/)]);
});

it('does not revoke a different Apple ID than the one linked to the account', async () => {
  apple.token = () => json(200, { refresh_token: REFRESH, id_token: idTokenFor('someone-else') });

  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(appleUserId)).toBe(false);
  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['https://appleid.apple.com/auth/token']);
  expect(appleLines()).toEqual([expect.stringMatching(/not revoked.*not the one linked/)]);
  expectNothingSecretLogged();
});

it('an account without Apple is deleted as before: no request to Apple, no Apple line', async () => {
  const res = await deleteAccount(passwordUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(200);
  expect(accountExists(passwordUserId)).toBe(false);
  expect(accountExists(appleUserId)).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(appleLines()).toEqual([]);
});

it('a revoked session deletes nothing and revokes nothing', async () => {
  testDb.run('UPDATE native_users SET token_version = 2 WHERE id = ?', [appleUserId]);

  const res = await deleteAccount(appleUserId, { appleAuthorizationCode: CODE });

  expect(res.status).toBe(401);
  expect(accountExists(appleUserId)).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
});
