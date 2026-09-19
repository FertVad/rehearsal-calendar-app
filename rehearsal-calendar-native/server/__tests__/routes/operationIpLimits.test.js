import { jest } from '@jest/globals';
import net from 'node:net';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';
import { observeDatabase, isOperationBudgetSql, operationBudgetTables } from '../integration/observeDatabase.js';

const CLIENT_IP = '198.51.100.17';
const SECRET = 'is02-http-isolated-signing-secret';
const PASSWORD = 'is02-synthetic-admin-password';
const savedEnvironment = Object.fromEntries(['JWT_SECRET', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD', 'NODE_ENV', 'DATABASE_URL', 'POSTGRES_URL']
  .map(key => [key, process.env[key]]));
let sqlite;
let createApp;
let connectGuard;
let compareCall;
let passwordHash;
let userId;
const servers = [];
const blockedConnections = [];
const forbidden = jest.fn(() => { throw new Error('IS02 tests must not initialize runtime resources'); });
const observer = observeDatabase(() => sqlite);
const { database } = observer;
jest.unstable_mockModule('../../database/db.js', () => ({
  default: database, isPostgres: false, initDatabase: forbidden, testConnection: forbidden,
}));
jest.unstable_mockModule('../../config/env.js', () => { forbidden(); return {}; });

function snapshot() {
  const tables = sqlite.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return Object.fromEntries(tables.filter(({ name }) => !operationBudgetTables.has(name))
    .map(({ name }) => [name, sqlite.all(`SELECT * FROM "${name}" ORDER BY rowid`)]));
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeUndefined();
  expect(process.env.POSTGRES_URL).toBeUndefined();
  process.env.JWT_SECRET = SECRET;
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  process.env.ADMIN_PASSWORD_HASH = passwordHash;
  const originalConnect = net.Socket.prototype.connect;
  connectGuard = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const options = typeof first === 'object' ? first : { port: first, host: args[1] };
    if (options.host !== '127.0.0.1' || !servers.some(server => Number(options.port) === server.address()?.port)) {
      blockedConnections.push({ host: options.host, port: options.port });
      throw new Error('Only owned IS02 loopback listeners are allowed');
    }
    return originalConnect.apply(this, args);
  });
  const compare = bcrypt.compare;
  compareCall = jest.spyOn(bcrypt, 'compare').mockImplementation((...args) => {
    expect(observer.transactions.filter(transaction => transaction.state === 'active')).toEqual([]);
    return compare(...args);
  });
  ({ createApp } = await import('../../app.js'));
});

