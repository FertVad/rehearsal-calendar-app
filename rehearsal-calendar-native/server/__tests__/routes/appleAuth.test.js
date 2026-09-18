import { jest } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import net from 'node:net';
import appleSignin from 'apple-signin-auth';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import bcrypt from 'bcrypt';
import nodeFetch from 'node-fetch';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

// Real auth route -> application verifier -> locked Apple/jsonwebtoken crypto
// -> real account-linking SQL in isolated SQLite. Only the JWKS transport and
// database location are substituted; no authentication result is mocked.
const AUDIENCE = 'com.example.ia01-intended';
const SUBJECT = 'ia01-linked-subject';
const EMAIL = 'ia01-linked@example.test';
const PASSWORD = 'ia01-fixture-password';
const OLD_TIME = '2000-01-01T00:00:00.000Z';
const KID = 'ia01-http-synthetic-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongPrivateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };
const savedAppleClientId = process.env.APPLE_CLIENT_ID;
const savedJwtSecret = process.env.JWT_SECRET;
const APP_SECRET = 'ia01-http-app-signing-secret';
const jwksTransport = jest.fn(async url => {
  expect(url).toBe('https://appleid.apple.com/auth/keys');
  return { text: async () => JSON.stringify({ keys: [jwk] }) };
});
let sqlite;
let server;
let createApp;
let verifyCall;
let connectGuard;
let passwordHash;
let linkedUserId;
let passwordUserId;
const blockedConnections = [];
const database = Object.fromEntries(['get', 'all', 'run', 'transaction'].map(method =>
  [method, jest.fn((...args) => sqlite[method](...args))]));
const forbidden = jest.fn(() => { throw new Error('IA01 tests must not initialize runtime resources'); });
jest.unstable_mockModule('../../database/db.js', () => ({
  default: database, isPostgres: false, initDatabase: forbidden, testConnection: forbidden,
}));
jest.unstable_mockModule('../../config/env.js', () => { forbidden(); return {}; });

function token(claims = {}, signingKey = privateKey) {
  return jwt.sign({
    sub: SUBJECT, email: EMAIL, email_verified: 'true',
    aud: AUDIENCE, iss: 'https://appleid.apple.com',
    exp: Math.floor(Date.now() / 1000) + 300, ...claims,
  }, signingKey, { algorithm: 'RS256', keyid: KID });
}

function snapshot() {
  const tables = sqlite.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return Object.fromEntries(tables.map(({ name }) => [name, sqlite.all(`SELECT * FROM "${name}" ORDER BY rowid`)]));
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeUndefined();
  expect(process.env.POSTGRES_URL).toBeUndefined();
  process.env.JWT_SECRET = APP_SECRET;
  appleSignin._setFetch(jwksTransport);
  verifyCall = jest.spyOn(appleSignin, 'verifyIdToken'); // Call through to the actual verifier.
  const originalConnect = net.Socket.prototype.connect;
  connectGuard = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const options = typeof first === 'object' ? first : { port: first, host: args[1] };
    if (options.host !== '127.0.0.1' || Number(options.port) !== server?.address()?.port) {
      blockedConnections.push({ host: options.host, port: options.port });
      throw new Error('Only the owned IA01 loopback listener is allowed');
    }
    return originalConnect.apply(this, args);
  });
  ({ createApp } = await import('../../app.js'));
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  expect(blockedConnections).toEqual([]);
});

beforeEach(async () => {
  process.env.APPLE_CLIENT_ID = AUDIENCE;
  sqlite = await setupIntegrationDb();
  linkedUserId = sqlite.run(
    'INSERT INTO native_users (email, password_hash, first_name, last_name, last_login_at) VALUES (?, ?, ?, ?, ?)',
    [EMAIL, null, 'Linked', 'Apple', OLD_TIME],
  ).lastInsertId;
  passwordUserId = sqlite.run(
    'INSERT INTO native_users (email, password_hash, first_name, last_login_at) VALUES (?, ?, ?, ?)',
    ['ia01-password@example.test', passwordHash, 'Password', OLD_TIME],
  ).lastInsertId;
  sqlite.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email, created_at, updated_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [linkedUserId, 'apple', SUBJECT, EMAIL, OLD_TIME, OLD_TIME, OLD_TIME],
  );
  const project = sqlite.run('INSERT INTO native_projects (name) VALUES (?)', ['IA01 unrelated project']).lastInsertId;
  sqlite.run('INSERT INTO native_project_members (project_id, user_id, role) VALUES (?, ?, ?)', [project, passwordUserId, 'owner']);
  // Clear the locked library's key cache through its real transport seam. A
  // cached key must not disguise verifier execution as a no-fetch guard.
  await appleSignin._getApplePublicKeys({ disableCaching: true });
  jwksTransport.mockClear();
  verifyCall.mockClear();
  Object.values(database).forEach(fn => fn.mockClear());
  blockedConnections.length = 0;
  server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
});

