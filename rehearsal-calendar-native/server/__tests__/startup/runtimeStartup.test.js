import { createEntrypointFixture, createPgRefusal, fixtureAdminPassword, fixtureJwtSecret } from './entrypointFixture.mjs';

const fixtures = [];
const endpoints = [];
const publicRoutes = ['/', '/privacy', '/support', '/.well-known/apple-app-site-association',
  '/invite/ABCDEFGH', '/admin', '/admin/', '/admin/dashboard.js', '/admin/dashboard.css', '/api/health'];

async function refusal(options) {
  const endpoint = await createPgRefusal(options);
  endpoints.push(endpoint);
  return endpoint;
}
function copied(options) {
  const fixture = createEntrypointFixture(options);
  fixtures.push(fixture);
  return fixture;
}
async function publicPages(fixture) {
  for (const path of publicRoutes) expect((await fixture.request(path)).status).toBe(200);
}
afterEach(async () => {
  const active = fixtures.splice(0);
  try { await Promise.all(active.map(fixture => fixture.close())); }
  finally {
    await Promise.all(endpoints.splice(0).map(endpoint => endpoint.close()));
  }
});

test.each([false, true])('library import (VERCEL=%s) exports the app without listeners or database attempts', async vercel => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start({ mode: 'library', vercel });
  expect(fixture.events).toContainEqual({ type: 'imported', defaultHandler: true });
  expect(fixture.entrypointListeners).toEqual([]);
  expect(fixture.connectionAttempts).toBe(0);
  expect(endpoint.connections).toBe(0);
});

test('direct Vercel execution also leaves listener ownership to the platform', async () => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start({ mode: 'standalone', vercel: true });
  expect(fixture.exited).toBe(true);
  expect(fixture.exitStatus).toEqual({ code: 0, signal: null });
  expect(fixture.entrypointListeners).toEqual([]);
  expect(fixture.connectionAttempts).toBe(0);
  expect(endpoint.connections).toBe(0);
});

test('direct standalone startup serves every public route without attempting an unavailable database', async () => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start({ mode: 'standalone' });
  expect(fixture.entrypointListeners).toHaveLength(1);
  await publicPages(fixture);
  expect(fixture.connectionAttempts).toBe(0);
  expect(endpoint.connections).toBe(0);
});

test('an owned standalone child exits when its parent IPC channel closes', async () => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start({ mode: 'standalone' });
  expect(fixture.entrypointListeners).toHaveLength(1);
  await fixture.disconnect();
  expect(fixture.exitStatus).toEqual({ code: 1, signal: null });
  expect(endpoint.connections).toBe(0);
});

test('failed initialization is shared, cached and cannot take public routes offline', async () => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start({ mode: 'framework', vercel: true });
  expect(fixture.entrypointListeners).toEqual([]);
  await publicPages(fixture);
  expect(endpoint.connections).toBe(0);
  const results = await Promise.all([
    fixture.request('/api/auth/apple', { method: 'POST', body: {} }),
    fixture.request('/api/native/projects'),
    fixture.request('/admin/api/login', { method: 'POST', body: { password: fixtureAdminPassword } }),
    fixture.request('/api/ready'),
  ]);
  for (const response of results) {
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).not.toContain('owned fixture private refusal');
    expect(response.text).not.toContain(endpoint.url);
  }
  expect(results.slice(0, 3).map(response => response.body)).toEqual(Array(3).fill({ error: 'Service temporarily unavailable' }));
  expect(results[3].body).toEqual({ status: 'unavailable' });
  expect(endpoint.connections).toBe(1);
  expect(fixture.connectionAttempts).toBe(1);
  for (let index = 0; index < 3; index++) {
    expect((await fixture.request('/api/ready')).status).toBe(503);
    expect((await fixture.request('/api/native/projects')).status).toBe(503);
  }
  await publicPages(fixture);
  expect(endpoint.connections).toBe(1);
  expect(fixture.connectionAttempts).toBe(1);
});

test('an owned stalled PostgreSQL handshake is bounded and not retried by following requests', async () => {
  const endpoint = await refusal({ stall: true });
  const fixture = copied({ databaseUrl: endpoint.url });
  await fixture.start();
  const started = Date.now();
  const response = await fixture.request('/api/ready', { timeoutMs: 6500 });
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ status: 'unavailable' });
  expect(Date.now() - started).toBeLessThan(5500);
  expect(endpoint.connections).toBe(1);
  await publicPages(fixture);
  expect((await fixture.request('/api/ready')).status).toBe(503);
  expect(endpoint.connections).toBe(1);
}, 10000);

test('default startup ignores a synthetic adjacent .env unless explicitly selected', async () => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url, explicitEnvironmentFile: false });
  await fixture.start({ processEnvironment: {
    NODE_ENV: 'production', JWT_SECRET: fixtureJwtSecret, CRON_SECRET: 'r2-explicit-process-cron',
    ADMIN_PASSWORD: fixtureAdminPassword,
  } });
  await publicPages(fixture);
  const ready = await fixture.request('/api/ready');
  expect(ready.status).toBe(503);
  expect(ready.body).toEqual({ status: 'unavailable' });
  expect(endpoint.connections).toBe(0);
  expect(fixture.connectionAttempts).toBe(0);
});

test.each(['relative', 'missing absolute'])('an explicitly selected %s environment path is refused before database or listener startup', async kind => {
  const endpoint = await refusal();
  const fixture = copied({ databaseUrl: endpoint.url });
  const selected = kind === 'relative' ? '.env' : `${fixture.root}/missing-environment-file`;
  await fixture.start({ mode: 'standalone', processEnvironment: { SERVER_ENV_FILE: selected } });
  expect(fixture.exitStatus).toEqual({ code: 1, signal: null });
  expect(fixture.entrypointListeners).toEqual([]);
  expect(fixture.connectionAttempts).toBe(0);
  expect(endpoint.connections).toBe(0);
  expect(fixture.stderr).toContain(kind === 'relative'
    ? 'SERVER_ENV_FILE must be an explicit absolute path'
    : 'Unable to load the explicitly selected server environment file');
});

test('process database configuration takes precedence over the explicitly selected file', async () => {
  const processEndpoint = await refusal();
  const fileEndpoint = await refusal();
  const fixture = copied({ databaseUrl: processEndpoint.url, environment: { DATABASE_URL: fileEndpoint.url } });
  await fixture.start({ processEnvironment: { DATABASE_URL: processEndpoint.url } });
  await publicPages(fixture);
  expect(processEndpoint.connections).toBe(0);
  expect(fileEndpoint.connections).toBe(0);
  expect((await fixture.request('/api/ready')).status).toBe(503);
  expect(processEndpoint.connections).toBe(1);
  expect(fileEndpoint.connections).toBe(0);
  expect(fixture.connectionAttempts).toBe(1);
});
