import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';
import { generateAdminPageHTML } from '../../routes/admin/dashboardPage.js';
import { securityHeaders } from '../../middleware/securityHeaders.js';

// This fixture never imports server.js, .env or the database. It serves the real
// admin document/assets with synthetic API responses in an isolated browser.
const html = '<img data-xss-probe src="/xss-probe" onerror="window.__xss = 1">';
const svg = '<svg data-xss-probe onload="window.__xss = 2"></svg>\'"&<>';
const link = '<a data-xss-probe href="javascript:window.__xss=3">mail@example.test</a>';
const escaped = '&lt;img src=x onerror=alert(1)&gt;';
const user = { id: 1, firstName: html, lastName: svg, email: link,
  createdAt: '2026-09-01T12:00:00Z', lastLoginAt: null };
const report = { id: '1);window.__xss=4;//', name: html, message: html + '\n' + escaped,
  screen: svg, status: 'new" onclick="window.__xss=5', createdAt: user.createdAt };
let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
});
after(async () => { await browser?.close(); });

async function fixture(t, { csp = true, payload = false, signedIn = true } = {}) {
  const state = { empty: false, unauthorized: false, requests: [], statuses: new Map() };
  const stats = payload ? {
    users: { total: html, newThisWeek: svg, newThisMonth: link },
    churn: { users: { rate: html, inactiveLast30Days: svg } },
    usage: { projects: html, rehearsals: link },
  } : {
    users: { total: 61, newThisWeek: 3, newThisMonth: 5 },
    churn: { users: { rate: 10, inactiveLast30Days: 6 } },
    usage: { projects: 2, rehearsals: 4 },
  };
  const users = payload ? [user] : Array.from({ length: 61 }, (_, i) => ({
    ...user, id: i + 1, firstName: 'User', lastName: String(i + 1), email: `user${i + 1}@example.test`,
  }));
  const reports = payload ? [report] : Array.from({ length: 61 }, (_, i) => ({
    ...report, id: i + 1, name: `User ${i + 1}`, message: `Report ${i + 1}`,
    screen: null, status: 'new',
  }));
  const app = express();
  if (csp) app.use(securityHeaders);
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../../public', import.meta.url))));
  app.get(['/admin', '/admin/'], (_req, res) => res.type('html').send(generateAdminPageHTML()));
  app.get('/nonce-check', (_req, res) => res.type('html').send(
    `<script nonce="${res.locals.cspNonce}">window.allowedScript = true</script>` +
    '<script>window.blockedScript = true</script>',
  ));
  app.post('/admin/api/login', (req, res) => {
    if (req.body.password === 'synthetic-password') return res.json({ token: 'synthetic-admin-token' });
    res.status(401).json({ error: html });
  });
  app.use('/admin/api', (req, res, next) => {
    state.requests.push({ method: req.method, path: req.originalUrl, body: req.body,
      authorized: req.headers.authorization === 'Bearer synthetic-admin-token' });
    if (state.unauthorized || req.headers.authorization !== 'Bearer synthetic-admin-token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });
  app.get('/admin/api/stats', (_req, res) => res.json(stats));
  app.get('/admin/api/users', (req, res) => {
    const all = state.empty ? [] : users;
    const offset = Number(req.query.offset);
    res.json({ users: all.slice(offset, offset + 30), total: all.length });
  });
  app.get('/admin/api/bug-reports', (req, res) => {
    const all = state.empty ? [] : reports;
    const offset = Number(req.query.offset);
    res.json({ reports: all.slice(offset, offset + 30).map(r => ({
      ...r, status: state.statuses.get(String(r.id)) || r.status,
    })), total: all.length });
  });
  app.patch('/admin/api/bug-reports/:id/status', (req, res) => {
    state.statuses.set(req.params.id, req.body.status);
    res.json({ success: true });
  });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const context = await browser.newContext();
  t.after(() => context.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const unexpectedRequests = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue();
    unexpectedRequests.push(route.request().url());
    return route.abort();
  });
  if (signedIn) await context.addInitScript(() => {
    // Seed once so reload also tests the existing storage path.
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('admin_token', 'synthetic-admin-token');
      sessionStorage.setItem('seeded', 'yes');
    }
  });
  await context.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.cspViolations.push(e.violatedDirective));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(base + '/admin');
  t.after(() => assert.deepEqual(unexpectedRequests, [], 'No requests may leave the test origin'));
  return { page, state, response, base, errors };
}

