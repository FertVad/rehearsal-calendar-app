/**
 * T-265: the server refuses an app build older than MIN_IOS_BUILD with 426
 * UPDATE_REQUIRED, before the database is woken, through the real app and its
 * mounts; and refuses nothing that is not the app's.
 */
import { jest } from '@jest/globals';

const database = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));
jest.unstable_mockModule('../../utils/logger.js', () => ({ logger }));
jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Tests must not load .env'); });

const runtime = { ensureInitialized: jest.fn(), checkReady: jest.fn() };

let server;
let base;
beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  await new Promise((resolve, reject) => {
    server = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

const before = process.env.MIN_IOS_BUILD;
beforeEach(() => {
  for (const mock of [...Object.values(database), ...Object.values(runtime)]) mock.mockReset();
  logger.error.mockClear();
  runtime.ensureInitialized.mockResolvedValue(true);
  runtime.checkReady.mockResolvedValue(true);
  // Every database read refuses: a request that reaches one is not 426.
  for (const mock of Object.values(database)) mock.mockRejectedValue(new Error('database'));
});
afterEach(() => {
  if (before === undefined) delete process.env.MIN_IOS_BUILD;
  else process.env.MIN_IOS_BUILD = before;
});

async function request(path, { build, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (build !== undefined) {
    headers['X-App-Version'] = '1.0.0';
    headers['X-App-Build'] = String(build);
  }
  const response = await fetch(base + path, { method, headers, body: body && JSON.stringify(body), redirect: 'manual' });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a page */ }
  return { status: response.status, body: json };
}

const REFUSED = { status: 426, body: { error: 'Update required', code: 'UPDATE_REQUIRED' } };
const nothingTouched = () => {
  expect(runtime.ensureInitialized).not.toHaveBeenCalled();
  for (const mock of Object.values(database)) expect(mock).not.toHaveBeenCalled();
};

describe('MIN_IOS_BUILD=6', () => {
  beforeEach(() => { process.env.MIN_IOS_BUILD = '6'; });

  test.each([
    ['GET', '/api/native/app-version'],
    ['GET', '/api/native/projects'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/auth/refresh'],
    ['GET', '/api/native/invite/ABCDEFGH'],
  ])('build 5 gets 426 on %s %s, and the database is never asked', async (method, path) => {
    expect(await request(path, { build: 5, method, body: method === 'POST' ? { email: 'a@b.c', password: 'x' } : undefined }))
      .toEqual(REFUSED);
    nothingTouched();
  });

  test.each([
    ['GET', '/api/native/app-version'],
    ['GET', '/api/native/projects'],
    ['POST', '/api/auth/login'],
  ])('a request with no build header gets 426 on %s %s: TestFlight 1–5 send none', async (method, path) => {
    expect(await request(path, { method, body: method === 'POST' ? { email: 'a@b.c', password: 'x' } : undefined }))
      .toEqual(REFUSED);
    nothingTouched();
  });

  test('build 6 is answered: the version check says 200 with the minimum', async () => {
    expect(await request('/api/native/app-version', { build: 6 })).toEqual({ status: 200, body: { minIosBuild: 6 } });
  });

  test.each([6, 7, 12])('build %i goes on to the database and the routes', async (build) => {
    const projects = await request('/api/native/projects', { build });
    expect(projects.status).toBe(401); // no token: the auth route's own answer
    const login = await request('/api/auth/login', { build, method: 'POST', body: { email: 'a@b.c', password: 'x' } });
    expect(login.status).not.toBe(426);
    expect(runtime.ensureInitialized).toHaveBeenCalled();
  });

  test.each([
    '/api/health', '/api/ready', '/', '/privacy', '/support', '/invite/ABCDEFGH', '/admin', '/api/cron/reminders',
  ])('%s is not the app\'s and is never refused', async (path) => {
    expect((await request(path)).status).not.toBe(426);
  });

  test('/admin/api/login is not refused', async () => {
    const response = await request('/admin/api/login', { method: 'POST', body: { password: 'x' } });
    expect(response.status).not.toBe(426);
  });
});

describe('MIN_IOS_BUILD unset, 0 or not a number refuses nobody', () => {
  test.each([undefined, '', '0', 'six'])('MIN_IOS_BUILD=%p', async (value) => {
    if (value === undefined) delete process.env.MIN_IOS_BUILD;
    else process.env.MIN_IOS_BUILD = value;
    for (const build of [undefined, 1, 5, 6]) {
      expect(await request('/api/native/app-version', { build })).toEqual({ status: 200, body: { minIosBuild: 0 } });
      expect((await request('/api/native/projects', { build })).status).toBe(401);
    }
  });

  test('a value that is not a whole number is logged once', async () => {
    process.env.MIN_IOS_BUILD = 'seven';
    await request('/api/native/app-version', { build: 1 });
    await request('/api/native/app-version', { build: 1 });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('MIN_IOS_BUILD');
  });
});
