import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';
import { generateAdminPageHTML } from '../../routes/admin/dashboardPage.js';
import { securityHeaders } from '../../middleware/securityHeaders.js';

// Faults are injected at the HTTP boundary. The page, assets, CSP and all user
// interactions are real. No database, server.js, environment loader or remote
// services are involved, and every browser context begins at the login screen.
const PASSWORD = 'h04-fixture-password';
const TOKEN = 'h04-synthetic-admin-token';
const date = '2026-09-01T12:00:00Z';
const attack = '<img data-h04-probe src="/probe" onerror="window.__h04Xss=1">';
const endpoints = { login: 'login', stats: 'stats', users: 'users', bugs: 'bug-reports' };
let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
});
after(async () => { await browser?.close(); });

function deferred(outcome = {}) {
  let release;
  let received;
  const gate = new Promise(resolve => { release = resolve; });
  const arrival = new Promise(resolve => { received = resolve; });
  return { ...outcome, gate, release, arrival, received };
}

async function fixture(t, { plans = {}, ignoreAbort = false } = {}) {
  const state = { label: 'Original', statuses: new Map(), requests: [], queues: new Map(), held: [] };
  state.enqueue = (key, outcome) => {
    if (!state.queues.has(key)) state.queues.set(key, []);
    state.queues.get(key).push(outcome);
    if (outcome.gate) state.held.push(outcome);
  };
  state.count = key => state.requests.filter(request => request.key === key).length;
  for (const [key, outcomes] of Object.entries(plans)) outcomes.forEach(outcome => state.enqueue(key, outcome));
  const app = express();
  app.use(securityHeaders);
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../../public', import.meta.url))));
  app.get(['/admin', '/admin/'], (_req, res) => res.type('html').send(generateAdminPageHTML()));

  function reply(key, body) {
    return async (req, res) => {
      const plan = state.queues.get(key)?.shift() || {};
      state.requests.push({ key, method: req.method, path: req.originalUrl, body: req.body,
        authorized: req.headers.authorization === `Bearer ${TOKEN}` });
      if (key !== 'login' && req.headers.authorization !== `Bearer ${TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Compute the normal reply at request time, so delayed responses retain
      // the old snapshot even when the fixture advances to a new session.
      const normal = body(req);
      if (key === 'patch' && (plan.commit || !Object.keys(plan).length)) {
        state.statuses.set(String(req.params.id), req.body.status);
      }
      plan.received?.();
      if (plan.gate) await plan.gate;
      if (plan.abort) {
        // Once response bytes arrive Chromium must surface the lost body,
        // rather than transparently retrying an idempotent GET on a new socket.
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100' });
        res.write('{');
        setImmediate(() => res.destroy());
        return;
      }
      res.status(plan.status ?? 200);
      if (plan.raw !== undefined) return res.type(plan.contentType || 'application/json').send(plan.raw);
      return res.json(plan.body === undefined ? normal : plan.body);
    };
  }
  app.post('/admin/api/login', reply('login', req =>
    req.body.password === PASSWORD ? { token: TOKEN } : { error: 'Wrong password' }));
  app.get('/admin/api/stats', reply('stats', () => ({
    users: { total: state.label === 'Original' ? 61 : 99, newThisWeek: 3, newThisMonth: 5 },
    churn: { users: { rate: 10, inactiveLast30Days: 6 } },
    usage: { projects: 2, rehearsals: 4 },
  })));
  app.get('/admin/api/users', reply('users', req => {
    const offset = Number(req.query.offset);
    return { total: 61, users: Array.from({ length: 61 }, (_, i) => ({
      id: i + 1, firstName: state.label + ' User', lastName: String(i + 1),
      email: `user${i + 1}@example.test`, createdAt: date, lastLoginAt: null,
    })).slice(offset, offset + 30) };
  }));
  app.get('/admin/api/bug-reports', reply('bugs', req => {
    const offset = Number(req.query.offset);
    return { total: 61, reports: Array.from({ length: 61 }, (_, i) => ({
      id: i + 1, name: `${state.label} Reporter ${i + 1}`, message: `${state.label} Report ${i + 1}`,
      screen: null, status: state.statuses.get(String(i + 1)) || 'new', createdAt: date,
    })).slice(offset, offset + 30) };
  }));
  app.patch('/admin/api/bug-reports/:id/status', reply('patch', () => ({ success: true })));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const external = [];
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      external.push(request.url());
      return route.abort();
    }
    const key = request.method() === 'PATCH' ? 'patch'
      : Object.keys(endpoints).find(name => url.pathname === '/admin/api/' + endpoints[name]);
    if (state.queues.get(key)?.[0]?.networkAbort) {
      // A true pre-response network failure. Ordinary replies and committed
      // writes still use the real loopback HTTP handlers above.
      state.queues.get(key).shift();
      state.requests.push({ key, method: request.method(), path: url.pathname + url.search,
        body: request.postDataJSON(), authorized: request.headers().authorization === `Bearer ${TOKEN}` });
      return route.abort('internetdisconnected');
    }
    return route.continue();
  });
  await context.addInitScript(({ ignoreAbort }) => {
    window.h04CspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.h04CspViolations.push(event.violatedDirective));
    if (ignoreAbort) {
      // Model an HTTP response that escapes cancellation. Business functions
      // and UI events are untouched; this exercises sequence/session guards.
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, options) => nativeFetch(input, { ...options, signal: undefined });
    }
  }, { ignoreAbort });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  t.after(async () => {
    state.held.forEach(plan => plan.release());
    const violations = await page.evaluate(() => window.h04CspViolations);
    const injected = await page.locator('[data-h04-probe]').count();
    const executed = await page.evaluate(() => window.__h04Xss);
    await context.close();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.deepEqual(external, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(violations, []);
    assert.equal(injected, 0, 'An error response must not create HTML elements');
    assert.equal(executed, undefined, 'An error response must not execute');
  });
  const response = await page.goto(base + '/admin');
  const policy = response.headers()['content-security-policy'];
  assert.match(policy, /script-src-attr 'none'/);
  assert.ok(!policy.includes("'unsafe-inline'") && !policy.includes("'unsafe-eval'"));
  assert.equal(await page.locator('#login-screen').isVisible(), true);
  return { page, state, context };
}

async function login(page) {
  await page.locator('#password-input').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
}

async function loaded(page) {
  await page.locator('#stats-loading').waitFor({ state: 'hidden' });
  await page.locator('#users-body tr td:nth-child(4)').first().waitFor();
  await page.locator('#bugs-body .status-btn').first().waitFor();
}

function nextResponse(page, key) {
  return page.waitForResponse(response => key === 'patch'
    ? response.request().method() === 'PATCH'
    : new URL(response.url()).pathname === '/admin/api/' + endpoints[key]);
}

async function sectionError(page, section) {
  const error = page.locator(`#${section}-error`);
  await error.waitFor({ state: 'visible' });
  assert.equal(await page.locator(`#${section}-loading`).isVisible(), false);
  assert.equal(await page.locator(`#${section}-section .loading:visible`).count(), 0);
  assert.equal(await error.getByRole('button', { name: 'Retry', exact: true }).isVisible(), true);
  return error;
}

async function retrySection(page, section) {
  const response = nextResponse(page, section);
  await page.locator(`#${section}-error`).getByRole('button', { name: 'Retry', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.locator(`#${section}-error`).waitFor({ state: 'hidden' });
  await page.locator(`#${section}-loading`).waitFor({ state: 'hidden' });
}

async function snapshot(page, section) {
  return section === 'stats'
    ? page.locator('#stats-cards .card-value').allTextContents()
    : page.locator(`#${section}-body tr`).allTextContents();
}

async function settleResponse(response) {
  await response.finished();
  // Let a fulfilled fetch's JSON and DOM microtasks finish before asserting
  // that an old response had no effect. No app function is exposed or called.
  await new Promise(resolve => setTimeout(resolve, 50));
}

async function assertSessionCleared(page) {
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#dashboard').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null);
  assert.equal(await page.locator('#stats-cards .card-value, #bugs-body .status-btn').count(), 0);
  assert.doesNotMatch(await page.locator('#users-body, #bugs-body').allTextContents().then(values => values.join(' ')), /Original|New Session/);
}

test('initial GET 500 stops loading and offers a visible section error and retry', async t => {
  const { page, state } = await fixture(t, { plans: { stats: [{ status: 500, body: { error: 'Temporary failure' } }] } });
  const failed = page.waitForResponse(response => response.url().endsWith('/admin/api/stats') && response.status() === 500);
  await login(page);
  await failed;
  await page.locator('#stats-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stats-loading').isVisible(), false);
  assert.equal(await page.locator('#stats-error').getByRole('button', { name: 'Retry', exact: true }).isVisible(), true);
  assert.equal(state.count('stats'), 1, 'GET errors must not spin in an automatic retry loop');
});

test('failed PATCH reports an unconfirmed change and does not silently reload reports', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  state.enqueue('patch', { status: 500, body: { error: 'Temporary failure' } });
  const reads = state.count('bugs');
  const failed = page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 500);
  await page.locator('#bugs-body tr').first().getByRole('button', { name: 'fixed', exact: true }).click();
  await failed;
  await page.locator('#bugs-mutation-status[role="alert"]').waitFor({ state: 'visible' });
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /confirm|unknown|uncertain/i);
  assert.equal(await page.locator('#bugs-body tr').first().locator('.status-btn-new.active').count(), 1);
  assert.equal(state.count('bugs'), reads, 'A failed PATCH must not trigger an automatic GET');
  assert.equal(state.count('patch'), 1);
});

test('each section recovers from an initial failure through its own Retry button', async t => {
  for (const section of ['stats', 'users', 'bugs']) {
    const { page, state } = await fixture(t, { plans: { [section]: [{ status: 500, body: { error: attack } }] } });
    await login(page);
    await sectionError(page, section);
    for (const other of ['stats', 'users', 'bugs'].filter(value => value !== section)) {
      await page.locator(`#${other}-loading`).waitFor({ state: 'hidden' });
      assert.equal(await page.locator(`#${other}-error`).isVisible(), false);
    }
    const before = Object.fromEntries(['stats', 'users', 'bugs'].map(key => [key, state.count(key)]));
    await retrySection(page, section);
    await loaded(page);
    assert.equal(state.count(section), before[section] + 1);
    for (const other of Object.keys(before).filter(value => value !== section)) assert.equal(state.count(other), before[other]);
  }
});

test('network, non-JSON, invalid JSON and malformed successful GET responses show retryable errors', async t => {
  for (const outcome of [
    { networkAbort: true },
    { abort: true },
    { status: 503, contentType: 'text/html', raw: '<h1>Service unavailable</h1>' },
    { status: 200, raw: '{"users":' },
    { status: 200, body: { error: attack } },
  ]) {
    const { page, state } = await fixture(t, { plans: { stats: [outcome] } });
    await login(page);
    await sectionError(page, 'stats');
    assert.equal(state.count('stats'), 1);
    assert.equal(await page.locator('#stats-cards .card-value').count(), 0);
    await retrySection(page, 'stats');
    assert.deepEqual(await page.locator('#stats-cards .card-value').allTextContents(), ['61', '10%', '2', '4']);
  }
});

test('failed refresh preserves each confirmed section, labels it stale and retries only that section', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  for (const section of ['stats', 'users', 'bugs']) {
    const previous = await snapshot(page, section);
    state.enqueue(section, { status: 500, body: { error: attack } });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await sectionError(page, section);
    assert.deepEqual(await snapshot(page, section), previous);
    assert.match(await page.locator(`#${section}-section`).textContent(), /previously|out of date|stale/i);
    if (section === 'stats' && process.env.ADMIN_FAILURES_SCREENSHOT) {
      await page.screenshot({ path: process.env.ADMIN_FAILURES_SCREENSHOT });
    }
    const counts = Object.fromEntries(['stats', 'users', 'bugs'].map(key => [key, state.count(key)]));
    await retrySection(page, section);
    assert.equal(state.count(section), counts[section] + 1);
    for (const other of Object.keys(counts).filter(value => value !== section)) assert.equal(state.count(other), counts[other]);
  }
});