async function waitForDashboard(page) {
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#stats-loading').waitFor({ state: 'hidden' });
  await page.locator('#users-body tr td:nth-child(4)').first().waitFor();
  await page.locator('#bugs-body .status-btn').first().waitFor();
}

test('untrusted admin API values remain literal text, even without CSP', async t => {
  const { page, state, errors } = await fixture(t, { csp: false, payload: true });
  await waitForDashboard(page);
  // Checking only execution is insufficient: CSP could mask an unsafe HTML sink.
  assert.equal(await page.locator('[data-xss-probe]').count(), 0, 'API data created HTML elements');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#users-body td').nth(0).textContent(), `${html} ${svg}`);
  assert.equal(await page.locator('#users-body td').nth(1).textContent(), link);
  assert.equal(await page.locator('#bugs-body td').nth(0).textContent(), report.name);
  assert.equal(await page.locator('#bugs-body td').nth(1).textContent(), report.message);
  assert.equal(await page.locator('#bugs-body td').nth(2).textContent(), report.screen);
  assert.deepEqual(await page.locator('.card-value').allTextContents(), [html, `${html}%`, html, link]);
  assert.equal(await page.locator('[onclick], [onerror], [onload], script:not([src])').count(), 0);
  const patched = page.waitForResponse(r => r.request().method() === 'PATCH');
  await page.locator('#bugs-body').getByRole('button', { name: 'fixed', exact: true }).click();
  assert.equal((await patched).status(), 200);
  await page.locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.statuses.get(report.id), 'fixed', 'ID stays data in a closure and an encoded path segment');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(errors, []);
});

test('production CSP loads admin assets, blocks inline execution and preserves per-response nonces', async t => {
  const { page, response, base, errors } = await fixture(t, { payload: true });
  await waitForDashboard(page);
  const policy = response.headers()['content-security-policy'];
  assert.ok(policy);
  assert.ok(!policy.includes("'unsafe-inline'"));
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.equal(await page.locator('[data-xss-probe], [style], [onclick], script:not([src])').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  assert.deepEqual(errors, []);
  for (const [asset, mime] of [['dashboard.js', /javascript/], ['dashboard.css', /text\/css/]]) {
    const res = await page.request.get(base + '/admin/' + asset);
    assert.equal(res.status(), 200);
    assert.match(res.headers()['content-type'], mime);
    assert.equal(res.headers()['x-content-type-options'], 'nosniff');
  }
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(13, 17, 23)');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.injectedInline = true';
    document.body.append(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.injectedHandler = true');
    document.body.append(button);
    button.click();
  });
  await page.waitForFunction(() => window.cspViolations.length >= 2);
  assert.deepEqual(await page.evaluate(() => [window.injectedInline, window.injectedHandler]), [undefined, undefined]);
  const nonceResponse = await page.goto(base + '/nonce-check');
  assert.equal(await page.evaluate(() => window.allowedScript), true);
  assert.equal(await page.evaluate(() => window.blockedScript), undefined);
  const nonce = value => value.match(/'nonce-([^']+)'/)[1];
  assert.notEqual(nonce(nonceResponse.headers()['content-security-policy']), nonce(policy));
});

