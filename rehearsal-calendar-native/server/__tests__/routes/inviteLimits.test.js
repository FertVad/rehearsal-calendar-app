import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let db, data, request, createApp, token, server;
beforeAll(async () => {
  db = await setupIntegrationDb();
  data = await seedTestData(db);
  db.run("UPDATE native_projects SET invite_code = 'ABCDEFGH', invite_expires_at = '2099-01-01T00:00:00Z' WHERE id = ?", [data.projectId]);
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres: false }));
  jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Never load .env in tests'); });
  request = (await import('supertest')).default;
  ({ createApp } = await import('../../app.js'));
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  token = generateTokens(data.adminId, 1).accessToken;
});
beforeEach(async () => {
  // The route/alias assertions must not depend on hitting a wall-clock minute
  // boundary. PostgreSQL probes separately exercise the real database clock.
  for (const method of ['get', 'all', 'run']) {
    const original = db[method].bind(db);
    jest.spyOn(db, method).mockImplementation((sql, params) => original(
      sql.replace(/strftime\('%s',\s*'now'\)/g, "'1900000020'"), params
    ));
  }
  db.run("UPDATE native_projects SET invite_code = 'ABCDEFGH', invite_expires_at = '2099-01-01T00:00:00Z' WHERE id = ?", [data.projectId]);
  // Works both before the repair and after the additive migration is present.
  if (db.get("SELECT name FROM sqlite_master WHERE name = 'native_invite_ip_rate_limits'")) {
    db.run('DELETE FROM native_invite_ip_rate_limits');
    db.run('DELETE FROM native_invite_account_rate_limits');
    db.run('UPDATE native_invite_ip_rate_limit_gate SET key_count = 0 WHERE id = 1');
  }
  server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
});
afterEach(async () => {
  jest.restoreAllMocks();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});
afterAll(() => closeIntegrationDb());

function http(path, { method = 'get', ip = '192.0.2.10', authenticated = true } = {}) {
  const req = request(server)[method](path).set('X-Forwarded-For', ip);
  return authenticated ? req.set('Authorization', `Bearer ${token}`) : req;
}
const wasInviteLookup = ([sql]) => /FROM native_projects WHERE invite_code/.test(sql);

test('the legacy join address cannot escape the 20-request IP budget', async () => {
  const get = jest.spyOn(db, 'get');
  const run = jest.spyOn(db, 'run');
  for (let i = 0; i < 20; i++) {
    expect((await http('/api/native/projects/ZZZZZZZZ/join', { method: 'post' })).status).toBe(404);
  }
  const before = get.mock.calls.filter(wasInviteLookup).length;
  const response = await http('/api/native/projects/ZZZZZZZZ/join', { method: 'post' });
  expect(response.status).toBe(429);
  expect(get.mock.calls.filter(wasInviteLookup)).toHaveLength(before);
  expect(run.mock.calls.some(([sql]) => /INSERT INTO native_project_members|UPDATE native_project_members/.test(sql))).toBe(false);
});

test('canonical preview and legacy redemption consume the same IP budget', async () => {
  const get = jest.spyOn(db, 'get');
  for (let i = 0; i < 20; i++) {
    expect((await http('/api/native/invite/ABCDEFGH', { authenticated: false })).status).toBe(200);
  }
  const before = get.mock.calls.filter(wasInviteLookup).length;
  const response = await http('/api/native/projects/ZZZZZZZZ/join', { method: 'post' });
  expect(response.status).toBe(429);
  expect(get.mock.calls.filter(wasInviteLookup)).toHaveLength(before);
  expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60);
  expect(response.headers['ratelimit-policy']).toBe('20;w=60');
  expect(response.headers['ratelimit-limit']).toBe('20');
  expect(response.headers['ratelimit-remaining']).toBe('0');
  expect(response.headers['ratelimit-reset']).toBe(response.headers['retry-after']);
});

test('rotating IP addresses and aliases cannot reset the authenticated account budget', async () => {
  for (let i = 0; i < 20; i++) {
    const prefix = i % 2 ? 'projects' : 'invite';
    expect((await http(`/api/native/${prefix}/ZZZZZZZZ/join`, { method: 'post', ip: `192.0.2.${i + 1}` })).status).toBe(404);
  }
  const before = db.get.mock.calls.filter(wasInviteLookup).length;
  const response = await http('/api/native/invite/ZZZZZZZZ/join', { method: 'post', ip: '192.0.2.222' });
  expect(response.status).toBe(429);
  expect(response.headers['ratelimit-remaining']).toBe('0');
  expect(db.get.mock.calls.filter(wasInviteLookup)).toHaveLength(before);
});