test('failed users and reports pagination retain the confirmed page and Retry targets the failed offset', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  for (const section of ['users', 'bugs']) {
    const previous = await snapshot(page, section);
    state.enqueue(section, { status: 500, body: { error: 'Temporary failure' } });
    await page.locator(`#${section}-pagination`).getByRole('button', { name: 'Next', exact: true }).click();
    await sectionError(page, section);
    assert.deepEqual(await snapshot(page, section), previous);
    assert.equal(await page.locator(`#${section}-pagination .page-label`).textContent(), 'Page 1 of 3');
    await retrySection(page, section);
    assert.equal(await page.locator(`#${section}-pagination .page-label`).textContent(), 'Page 2 of 3');
    assert.match(await page.locator(`#${section}-body tr`).first().textContent(), /(?:User|Reporter) 31/);
    const paths = state.requests.filter(request => request.key === section).slice(-2).map(request => request.path);
    assert.ok(paths.every(path => new URL(path, 'http://fixture.test').searchParams.get('offset') === '30'));
  }
});

test('late pagination responses cannot overwrite a newer Refresh even when cancellation is ineffective', async t => {
  for (const section of ['users', 'bugs']) {
    const { page, state } = await fixture(t, { ignoreAbort: true });
    await login(page);
    await loaded(page);
    const old = deferred();
    state.enqueue(section, old);
    await page.locator(`#${section}-pagination`).getByRole('button', { name: 'Next', exact: true }).click();
    await old.arrival;
    state.label = 'New Session';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.locator(`#${section}-body tr`).first().getByText(new RegExp('New Session (?:User|Reporter) 1$')).waitFor();
    const late = nextResponse(page, section);
    old.release();
    await settleResponse(await late);
    assert.match(await page.locator(`#${section}-body tr`).first().textContent(), /New Session (?:User|Reporter) 1/);
    assert.equal(await page.locator(`#${section}-pagination .page-label`).textContent(), 'Page 1 of 3');
    assert.equal(await page.locator(`#${section}-error`).isVisible(), false);
  }
});