test('login, pagination, status, refresh, empty states and logout work under production CSP', async t => {
  const { page, state, errors } = await fixture(t, { signedIn: false });
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.locator('#login-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#login-error').textContent(), html);
  assert.equal(await page.locator('[data-xss-probe]').count(), 0);
  await page.locator('#password-input').fill('synthetic-password');
  await page.locator('#password-input').press('Enter');
  await waitForDashboard(page);
  assert.deepEqual(await page.locator('.card-value').allTextContents(), ['61', '10%', '2', '4']);
  if (process.env.ADMIN_BROWSER_SCREENSHOT) {
    await page.screenshot({ path: process.env.ADMIN_BROWSER_SCREENSHOT });
  }
  assert.equal(await page.locator('#users-body td').nth(3).textContent(), '-');
  assert.equal(await page.locator('#bugs-body td').nth(2).textContent(), '-');

  for (const [id, firstCell] of [['users', 'User'], ['bugs', 'User']]) {
    const pagination = page.locator('#' + id + '-pagination');
    const first = page.locator('#' + id + '-body tr').first().locator('td').first();
    assert.equal(await pagination.locator('.page-label').textContent(), 'Page 1 of 3');
    assert.equal(await pagination.getByRole('button', { name: 'Prev' }).count(), 0);
    for (const [pageNumber, firstId] of [[2, 31], [3, 61]]) {
      await pagination.getByRole('button', { name: 'Next' }).click();
      await page.waitForFunction(({ id, firstId }) =>
        document.querySelector('#' + id + '-body td').textContent === 'User ' + firstId, { id, firstId });
      assert.equal(await first.textContent(), `${firstCell} ${firstId}`);
      assert.equal(await pagination.locator('.page-label').textContent(), `Page ${pageNumber} of 3`);
    }
    assert.equal(await pagination.getByRole('button', { name: 'Next' }).count(), 0);
    await pagination.getByRole('button', { name: 'Prev' }).click();
    await page.waitForFunction(id => document.querySelector('#' + id + '-body td').textContent === 'User 31', id);
  }

  // The callback must keep the selected row's ID and retain the current page.
  for (const [label, status] of [['in progress', 'in_progress'], ['fixed', 'fixed'], ['new', 'new']]) {
    const row = page.locator('#bugs-body tr').first();
    await row.getByRole('button', { name: label, exact: true }).click();
    await row.locator('.status-btn-' + status + '.active').waitFor();
    assert.equal(state.statuses.get('31'), status);
    assert.equal(await page.locator('#bugs-pagination .page-label').textContent(), 'Page 2 of 3');
  }
  const patches = state.requests.filter(r => r.method === 'PATCH');
  assert.deepEqual(patches.map(r => [r.path, r.body.status]), [
    ['/admin/api/bug-reports/31/status', 'in_progress'],
    ['/admin/api/bug-reports/31/status', 'fixed'],
    ['/admin/api/bug-reports/31/status', 'new'],
  ]);
  assert.ok(state.requests.every(r => r.authorized));

  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#users-body td').textContent === 'User 1'
    && document.querySelector('#bugs-body td').textContent === 'User 1');
  await page.reload();
  await waitForDashboard(page);
  state.empty = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('No users', { exact: true }).waitFor();
  await page.getByText('No bug reports', { exact: true }).waitFor();
  assert.deepEqual(await page.locator('#users-pagination, #bugs-pagination').allTextContents(), ['', '']);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null);
  await page.reload();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#dashboard').isVisible(), false);
  state.empty = false;
  await page.locator('#password-input').fill('synthetic-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await waitForDashboard(page);
  const beforePatch = state.requests.filter(r => r.method === 'PATCH').length;
  await page.locator('#bugs-body tr').first().getByRole('button', { name: 'fixed', exact: true }).press('Enter');
  await page.locator('#bugs-body tr').first().locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.requests.filter(r => r.method === 'PATCH').length, beforePatch + 1);
  assert.equal(state.statuses.get('1'), 'fixed');
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  assert.deepEqual(errors, []);
});

test('401 returns to login and removes the stored credential', async t => {
  const { page, state, errors } = await fixture(t);
  await waitForDashboard(page);
  state.unauthorized = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null);
  assert.equal(await page.locator('#dashboard').isVisible(), false);
  assert.deepEqual(errors, []);
});