beforeEach(async () => {
  sqlite = await setupIntegrationDb();
  userId = sqlite.run('INSERT INTO native_users (email, first_name, password_hash) VALUES (?, ?, ?)',
    ['is02-unrelated@example.test', 'Unrelated', passwordHash]).lastInsertId;
  observer.clear();
  compareCall.mockClear();
  blockedConnections.length = 0;
  for (let index = 0; index < 2; index++) {
    const server = await new Promise((resolve, reject) => {
      const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    servers.push(server);
  }
});

afterEach(async () => {
  await Promise.all(servers.map(server => new Promise((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()))));
  servers.length = 0;
  closeIntegrationDb();
  expect(blockedConnections).toEqual([]);
  expect(forbidden).not.toHaveBeenCalled();
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (['JWT_SECRET', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD'].includes(key)) continue;
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const send = (server = servers[0], path = '/api/auth/apple', body = {}, ip = CLIENT_IP) =>
  request(server).post(path).set('X-Forwarded-For', ip).send(body);
const rows = () => sqlite.all('SELECT * FROM native_operation_ip_rate_limits ORDER BY operation, ip_key');
function noBusinessSql() {
  expect(observer.statements.filter(statement => !isOperationBudgetSql(statement))).toEqual([]);
}
function rateHeaders(response, limit, windowSeconds, remaining) {
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['ratelimit-policy']).toBe(`${limit};w=${windowSeconds}`);
  expect(response.headers['ratelimit-limit']).toBe(String(limit));
  expect(response.headers['ratelimit-remaining']).toBe(String(remaining));
  expect(Number(response.headers['ratelimit-reset'])).toBeGreaterThanOrEqual(1);
  expect(Number(response.headers['ratelimit-reset'])).toBeLessThanOrEqual(windowSeconds);
  expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  if (response.status === 429) expect(response.headers['retry-after']).toBe(response.headers['ratelimit-reset']);
}

afterAll(() => {
  compareCall?.mockRestore();
  connectGuard?.mockRestore();
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('two actual applications share the twenty-request auth budget for one IP', async () => {
  const before = snapshot();
  const batches = [];
  for (const server of servers) {
    const statuses = [];
    for (let index = 0; index < 20; index++) {
      const response = await request(server).post('/api/auth/apple').set('X-Forwarded-For', CLIENT_IP).send({});
      expect([400, 429]).toContain(response.status);
      if (response.status === 400) expect(response.body).toEqual({ error: 'ID token is required' });
      statuses.push(response.status);
    }
    batches.push(statuses);
  }
  expect(snapshot()).toEqual(before);
  expect(compareCall).not.toHaveBeenCalled();
  console.info('IS02 synthetic auth admissions by app:', batches.map(batch => batch.filter(status => status === 400).length));
  expect(batches.flat().filter(status => status === 400)).toHaveLength(20);
  expect(batches.flat().filter(status => status === 429)).toHaveLength(20);
  expect(rows()).toEqual([expect.objectContaining({ operation: 'auth', request_count: 21 })]);
  noBusinessSql();
});

test('two actual applications share the five-request admin-login budget for one IP', async () => {
  const before = snapshot();
  const batches = [];
  for (const server of servers) {
    const statuses = [];
    for (let index = 0; index < 5; index++) {
      const response = await request(server).post('/admin/api/login').set('X-Forwarded-For', CLIENT_IP)
        .send({ password: 'is02-wrong-synthetic-password' });
      expect([401, 429]).toContain(response.status);
      if (response.status === 401) expect(response.body).toEqual({ error: 'Invalid password' });
      statuses.push(response.status);
    }
    batches.push(statuses);
  }
  expect(snapshot()).toEqual(before);
  console.info('IS02 synthetic admin admissions by app:', batches.map(batch => batch.filter(status => status === 401).length));
  expect(batches.flat().filter(status => status === 401)).toHaveLength(5);
  expect(batches.flat().filter(status => status === 429)).toHaveLength(5);
  expect(compareCall).toHaveBeenCalledTimes(5);
  expect(rows()).toEqual([expect.objectContaining({ operation: 'admin_login', request_count: 6 })]);
  noBusinessSql();
});

test('auth methods and paths share one namespace and keep legacy response headers', async () => {
  const first = await send();
  rateHeaders(first, 20, 60, 19);
  for (let index = 0; index < 19; index++) {
    const response = index % 3 === 0
      ? await request(servers[index % 2]).head('/api/auth/unknown').set('X-Forwarded-For', CLIENT_IP)
      : index % 3 === 1 ? await send(servers[0], '/api/auth/refresh', {})
        : await request(servers[1]).get('/api/auth/me').set('X-Forwarded-For', CLIENT_IP);
    expect([400, 401, 404]).toContain(response.status);
  }
  observer.clear();
  const before = snapshot();
  const denied = await send(servers[1], '/api/auth/login', { email: 'is02-unrelated@example.test', password: PASSWORD });
  expect(denied.status).toBe(429);
  expect(denied.body).toEqual({ error: 'Too many requests, please try again later' });
  rateHeaders(denied, 20, 60, 0);
  expect(compareCall).not.toHaveBeenCalled();
  noBusinessSql();
  expect(snapshot()).toEqual(before);
});

test('auth exhaustion leaves admin, another IP and unrelated namespaces available', async () => {
  for (let index = 0; index < 21; index++) await send();
  expect((await send(servers[1], '/api/auth/apple', {}, '198.51.100.18')).status).toBe(400);
  const admin = await send(servers[1], '/admin/api/login', { password: PASSWORD });
  expect(admin.status).toBe(200);
  rateHeaders(admin, 5, 900, 4);
  expect(jwt.verify(admin.body.token, SECRET)).toMatchObject({ role: 'admin' });
  expect((await request(servers[0]).get('/admin/api/stats').set('Authorization', `Bearer ${admin.body.token}`)).status).toBe(200);
  expect(sqlite.all('SELECT * FROM native_invite_ip_rate_limits')).toEqual([]);
  expect(sqlite.all('SELECT * FROM native_member_availability_rate_limits')).toEqual([]);
  expect(rows()).toHaveLength(3);
});

test('admin exhaustion preserves its message and does not block ordinary authentication', async () => {
  for (let index = 0; index < 5; index++) await send(servers[0], '/admin/api/login', {});
  const denied = await send(servers[1], '/admin/api/login', { password: PASSWORD });
  expect(denied.status).toBe(429);
  expect(denied.body).toEqual({ error: 'Too many login attempts, please try again later' });
  rateHeaders(denied, 5, 900, 0);
  expect(compareCall).not.toHaveBeenCalled();
  const login = await send(servers[1], '/api/auth/login', { email: 'is02-unrelated@example.test', password: PASSWORD });
  expect(login.status).toBe(200);
  expect(jwt.verify(login.body.accessToken, SECRET)).toMatchObject({ userId, type: 'access' });
  const profile = await request(servers[0]).get('/api/auth/me').set('X-Forwarded-For', CLIENT_IP)
    .set('Authorization', `Bearer ${login.body.accessToken}`);
  expect(profile.status).toBe(200);
  expect(profile.body.user.id).toBe(userId);
  expect(rows().find(row => row.operation === 'auth').request_count).toBe(2);
  expect(observer.statements.filter(statement => !isOperationBudgetSql(statement))
    .every(statement => statement.activeTransactions === 0)).toBe(true);
});

test('admin login prefix and methods share its existing five-attempt mount', async () => {
  for (let index = 0; index < 5; index++) {
    const response = await request(servers[index % 2])[index % 2 ? 'head' : 'get']('/admin/api/login/unknown')
      .set('X-Forwarded-For', CLIENT_IP);
    expect(response.status).toBe(404);
  }
  const denied = await send(servers[0], '/admin/api/login', { password: PASSWORD });
  expect(denied.status).toBe(429);
  rateHeaders(denied, 5, 900, 0);
  expect(compareCall).not.toHaveBeenCalled();
  noBusinessSql();
});

test.each([
  ['IPv4 aliases', ['198.51.100.17', '::ffff:198.51.100.17', '::ffff:c633:6411', '0:0:0:0:0:FFFF:C633:6411'], '198.51.100.18'],
  ['IPv6 /56 aliases', ['2001:db8:abcd:1200::1', '2001:DB8:ABCD:12FF::2', '2001:db8:abcd:12ab::ffff'], '2001:db8:abcd:1300::1'],
])('%s share storage identity without putting addresses in SQL', async (_name, aliases, different) => {
  for (let index = 0; index < 20; index++) expect((await send(servers[index % 2], '/api/auth/apple', {}, aliases[index % aliases.length])).status).toBe(400);
  expect((await send(servers[1], '/api/auth/apple', {}, aliases[0])).status).toBe(429);
  expect(rows()).toHaveLength(1);
  const args = JSON.stringify(observer.statements.map(({ params }) => params));
  for (const address of aliases) expect(args).not.toContain(address);
  expect(rows()[0].ip_key).toMatch(/^[a-f0-9]{64}$/);
  expect((await send(servers[0], '/api/auth/apple', {}, different)).status).toBe(400);
  expect(rows()).toHaveLength(2);
});

test('one trusted proxy hop uses the nearest forwarded address', async () => {
  for (let index = 0; index < 20; index++) {
    expect((await send(servers[0], '/api/auth/apple', {}, `192.0.2.${index + 1}, ${CLIENT_IP}`)).status).toBe(400);
  }
  expect((await send(servers[1], '/api/auth/apple', {}, `203.0.113.70, ${CLIENT_IP}`)).status).toBe(429);
  expect(rows()).toHaveLength(1);
  expect((await send(servers[1], '/api/auth/apple', {}, `${CLIENT_IP}, 198.51.100.18`)).status).toBe(400);
  expect(rows()).toHaveLength(2);
});

test.each(['not-an-ip', 'fe80::1%eth0'])('invalid forwarded identity %s fails before account work', async ip => {
  const before = snapshot();
  const response = await send(servers[0], '/api/auth/login', { email: 'is02-unrelated@example.test', password: PASSWORD }, ip);
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ error: 'Authentication is temporarily unavailable' });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(rows()).toEqual([]);
  expect(compareCall).not.toHaveBeenCalled();
  expect(observer.statements).toEqual([]);
  expect(snapshot()).toEqual(before);
});

test('preflight and rejected JSON stay outside admission while unknown auth prefixes spend budget', async () => {
  const preflight = await request(servers[0]).options('/api/auth/apple').set('Origin', 'http://localhost:3001')
    .set('Access-Control-Request-Method', 'POST');
  expect(preflight.status).toBe(204);
  const malformed = await request(servers[0]).post('/api/auth/apple').set('Content-Type', 'application/json').send('{');
  expect(malformed.status).toBe(400);
  expect(rows()).toEqual([]);
  expect(observer.statements).toEqual([]);
  expect((await request(servers[0]).get('/api/auth/unknown').set('X-Forwarded-For', CLIENT_IP)).status).toBe(404);
  expect(rows()[0].request_count).toBe(1);
  expect((await request(servers[0]).get('/api/authentication').set('X-Forwarded-For', CLIENT_IP)).status).toBe(404);
  expect(rows()[0].request_count).toBe(1);
});

test('database time anchors deadlines and Retry-After despite application clock skew', async () => {
  const dbNow = Number(sqlite.get("SELECT CAST(strftime('%s', 'now') AS INTEGER) AS now").now);
  const clock = jest.spyOn(Date, 'now').mockReturnValue((dbNow + 10 * 365 * 86400) * 1000);
  try {
    for (let index = 0; index < 20; index++) await send();
    const reset = rows()[0].reset_at;
    expect(reset).toBeGreaterThanOrEqual(dbNow + 60);
    expect(reset).toBeLessThanOrEqual(dbNow + 62);
    const denied = await send(servers[1]);
    expect(denied.status).toBe(429);
    rateHeaders(denied, 20, 60, 0);
    expect(rows()[0].reset_at).toBe(reset);
    sqlite.run('UPDATE native_operation_ip_rate_limits SET reset_at = ?', [dbNow - 1]);
    const resetResponse = await send();
    expect(resetResponse.status).toBe(400);
    rateHeaders(resetResponse, 20, 60, 19);
    expect(rows()[0].request_count).toBe(1);
  } finally { clock.mockRestore(); }
});

test('missing shared storage fails closed, preserves public pages and recovers after restoration', async () => {
  sqlite.run('ALTER TABLE native_operation_ip_rate_limits RENAME TO unavailable_operation_rates');
  const before = snapshot();
  try {
    for (const path of ['/api/auth/login', '/admin/api/login']) {
      const response = await send(servers[0], path, { email: 'is02-unrelated@example.test', password: PASSWORD });
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Authentication is temporarily unavailable' });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(compareCall).not.toHaveBeenCalled();
    noBusinessSql();
    expect(snapshot()).toEqual(before);
    observer.clear();
    for (const path of ['/api/health', '/', '/admin', '/invite/ABCDEFGH']) {
      expect((await request(servers[1]).get(path)).status).toBe(200);
    }
    expect(observer.statements).toEqual([]);
  } finally { sqlite.run('ALTER TABLE unavailable_operation_rates RENAME TO native_operation_ip_rate_limits'); }
  expect((await send()).status).toBe(400);
});

test('an uninitialized adapter does not prevent app assembly or public pages but cannot admit authentication', async () => {
  const initialized = sqlite;
  sqlite = undefined;
  try {
    expect(() => createApp()).not.toThrow();
    expect(observer.statements).toEqual([]);
    expect(observer.transactions).toEqual([]);
    for (const path of ['/api/health', '/', '/admin', '/invite/ABCDEFGH']) {
      expect((await request(servers[0]).get(path)).status).toBe(200);
    }
    for (const path of ['/api/auth/apple', '/admin/api/login']) {
      const response = await send(servers[0], path, { password: PASSWORD });
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Authentication is temporarily unavailable' });
    }
    expect(observer.statements).toEqual([]);
    expect(compareCall).not.toHaveBeenCalled();
  } finally { sqlite = initialized; }
  expect(rows()).toEqual([]);
  expect((await send()).status).toBe(400);
});

test.each(['production-without-URL', 'DATABASE_URL', 'POSTGRES_URL'])('%s cannot use the SQLite adapter for shared admission', async setting => {
  if (setting === 'production-without-URL') process.env.NODE_ENV = 'production';
  else process.env[setting] = 'postgresql://synthetic.invalid/never-connected';
  const before = snapshot();
  for (const path of ['/api/auth/login', '/admin/api/login']) {
    const response = await send(servers[0], path, { email: 'is02-unrelated@example.test', password: PASSWORD });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Authentication is temporarily unavailable' });
  }
  expect(observer.statements).toEqual([]);
  expect(observer.transactions).toEqual([]);
  expect(compareCall).not.toHaveBeenCalled();
  expect(snapshot()).toEqual(before);
  expect(rows()).toEqual([]);
  expect((await request(servers[1]).get('/api/health')).status).toBe(200);
});