test('HEAD and mapped-IPv4 forms share the public preview IP budget', async () => {
  for (let i = 0; i < 20; i++) {
    expect((await http('/api/native/invite/ABCDEFGH', { method: 'head', ip: '::ffff:c000:20a', authenticated: false })).status).toBe(200);
  }
  const response = await http('/api/native/invite/ABCDEFGH', { ip: '192.0.2.10', authenticated: false });
  expect(response.status).toBe(429);
  expect(response.headers['cache-control']).toBe('no-store');
});

test.each(['invite', 'projects'])('%s join authenticates before allocating an account budget', async prefix => {
  const response = await http(`/api/native/${prefix}/ABCDEFGH/join`, { method: 'post', authenticated: false });
  expect(response.status).toBe(401);
  expect(db.all('SELECT * FROM native_invite_account_rate_limits')).toEqual([]);
});

test('short and exact-match legacy hexadecimal codes still return previews', async () => {
  expect((await http('/api/native/invite/ABCDEFGH', { authenticated: false })).body.projectId).toBe(String(data.projectId));
  const legacy = '0123456789abcdef'.repeat(2);
  db.run('UPDATE native_projects SET invite_code = ? WHERE id = ?', [legacy, data.projectId]);
  expect((await http(`/api/native/invite/${legacy}`, { authenticated: false })).status).toBe(200);
  expect((await http(`/api/native/invite/${legacy.toUpperCase()}`, { authenticated: false })).status).toBe(404);
});

test('malformed codes consume attempts without reaching the invite lookup', async () => {
  const before = db.get.mock.calls.filter(wasInviteLookup).length;
  expect((await http('/api/native/invite/not-a-code', { authenticated: false })).status).toBe(404);
  expect(db.get.mock.calls.filter(wasInviteLookup)).toHaveLength(before);
  expect(db.get('SELECT request_count FROM native_invite_ip_rate_limits').request_count).toBe(1);
});

test('exhausting redemption leaves admin management, project access and HTML fallback intact', async () => {
  for (let i = 0; i < 20; i++) await http('/api/native/invite/ABCDEFGH', { authenticated: false });
  for (const prefix of ['projects', 'invite']) {
    const path = `/api/native/${prefix}/${data.projectId}/invite`;
    expect((await http(path)).status).toBe(200);
    expect((await http(path, { method: 'post' })).status).toBe(200);
  }
  expect((await http(`/api/native/projects/${data.projectId}`, { authenticated: false })).status).toBe(401);
  expect((await http(`/api/native/projects/${data.projectId}`)).status).toBe(200);
  const before = db.get.mock.calls.length;
  const page = await http('/invite/ABCDEFGH', { authenticated: false });
  expect(page.status).toBe(200);
  expect(page.headers['content-type']).toContain('text/html');
  expect(db.get.mock.calls).toHaveLength(before);
  expect((await http(`/api/native/invite/${data.projectId}/invite`, { method: 'delete' })).status).toBe(200);
  expect(db.get('SELECT invite_code FROM native_projects WHERE id = ?', [data.projectId]).invite_code).toBeNull();
});

test('rate storage loss fails closed before invite lookup, and restoration recovers', async () => {
  db.run('ALTER TABLE native_invite_ip_rate_limits RENAME TO unavailable_invite_rates');
  const before = db.get.mock.calls.filter(wasInviteLookup).length;
  try {
    const response = await http('/api/native/invite/ABCDEFGH', { authenticated: false });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Invitations are temporarily unavailable' });
    expect(db.get.mock.calls.filter(wasInviteLookup)).toHaveLength(before);
    expect((await request(server).get('/api/health')).status).toBe(200);
  } finally {
    db.run('ALTER TABLE unavailable_invite_rates RENAME TO native_invite_ip_rate_limits');
  }
  expect((await http('/api/native/invite/ABCDEFGH', { authenticated: false })).status).toBe(200);
});
