/**
 * H01 persistence boundary: authenticated profile/report writes -> SQLite ->
 * real admin JSON routes. User text must stay literal, not be HTML-sanitized on
 * write. By default this checks persistence only. ADMIN_BROWSER_CHECK=1 also
 * renders each persisted case in Chromium through the real admin API/assets
 * and production security headers; no API responses are intercepted or mocked.
 *
 * No server.js, environment loader, production database or external services.
 */
import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { securityHeaders } from '../../middleware/securityHeaders.js';

let sqlite;
let app;
let server;
let generateTokens;
let userId;
let accessToken;
let adminToken;
let browser;

const BROWSER_CHECK = process.env.ADMIN_BROWSER_CHECK === '1';
const browserSuffix = BROWSER_CHECK ? ' [persisted data -> real API -> Chromium DOM/CSP]' : '';
if (BROWSER_CHECK) jest.setTimeout(30000);

const TEST_EMAIL = 'h01-author@example.test';
const TEST_ADMIN_PASSWORD = 'h01-admin-fixture-only';
const environmentKeys = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH'];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

// Only the positional parameters and NOW() used by these routes need adapting.
// All reads/writes still execute actual SQL against a fresh in-memory database.
function query(sql, params = []) {
  const bindings = [];
  const translated = sql.replace(/\$(\d+)/g, (_match, index) => {
    bindings.push(params[Number(index) - 1]);
    return '?';
  }).replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  return { statement: sqlite.prepare(translated), bindings };
}

const database = {
  get(sql, params) {
    const { statement, bindings } = query(sql, params);
    return statement.get(...bindings);
  },
  all(sql, params) {
    const { statement, bindings } = query(sql, params);
    return statement.all(...bindings);
  },
  run(sql, params) {
    const { statement, bindings } = query(sql, params);
    const result = statement.run(...bindings);
    return { lastInsertId: Number(result.lastInsertRowid), changes: result.changes };
  },
};

const externalCall = jest.fn(() => {
  throw new Error('External services must not be called by the admin text persistence tests');
});

jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));
jest.unstable_mockModule('../../utils/oauthVerification.js', () => ({
  verifyGoogleToken: externalCall,
  verifyAppleToken: externalCall,
}));
jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
  notifyProjectDeleted: externalCall,
}));

beforeAll(async () => {
  process.env.JWT_SECRET = 'h01-user-signing-secret-test-only';
  process.env.ADMIN_JWT_SECRET = 'h01-admin-signing-secret-test-only';
  process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD_HASH;

  const { default: authRoutes } = await import('../../routes/auth.js');
  const { default: bugReportRoutes } = await import('../../routes/native/bugReports.js');
  const { default: adminRoutes } = await import('../../routes/admin.js');
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  app = express();
  app.use(securityHeaders);
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../../public', import.meta.url))));
  app.use('/api/auth', authRoutes);
  app.use('/api/native/bug-reports', bugReportRoutes);
  app.use('/admin', adminRoutes);
  // Supertest otherwise binds an ephemeral listener on all interfaces. Keep
  // this isolated fixture reachable only from this machine's loopback address.
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  if (BROWSER_CHECK) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
    });
  }
});

