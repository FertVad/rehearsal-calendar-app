import { jest } from '@jest/globals';

const database = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.unstable_mockModule('../database/db.js', () => ({ default: database, isPostgres: false }));
jest.unstable_mockModule('../utils/logger.js', () => ({ logger }));
jest.unstable_mockModule('../config/env.js', () => { throw new Error('Tests must not load .env'); });

let server;
let base;
let token;
beforeAll(async () => {
  const { createApp } = await import('../app.js');
  const { generateTokens } = await import('../middleware/jwtMiddleware.js');
  token = generateTokens(1, 1).accessToken;
  await new Promise((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  for (const mock of Object.values(database)) mock.mockReset();
  logger.error.mockClear();
  database.get.mockResolvedValue({ token_version: 1, timezone: 'UTC' });
  database.all.mockResolvedValue([]);
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function http(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: await response.json() };
}

test('a failed auth read returns generic 500 without a write, and the next request recovers', async () => {
  database.get.mockRejectedValueOnce(Object.assign(new Error('PRIVATE_DATABASE_VALUE'), { code: '42P01' }));
  const failed = await http('/api/native/projects', { method: 'POST', body: JSON.stringify({ name: 'must not exist' }) });
  expect(failed).toEqual({ status: 500, body: { error: 'Internal server error' } });
  expect(database.run).not.toHaveBeenCalled();
  expect(database.all).not.toHaveBeenCalled();
  expect(database.transaction).not.toHaveBeenCalled();
  expect((await http('/api/health')).status).toBe(200);
  expect((await http('/api/native/projects')).status).toBe(200);
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('PRIVATE_DATABASE_VALUE');
});

test.each([
  ['malformed JSON', '{"password":"PRIVATE_REQUEST_VALUE"', 400, 'Bad Request'],
  ['oversized JSON', JSON.stringify({ password: 'PRIVATE_REQUEST_VALUE'.repeat(6000) }), 413, 'Payload Too Large'],
])('%s keeps its parser status without echoing request data', async (_name, body, status, message) => {
  expect(await http('/admin/api/login', { method: 'POST', body })).toEqual({ status, body: { error: message } });
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('PRIVATE_REQUEST_VALUE');
  expect(database.get).not.toHaveBeenCalled();
  expect((await http('/api/health')).status).toBe(200);
});

describe.each(['/api/native/availability/bulk', '/api/availability/bulk'])('%s', path => {
  test.each([null, [], 17, { startsAt: 17, type: 'busy' }])('rejects malformed entry %p before slot lookup or writes', async entry => {
    const result = await http(path, { method: 'POST', body: JSON.stringify({ entries: [entry] }) });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: expect.any(String) });
    expect(database.get).toHaveBeenCalledTimes(1); // Only the auth revocation check.
    expect(database.get.mock.calls[0][0]).toContain('token_version');
    expect(database.run).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