test('PATCH transport, HTTP, JSON and acknowledgement failures retain the confirmed status without retrying', async t => {
  for (const outcome of [
    { networkAbort: true },
    { abort: true },
    { status: 503, contentType: 'text/html', raw: '<h1>Service unavailable</h1>' },
    { status: 200, raw: '{"success":' },
    { status: 200, body: { error: attack } },
    { status: 200, body: { success: false } },
  ]) {
    const { page, state } = await fixture(t);
    await login(page);
    await loaded(page);
    state.enqueue('patch', outcome);
    const reads = state.count('bugs');
    const row = page.locator('#bugs-body tr').first();
    await row.getByRole('button', { name: 'fixed', exact: true }).click();
    await page.locator('#bugs-mutation-status[role="alert"]').waitFor({ state: 'visible' });
    assert.match(await page.locator('#bugs-mutation-status').textContent(), /confirm|unknown|uncertain/i);
    assert.equal(await row.locator('.status-btn-new.active').count(), 1);
    assert.equal(await row.locator('.status-btn-fixed.active').count(), 0);
    assert.equal(state.count('patch'), 1);
    assert.equal(state.count('bugs'), reads);
  }
});

test('a pending PATCH disables its row and commits the status only after a successful acknowledgement', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  const pending = deferred({ commit: true, body: { success: true } });
  state.enqueue('patch', pending);
  const row = page.locator('#bugs-body tr').first();
  await row.getByRole('button', { name: 'fixed', exact: true }).click();
  await pending.arrival;
  for (const button of await row.locator('.status-btn').all()) assert.equal(await button.isDisabled(), true);
  assert.equal(await row.locator('.status-btn-new.active').count(), 1);
  assert.equal(await row.locator('.status-btn-fixed.active').count(), 0);
  await row.getByRole('button', { name: 'in progress', exact: true }).press('Enter');
  assert.equal(state.count('patch'), 1, 'Keyboard input cannot submit a second pending mutation');
  pending.release();
  await row.locator('.status-btn-fixed.active').waitFor();
  for (const button of await row.locator('.status-btn').all()) assert.equal(await button.isDisabled(), false);
  assert.equal(state.statuses.get('1'), 'fixed');
  assert.equal(state.count('patch'), 1);
});

