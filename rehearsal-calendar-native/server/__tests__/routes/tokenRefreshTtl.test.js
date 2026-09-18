import { jest } from '@jest/globals';
import net from 'node:net';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

// Real createApp/auth route, JWT signing and SQL against an in-memory database.
// The production DB adapter/environment loader must never initialize here.
const SECRET = 'id01-http-isolated-signing-secret';
const savedEnvironment = Object.fromEntries(['JWT_SECRET', 'JWT_EXPIRES_IN', 'REFRESH_TOKEN_EXPIRES_IN']
  .map(key => [key, process.env[key]]));
let sqlite;
let server;
let createApp;
let userId;
let connectGuard;
const blockedConnections = [];
const forbidden = jest.fn(() => { throw new Error('ID01 tests must not initialize runtime resources'); });
const database = Object.fromEntries(['get', 'all', 'run', 'transaction'].map(method =>
  [method, jest.fn((...args) => sqlite[method](...args))]));
jest.unstable_mockModule('../../database/db.js', () => ({
  default: database, isPostgres: false, initDatabase: forbidden, testConnection: forbidden,
}));
jest.unstable_mockModule('../../config/env.js', () => { forbidden(); return {}; });

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeUndefined();
  expect(process.env.POSTGRES_URL).toBeUndefined();
  process.env.JWT_SECRET = SECRET;
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  const originalConnect = net.Socket.prototype.connect;
  connectGuard = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const options = typeof first === 'object' ? first : { port: first, host: args[1] };
    if (options.host !== '127.0.0.1' || Number(options.port) !== server?.address()?.port) {
      blockedConnections.push({ host: options.host, port: options.port });
      throw new Error('Only the owned ID01 loopback listener is allowed');
    }
    return originalConnect.apply(this, args);
  });
  ({ createApp } = await import('../../app.js'));
});

beforeEach(async () => {
  sqlite = await setupIntegrationDb();
  userId = sqlite.run(
    'INSERT INTO native_users (email, first_name, token_version) VALUES (?, ?, ?)',
    ['id01-refresh@example.test', 'ID01', 4],
  ).lastInsertId;
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
  connectGuard?.mockRestore();
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function oldRefresh(overrides = {}) {
  // Ten days old exceeds the new 7d refresh TTL but not this token's original
  // signed 90d expiry. A new policy must not retroactively apply maxAge.
  const iat = Math.floor(Date.now() / 1000) - 10 * 86400;
  return jwt.sign({ userId, tv: 4, type: 'refresh', iat, ...overrides }, SECRET, { expiresIn: '90d' });
}

function usersSnapshot() {
  return sqlite.all('SELECT * FROM native_users ORDER BY id');
}

test('an old valid refresh token yields the unchanged response shape with newly configured lifetimes', async () => {
  const before = usersSnapshot();
  const response = await request(server).post('/api/auth/refresh').send({ refreshToken: oldRefresh() });
  expect(response.status).toBe(200);
  expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'refreshToken']);
  const access = jwt.verify(response.body.accessToken, SECRET);
  const refresh = jwt.verify(response.body.refreshToken, SECRET);
  expect(access).toMatchObject({ userId, tv: 4, type: 'access' });
  expect(refresh).toMatchObject({ userId, tv: 4, type: 'refresh' });
  expect(access.exp - access.iat).toBe(900);
  expect(refresh.exp - refresh.iat).toBe(604800);
  const profile = await request(server).get('/api/auth/me').set('Authorization', 'Bearer ' + response.body.accessToken);
  expect(profile.status).toBe(200);
  expect(profile.body.user.id).toBe(userId);
  expect(usersSnapshot()).toEqual(before);
  expect(database.run).not.toHaveBeenCalled();
  expect(database.transaction).not.toHaveBeenCalled();
});

test('an otherwise valid old refresh token remains revoked when its version predates the database', async () => {
  const before = usersSnapshot();
  const response = await request(server).post('/api/auth/refresh').send({ refreshToken: oldRefresh({ tv: 3 }) });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: 'Session revoked' });
  expect(usersSnapshot()).toEqual(before);
  expect(database.run).not.toHaveBeenCalled();
});

test.each([
  ['expired', () => jwt.sign({ userId, tv: 4, type: 'refresh' }, SECRET, { expiresIn: -1 })],
  ['access type', () => jwt.sign({ userId, tv: 4, type: 'access' }, SECRET, { expiresIn: '1h' })],
])('%s token cannot renew and is rejected before database work', async (_label, makeToken) => {
  const before = usersSnapshot();
  const response = await request(server).post('/api/auth/refresh').send({ refreshToken: makeToken() });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: 'Invalid or expired refresh token' });
  Object.values(database).forEach(fn => expect(fn).not.toHaveBeenCalled());
  expect(usersSnapshot()).toEqual(before);
});

test('invalid lifetime configuration prevents fresh app initialization before auth route writes', async () => {
  const before = usersSnapshot();
  process.env.JWT_EXPIRES_IN = '120';
  jest.resetModules();
  await expect(import('../../app.js')).rejects.toThrow(/JWT_EXPIRES_IN/);
  Object.values(database).forEach(fn => expect(fn).not.toHaveBeenCalled());
  expect(usersSnapshot()).toEqual(before);
});