beforeEach(async () => {
  externalCall.mockClear();
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE native_users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      phone TEXT,
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      locale TEXT DEFAULT 'en',
      notifications_enabled INTEGER DEFAULT 1,
      email_notifications INTEGER DEFAULT 1,
      week_start_day TEXT DEFAULT 'monday',
      onboarding_completed INTEGER DEFAULT 0,
      token_version INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE native_bug_reports (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES native_users(id),
      message TEXT NOT NULL,
      screen TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    -- The real stats API only counts these tables. No API stub is needed for
    -- the browser's loadAll(), and no projects/rehearsals are created here.
    CREATE TABLE native_projects (id INTEGER PRIMARY KEY);
    CREATE TABLE native_rehearsals (id INTEGER PRIMARY KEY);
  `);
  userId = Number(sqlite.prepare(
    'INSERT INTO native_users (email, first_name, last_name) VALUES (?, ?, ?)'
  ).run(TEST_EMAIL, 'Original', 'Author').lastInsertRowid);
  accessToken = generateTokens(userId, 1).accessToken;

  // Real admin login and middleware; no mocked authorization or response rows.
  const login = await request(server)
    .post('/admin/api/login')
    .send({ password: TEST_ADMIN_PASSWORD })
    .expect(200);
  expect(typeof login.body.token).toBe('string');
  adminToken = login.body.token;
});

afterEach(() => {
  try {
    expect(externalCall).not.toHaveBeenCalled();
  } finally {
    sqlite?.close();
    sqlite = undefined;
  }
});

afterAll(async () => {
  await browser?.close();
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

async function checkStoredContentInBrowser({ userName, email, reportName, message, screen }) {
  if (!BROWSER_CHECK) return;
  const context = await browser.newContext();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const externalRequests = [];
  const pageErrors = [];
  const apiResponses = [];
  try {
    // Permit the real local handlers and assets only. No synthetic response
    // fulfillment: all displayed records must come from this test's SQLite DB.
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      externalRequests.push(new URL(route.request().url()).origin);
      return route.abort();
    });
    await context.addInitScript(() => {
      window.__h01Violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__h01Violations.push(event.violatedDirective);
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/admin/api/')) apiResponses.push([path, response.status()]);
    });
    const documentResponse = await page.goto(`${origin}/admin/`);
    expect(documentResponse.status()).toBe(200);
    const policy = documentResponse.headers()['content-security-policy'];
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");

    // Fresh context: no token seeding. Exercise the real admin login UI and
    // server-issued bearer token without ever logging or snapshotting it.
    await page.locator('#login-screen').waitFor({ state: 'visible' });
    await page.locator('#password-input').fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.locator('#stats-loading').waitFor({ state: 'hidden' });
    await page.locator('#users-body td:nth-child(4)').waitFor({ state: 'attached' });
    await page.locator('#bugs-body .status-btn').first().waitFor({ state: 'visible' });

    expect(await page.locator('#users-body tr').count()).toBe(1);
    expect(await page.locator('#bugs-body tr').count()).toBe(1);
    expect(await page.locator('#users-body td').count()).toBe(4);
    expect(await page.locator('#bugs-body td').count()).toBe(5);
    expect(await page.locator('#users-body td').nth(0).textContent()).toBe(userName);
    expect(await page.locator('#users-body td').nth(1).textContent()).toBe(email);
    expect(await page.locator('#bugs-body td').nth(0).textContent()).toBe(reportName);
    expect(await page.locator('#bugs-body td').nth(1).textContent()).toBe(message);
    expect(await page.locator('#bugs-body td').nth(2).textContent()).toBe(screen || '-');
    // CSP might hide execution while unsafe markup still enters the DOM.
    // Assert both the absence of payload-created elements and the probe state.
    expect(await page.locator('#users-body, #bugs-body').locator('img, svg, script, form, b').count()).toBe(0);
    expect(await page.evaluate(() => window.__h01Probe)).toBeUndefined();
    expect(await page.evaluate(() => window.__h01Violations)).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(apiResponses).toEqual(expect.arrayContaining([
      ['/admin/api/login', 200], ['/admin/api/stats', 200],
      ['/admin/api/users', 200], ['/admin/api/bug-reports', 200],
    ]));
    expect(apiResponses.every(([, status]) => status === 200)).toBe(true);
  } finally {
    await context.close();
  }
}

const payloads = [
  ['image handler', '<img src="data:," onerror="window.__h01Probe=1">'],
  ['SVG handler', '<svg onload="window.__h01Probe=2"></svg>'],
  ['table/script delimiters', '</td></tr></tbody><script>window.__h01Probe=3</script>'],
  ['literal markup, entities and Unicode', '<b>שלום Русский 😀</b> &lt;svg&gt; &amp; "quotes" \'apostrophe\'\nsecond line'],
];

describe('Admin stored text through authenticated writes and real database reads', () => {
  it.each(payloads)(`preserves %s in profile, report, database and admin JSON${browserSuffix}`, async (_label, payload) => {
    const firstName = `First ${payload}`;
    const lastName = `Last ${payload}`;
    const message = `Message ${payload}`;
    const screen = `Screen ${payload}`;

    const profile = await request(server)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: `  ${firstName}  `, lastName: `  ${lastName}  ` })
      .expect(200);
    expect(profile.body.user).toMatchObject({ id: userId, firstName, lastName });

    const write = await request(server)
      .post('/api/native/bug-reports')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: `  ${message}  `, screen })
      .expect(200);
    expect(write.body.success).toBe(true);
    const reportId = write.body.data.id;

    // Direct SQL assertions prevent a mocked/echoed HTTP response from passing.
    expect(sqlite.prepare('SELECT first_name, last_name FROM native_users WHERE id = ?').get(userId))
      .toEqual({ first_name: firstName, last_name: lastName });
    expect(sqlite.prepare('SELECT user_id, message, screen, status FROM native_bug_reports WHERE id = ?').get(reportId))
      .toEqual({ user_id: userId, message, screen, status: 'new' });

    const users = await request(server)
      .get('/admin/api/users?limit=30&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(users.body.total).toBe(1);
    expect(users.body.users).toHaveLength(1);
    expect(users.body.users[0]).toMatchObject({ id: userId, email: TEST_EMAIL, firstName, lastName });

    const reports = await request(server)
      .get('/admin/api/bug-reports?limit=30&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reports.body.total).toBe(1);
    expect(reports.body.reports).toHaveLength(1);
    expect(reports.body.reports[0]).toMatchObject({
      id: reportId,
      name: `${firstName} ${lastName}`,
      email: TEST_EMAIL,
      message,
      screen,
      status: 'new',
    });
    await checkStoredContentInBrowser({
      userName: `${firstName} ${lastName}`, email: TEST_EMAIL,
      reportName: `${firstName} ${lastName}`, message, screen,
    });
  });

  it(`returns legacy email text literally when a report author has no name${browserSuffix}`, async () => {
    // Explicit legacy fixture boundary: this is not an email registration or
    // email-edit validation test. Profile PUT and report POST remain real.
    const legacyEmail = '<b data-h01="email">author@example.test</b>';
    sqlite.prepare('UPDATE native_users SET email = ? WHERE id = ?').run(legacyEmail, userId);
    await request(server)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: '', lastName: '' })
      .expect(200);
    await request(server)
      .post('/api/native/bug-reports')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Literal email fallback' })
      .expect(200);

    const users = await request(server)
      .get('/admin/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(users.body.users[0].email).toBe(legacyEmail);
    const reports = await request(server)
      .get('/admin/api/bug-reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reports.body.reports[0]).toMatchObject({
      name: legacyEmail,
      email: legacyEmail,
      message: 'Literal email fallback',
      screen: null,
    });
    await checkStoredContentInBrowser({
      userName: ' ', email: legacyEmail, reportName: legacyEmail,
      message: 'Literal email fallback', screen: null,
    });
  });

  it('requires user authentication for writes and admin authentication for reads', async () => {
    await request(server).put('/api/auth/me').send({ firstName: '<b>unauthorized</b>' }).expect(401);
    await request(server).post('/api/native/bug-reports').send({ message: '<b>unauthorized</b>' }).expect(401);
    expect(sqlite.prepare('SELECT first_name FROM native_users WHERE id = ?').get(userId).first_name).toBe('Original');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM native_bug_reports').get().count).toBe(0);

    for (const path of ['/admin/api/users', '/admin/api/bug-reports']) {
      await request(server).get(path).expect(401);
      await request(server).get(path).set('Authorization', `Bearer ${accessToken}`).expect(401);
    }
  });
});