test('a committed PATCH with a lost response stays unconfirmed until an explicit report reload', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  state.enqueue('patch', { commit: true, abort: true });
  const reads = state.count('bugs');
  const row = page.locator('#bugs-body tr').first();
  await row.getByRole('button', { name: 'fixed', exact: true }).click();
  await page.locator('#bugs-mutation-status[role="alert"]').waitFor({ state: 'visible' });
  assert.equal(state.statuses.get('1'), 'fixed', 'The HTTP fixture models an already committed write');
  assert.equal(await row.locator('.status-btn-new.active').count(), 1);
  assert.equal(state.count('bugs'), reads);
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /confirm|unknown|uncertain/i);
  if (process.env.ADMIN_MUTATION_SCREENSHOT) await page.screenshot({ path: process.env.ADMIN_MUTATION_SCREENSHOT });
  await page.locator('#bugs-mutation-status').getByRole('button', { name: 'Reload reports', exact: true }).click();
  await row.locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.count('bugs'), reads + 1);
  assert.equal(state.count('patch'), 1, 'Reconciliation is a read, never an automatic write retry');
});

test('an acknowledged PATCH followed by a failed GET reports saved status and a stale list separately', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  state.enqueue('bugs', { status: 500, body: { error: 'Temporary list failure' } });
  const row = page.locator('#bugs-body tr').first();
  await row.getByRole('button', { name: 'fixed', exact: true }).click();
  await sectionError(page, 'bugs');
  assert.equal(state.statuses.get('1'), 'fixed');
  assert.equal(await row.locator('.status-btn-new.active').count(), 1, 'The retained list still shows its last confirmed read');
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /saved/i);
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /refresh|out of date|stale/i);
  await page.locator('#bugs-mutation-status').getByRole('button', { name: 'Reload reports', exact: true }).click();
  await row.locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.count('patch'), 1);
});

