import { jest } from '@jest/globals';

const forbidden = jest.fn(() => {
  throw new Error('Public admin HTTP checks must not access a database or load .env');
});
jest.unstable_mockModule('../database/db.js', () => ({
  default: { get: forbidden, all: forbidden, run: forbidden },
  initDatabase: forbidden, testConnection: forbidden, isPostgres: false,
}));
jest.unstable_mockModule('../config/env.js', () => { forbidden(); return {}; });

let server;
let base;
beforeAll(async () => {
  const { createApp } = await import('../app.js');
  await new Promise((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});
afterEach(() => expect(forbidden).not.toHaveBeenCalled());

test.each(['/admin', '/admin/'])('%s serves the dashboard directly with strict CSP', async (path) => {
  const response = await fetch(base + path, { redirect: 'manual' });
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('content-type')).toMatch(/^text\/html/);
  expect(response.headers.get('content-security-policy')).toContain("script-src-attr 'none'");
  expect(response.headers.get('content-security-policy')).not.toContain("'unsafe-inline'");
  expect(html).toContain('src="/admin/dashboard.js"');
  expect(html).toContain('href="/admin/dashboard.css"');
});

test.each([
  ['/admin/dashboard.js', /(?:application|text)\/javascript/],
  ['/admin/dashboard.css', /text\/css/],
])('%s remains a static asset with its correct MIME type', async (path, mime) => {
  const response = await fetch(base + path, { redirect: 'manual' });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(mime);
  expect((await response.text()).length).toBeGreaterThan(0);
});

test('admin API still requires authorization before accessing data', async () => {
  const response = await fetch(base + '/admin/api/users');
  expect(response.status).toBe(401);
  expect(await response.json()).toHaveProperty('error');
});

test('extensionless public pages still resolve through static middleware', async () => {
  const response = await fetch(base + '/privacy', { redirect: 'manual' });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^text\/html/);
  expect(await response.text()).toContain('<html');
});