afterEach(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server = undefined;
  closeIntegrationDb();
  expect(blockedConnections).toEqual([]);
  expect(forbidden).not.toHaveBeenCalled();
});

afterAll(() => {
  verifyCall?.mockRestore();
  connectGuard?.mockRestore();
  appleSignin._setFetch(nodeFetch);
  if (savedAppleClientId === undefined) delete process.env.APPLE_CLIENT_ID;
  else process.env.APPLE_CLIENT_ID = savedAppleClientId;
  if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedJwtSecret;
});

function expectNoDatabaseCalls() {
  Object.values(database).forEach(fn => expect(fn).not.toHaveBeenCalled());
}

async function expectUsableAppSession(response, userId) {
  expect(response.status).toBe(200);
  expect(typeof response.body.accessToken).toBe('string');
  expect(typeof response.body.refreshToken).toBe('string');
  expect(jwt.verify(response.body.accessToken, APP_SECRET)).toMatchObject({ userId, tv: 1, type: 'access' });
  expect(jwt.verify(response.body.refreshToken, APP_SECRET)).toMatchObject({ userId, tv: 1, type: 'refresh' });
  const profile = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${response.body.accessToken}`);
  expect(profile.status).toBe(200);
  expect(profile.body.user.id).toBe(userId);
}

test.each([
  ['missing', undefined], ['empty', ''], ['blank', ' \t\n '],
  ['embedded whitespace', 'com.example.ia01 intended'],
  ['comma-separated list', 'com.example.ia01-intended,com.example.other-app'],
  ['JSON list', '["com.example.ia01-intended"]'],
])('Apple %s configuration rejects a valid wrong-app token before verification or SQL', async (_label, value) => {
  if (value === undefined) delete process.env.APPLE_CLIENT_ID;
  else process.env.APPLE_CLIENT_ID = value;
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple').send({ idToken: token({ aud: 'com.example.other-app' }) });
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ error: 'Apple sign-in is unavailable' });
  expect(verifyCall).not.toHaveBeenCalled();
  expect(jwksTransport).not.toHaveBeenCalled();
  expectNoDatabaseCalls();
  expect(snapshot()).toEqual(before);
});

test.each([
  ['missing idToken', {}], ['null idToken', { idToken: null }],
  ['empty idToken', { idToken: '' }], ['blank idToken', { idToken: ' \t\n ' }],
  ['number idToken', { idToken: 123 }], ['boolean idToken', { idToken: true }],
  ['object idToken', { idToken: { value: 'token' } }], ['array idToken', { idToken: ['token'] }],
  ['array body', []],
])('Apple HTTP rejects %s before verification or SQL', async (_label, body) => {
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple').send(body);
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: 'ID token is required' });
  expect(verifyCall).not.toHaveBeenCalled();
  expect(jwksTransport).not.toHaveBeenCalled();
  expectNoDatabaseCalls();
  expect(snapshot()).toEqual(before);
});

test('an absent request body is a bounded 400 before verification or SQL', async () => {
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple');
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: 'ID token is required' });
  expect(verifyCall).not.toHaveBeenCalled();
  expect(jwksTransport).not.toHaveBeenCalled();
  expectNoDatabaseCalls();
  expect(snapshot()).toEqual(before);
});

test.each([
  ['wrong audience', () => token({ aud: 'com.example.other-app' })],
  ['missing audience', () => token({ aud: undefined })],
  ['wrong issuer', () => token({ iss: 'https://not-apple.example.test' })],
  ['missing issuer', () => token({ iss: undefined })],
  ['expired credential', () => token({ exp: Math.floor(Date.now() / 1000) - 60 })],
  ['future credential', () => token({ nbf: Math.floor(Date.now() / 1000) + 300 })],
  ['wrong RSA signature', () => token({}, wrongPrivateKey)],
])('real Apple verification rejects %s before account-linking SQL', async (_label, makeToken) => {
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple').send({ idToken: makeToken() });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: 'Apple authentication failed' });
  expect(verifyCall).toHaveBeenCalledTimes(1);
  expect(jwksTransport).toHaveBeenCalledTimes(1);
  expectNoDatabaseCalls();
  expect(snapshot()).toEqual(before);
});

test('malformed JWT text returns generic 401 without account SQL or a JWKS request', async () => {
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple').send({ idToken: 'not-a-jwt' });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: 'Apple authentication failed' });
  expect(verifyCall).toHaveBeenCalledTimes(1);
  expect(jwksTransport).not.toHaveBeenCalled();
  expectNoDatabaseCalls();
  expect(snapshot()).toEqual(before);
});

test('intended Apple credentials use the real linked account, persist timestamps and issue a usable application session', async () => {
  const before = snapshot();
  const response = await request(server).post('/api/auth/apple').send({ idToken: token() });
  await expectUsableAppSession(response, linkedUserId);
  expect(response.body.isNewUser).toBe(false);
  expect(response.body.linked).toBe(false);
  expect(response.body.user.email).toBe(EMAIL);
  expect(verifyCall).toHaveBeenCalledTimes(1);
  expect(jwksTransport).toHaveBeenCalledTimes(1);
  const after = snapshot();
  const updatedUser = after.native_users.find(user => user.id === linkedUserId);
  const updatedProvider = after.native_auth_providers.find(provider => provider.provider_user_id === SUBJECT);
  expect(updatedUser.last_login_at).not.toBe(OLD_TIME);
  expect(updatedProvider.last_used_at).not.toBe(OLD_TIME);
  before.native_users.find(user => user.id === linkedUserId).last_login_at = updatedUser.last_login_at;
  before.native_auth_providers.find(provider => provider.provider_user_id === SUBJECT).last_used_at = updatedProvider.last_used_at;
  expect(after).toEqual(before); // Every unrelated fixture row remains unchanged.
});

test('Apple configuration can recover locally without changing the app or bypassing real verification', async () => {
  delete process.env.APPLE_CLIENT_ID;
  const intended = token();
  const unavailable = await request(server).post('/api/auth/apple').send({ idToken: intended });
  expect(unavailable.status).toBe(503);
  expectNoDatabaseCalls();
  expect(verifyCall).not.toHaveBeenCalled();
  process.env.APPLE_CLIENT_ID = `  ${AUDIENCE}  `;
  const accepted = await request(server).post('/api/auth/apple').send({ idToken: intended });
  await expectUsableAppSession(accepted, linkedUserId);
  expect(verifyCall).toHaveBeenCalledTimes(1);
  expect(jwksTransport).toHaveBeenCalledTimes(1);
});

test('a real SQL failure after successful verification remains generic 500 and can recover', async () => {
  sqlite.run(`CREATE TRIGGER ia01_fail_provider_update BEFORE UPDATE OF last_used_at ON native_auth_providers
    BEGIN SELECT RAISE(ABORT, 'IA01_INTERNAL_STORAGE_DETAIL'); END`);
  const before = snapshot();
  const signedToken = token();
  const failed = await request(server).post('/api/auth/apple').send({ idToken: signedToken });
  expect(failed.status).toBe(500);
  expect(failed.body).toEqual({ error: 'Apple authentication failed' });
  expect(verifyCall).toHaveBeenCalledTimes(1);
  expect(jwksTransport).toHaveBeenCalledTimes(1);
  expect(database.get).toHaveBeenCalled();
  expect(database.run).toHaveBeenCalled();
  expect(snapshot()).toEqual(before);
  sqlite.run('DROP TRIGGER ia01_fail_provider_update');
  const recovered = await request(server).post('/api/auth/apple').send({ idToken: signedToken });
  await expectUsableAppSession(recovered, linkedUserId);
});

test('createApp with Apple disabled preserves health, static pages, admin HTML and password sign-in', async () => {
  delete process.env.APPLE_CLIENT_ID;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const health = await request(server).get('/api/health');
  expect(health.status).toBe(200);
  expect(health.body.status).toBe('ok');
  const landing = await request(server).get('/');
  expect(landing.status).toBe(200);
  expect(landing.headers['content-type']).toMatch(/text\/html/);
  const admin = await request(server).get('/admin');
  expect(admin.status).toBe(200);
  expect(admin.text).toContain('Admin Panel');
  expectNoDatabaseCalls();
  const apple = await request(server).post('/api/auth/apple').send({ idToken: token() });
  expect(apple.status).toBe(503);
  expectNoDatabaseCalls();
  const password = await request(server).post('/api/auth/login').send({ email: 'ia01-password@example.test', password: PASSWORD });
  await expectUsableAppSession(password, passwordUserId);
  expect(verifyCall).not.toHaveBeenCalled();
  expect(jwksTransport).not.toHaveBeenCalled();
  expect(sqlite.get('SELECT last_login_at FROM native_users WHERE id = ?', [passwordUserId]).last_login_at).not.toBe(OLD_TIME);
});