test('current-session GET and PATCH 401 responses sign out and remove the old dashboard data', async t => {
  for (const key of ['stats', 'patch']) {
    const { page, state } = await fixture(t);
    await login(page);
    await loaded(page);
    state.enqueue(key, { status: 401, body: { error: 'Unauthorized' } });
    if (key === 'stats') await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    else await page.locator('#bugs-body tr').first().getByRole('button', { name: 'fixed', exact: true }).click();
    await assertSessionCleared(page);
  }
});

test('late prior-session GET success cannot repopulate data after logout and a new login with the same token', async t => {
  const { page, state } = await fixture(t, { ignoreAbort: true });
  await login(page);
  await loaded(page);
  const old = deferred();
  state.enqueue('users', old);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await old.arrival;
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await assertSessionCleared(page);
  state.label = 'New Session';
  await login(page);
  await page.locator('#users-body').getByText('New Session User 1', { exact: true }).waitFor();
  const late = nextResponse(page, 'users');
  old.release();
  await settleResponse(await late);
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), TOKEN);
  assert.equal(await page.locator('#dashboard').isVisible(), true);
  assert.equal(await page.locator('#users-body').getByText('Original User 1', { exact: true }).count(), 0);
  assert.equal(await page.locator('#users-body').getByText('New Session User 1', { exact: true }).count(), 1);
});

test('late prior-session 401 cannot clear a new login even when it reuses the identical token', async t => {
  const { page, state } = await fixture(t, { ignoreAbort: true });
  await login(page);
  await loaded(page);
  const old = deferred({ status: 401, body: { error: 'Expired old request' } });
  state.enqueue('stats', old);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await old.arrival;
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await assertSessionCleared(page);
  state.label = 'New Session';
  await login(page);
  await loaded(page);
  const late = nextResponse(page, 'stats');
  old.release();
  await settleResponse(await late);
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), TOKEN);
  assert.equal(await page.locator('#dashboard').isVisible(), true);
  assert.deepEqual(await page.locator('#stats-cards .card-value').allTextContents(), ['99', '10%', '2', '4']);
});

test('a late prior-session PATCH acknowledgement cannot start a refresh in the new session', async t => {
  const { page, state } = await fixture(t, { ignoreAbort: true });
  await login(page);
  await loaded(page);
  const old = deferred({ commit: true, body: { success: true } });
  state.enqueue('patch', old);
  await page.locator('#bugs-body tr').first().getByRole('button', { name: 'fixed', exact: true }).click();
  await old.arrival;
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await assertSessionCleared(page);
  state.label = 'New Session';
  state.statuses.clear();
  await login(page);
  await loaded(page);
  const reads = state.count('bugs');
  const late = nextResponse(page, 'patch');
  old.release();
  await settleResponse(await late);
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), TOKEN);
  assert.match(await page.locator('#bugs-body tr').first().textContent(), /New Session Reporter 1/);
  assert.equal(await page.locator('#bugs-body tr').first().locator('.status-btn-new.active').count(), 1);
  assert.equal(state.count('bugs'), reads);
  assert.equal(await page.locator('#bugs-mutation-status').isVisible(), false);
});

test('reading another reports page cannot resolve an unconfirmed write to a row absent from that page', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  state.enqueue('patch', { commit: true, abort: true });
  await page.locator('#bugs-body tr').first().getByRole('button', { name: 'fixed', exact: true }).click();
  await page.locator('#bugs-mutation-status[role="alert"]').waitFor({ state: 'visible' });
  await page.locator('#bugs-pagination').getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#bugs-body').getByText('Original Reporter 31', { exact: true }).waitFor();
  assert.equal(await page.locator('#bugs-pagination .page-label').textContent(), 'Page 2 of 3');
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /Report 1:.*(?:confirm|unknown|uncertain)/i);
  assert.equal(await page.locator('#bugs-mutation-status').getByRole('button', { name: 'Reload reports', exact: true }).isVisible(), true);
  await page.locator('#bugs-pagination').getByRole('button', { name: 'Prev', exact: true }).click();
  await page.locator('#bugs-body').getByText('Original Reporter 1', { exact: true }).waitFor();
  await page.locator('#bugs-body tr').first().locator('.status-btn-fixed.active').waitFor();
  assert.equal(await page.locator('#bugs-mutation-status').isVisible(), false, 'Only the matching returned row reconciles the unknown result');
  assert.equal(state.count('patch'), 1);
});

test('completed success feedback does not accumulate across subsequent writes or reads', async t => {
  const { page, state } = await fixture(t);
  await login(page);
  await loaded(page);
  await page.locator('#bugs-body tr').nth(0).getByRole('button', { name: 'fixed', exact: true }).click();
  await page.locator('#bugs-body tr').nth(0).locator('.status-btn-fixed.active').waitFor();
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /Report 1: Status saved\./);

  const second = deferred({ commit: true, body: { success: true } });
  state.enqueue('patch', second);
  await page.locator('#bugs-body tr').nth(1).getByRole('button', { name: 'fixed', exact: true }).click();
  await second.arrival;
  assert.doesNotMatch(await page.locator('#bugs-mutation-status').textContent(), /Report 1:/);
  assert.match(await page.locator('#bugs-mutation-status').textContent(), /Report 2: Saving/);
  assert.equal(await page.locator('#bugs-mutation-status p').count(), 1);
  second.release();
  await page.locator('#bugs-body tr').nth(1).locator('.status-btn-fixed.active').waitFor();
  assert.equal(await page.locator('#bugs-mutation-status p').count(), 1);
  const refreshed = nextResponse(page, 'bugs');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await settleResponse(await refreshed);
  assert.equal(await page.locator('#bugs-mutation-status').isVisible(), false);
  assert.equal(await page.locator('#bugs-body .status-btn-fixed.active').count(), 2);
});

test('real cross-tab logout and login clear old data while preserving the new shared session and ignoring old replies', async t => {
  const { page, state, context } = await fixture(t, { ignoreAbort: true });
  await login(page);
  await loaded(page);
  const otherPage = await context.newPage();
  otherPage.setDefaultTimeout(5000);
  const otherErrors = [];
  otherPage.on('pageerror', error => otherErrors.push(error.message));
  await otherPage.goto(page.url());
  await otherPage.locator('#dashboard').waitFor({ state: 'visible' });
  await loaded(otherPage);

  const oldUsers = deferred();
  const oldStats = deferred({ status: 401, body: { error: 'Old request expired' } });
  state.enqueue('users', oldUsers);
  state.enqueue('stats', oldStats);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await Promise.all([oldUsers.arrival, oldStats.arrival]);
  await otherPage.getByRole('button', { name: 'Log out', exact: true }).click();
  await assertSessionCleared(otherPage);
  await assertSessionCleared(page);

  // No storage API is faked or manually dispatched: both storage events are
  // produced by real login/logout actions in the sibling browser page.
  state.label = 'New Session';
  await login(otherPage);
  await loaded(otherPage);
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await loaded(page);
  await page.locator('#users-body').getByText('New Session User 1', { exact: true }).waitFor();
  const lateUsers = nextResponse(page, 'users');
  const lateStats = nextResponse(page, 'stats');
  oldUsers.release();
  oldStats.release();
  await Promise.all([lateUsers, lateStats].map(async response => settleResponse(await response)));
  for (const currentPage of [page, otherPage]) {
    assert.equal(await currentPage.evaluate(() => localStorage.getItem('admin_token')), TOKEN);
    assert.equal(await currentPage.locator('#dashboard').isVisible(), true);
    assert.equal(await currentPage.locator('#users-body').getByText('Original User 1', { exact: true }).count(), 0);
    assert.equal(await currentPage.locator('#users-body').getByText('New Session User 1', { exact: true }).count(), 1);
    assert.deepEqual(await currentPage.locator('#stats-cards .card-value').allTextContents(), ['99', '10%', '2', '4']);
  }
  assert.equal(state.count('login'), 2, 'The second tab reuses the first login, then performs the new login through UI');
  assert.deepEqual(await otherPage.evaluate(() => window.h04CspViolations), []);
  assert.deepEqual(otherErrors, []);
});
