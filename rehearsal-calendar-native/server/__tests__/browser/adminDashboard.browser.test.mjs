import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import express from 'express';
import { chromium } from 'playwright';
import { generateAdminPageHTML } from '../../routes/admin/dashboardPage.js';
import { securityHeaders } from '../../middleware/securityHeaders.js';
import { closeOwnedBrowserFixture, trackOwnedHttpServer } from './ownedFixture.mjs';
import { quoteName } from '../../../shared/quoteName.cjs';

const NB = '\u00a0';

// This fixture never imports server.js, .env or the database. It serves the real
// admin document/assets with synthetic API responses in an isolated browser.
const html = '<img data-xss-probe src="/xss-probe" onerror="window.__xss = 1">';
const svg = '<svg data-xss-probe onload="window.__xss = 2"></svg>\'"&<>';
const link = '<a data-xss-probe href="javascript:window.__xss=3">mail@example.test</a>';
const escaped = '&lt;img src=x onerror=alert(1)&gt;';
const steps = { onboarding: true, projects: 1, roles: { owner: 0, admin: 0, member: 1 }, manualMarks: 2,
  marksUntil: '2026-12-09', calendarMarks: 0, calendar: false, device: true, seen: 1, onRoster: 2, rehearsals: 0 };
const user = { id: 1, firstName: html, lastName: svg, email: link,
  createdAt: '2026-09-01T12:00:00Z', lastLoginAt: null, service: false,
  source: { kind: 'invite', project: html, owner: svg }, signIn: ['apple'], locale: 'en', timezone: svg, steps,
  lastAppDay: '2026-11-24' };
const none = { opened: 0, of: 0, rate: null };
// Use of the app (T-294): with migration 016, or without it — "no data", not zeros.
const usageBody = (payload, recorded) => (recorded ? { recorded: true, since: '2026-11-02',
  active: { day: 1, week: 2, month: 3, of: 4 },
  retention: [{ week: '2026-11-16', registered: 2, day1: { opened: 1, of: 2, rate: 50 }, day7: none, day30: none }],
  builds: [{ build: 42, people: 1 }, { build: null, people: 2 }],
  invitations: [{ project: payload ? html : 'Hamlet', owner: payload ? svg : 'Olga O.', pageOpens: 6, appOpens: 3, joins: 2 }] }
  : { recorded: false });
const counts = { registered: 1, onboarding: 1, project: 1, calendar: 1, manual: 1, engaged: 0 };
const medians = { toProjectHours: 2, toProjectOf: 1, toCalendarHours: null, toCalendarOf: 0,
  toManualHours: null, toManualOf: 0 };
// The organiser funnel (T-427).
const organizerCounts = { registered: 1, project: 1, invite: 1, member: 0, threeMembers: 0, firstRehearsal: 0,
  secondRehearsal: 0 };
// Project, owner, language, zone and inbox type are stored text too (T-293).
const analyticsBody = (payload, recorded = true) => ({
  usage: usageBody(payload, recorded),
  period: 'all', from: null, to: '2026-11-25T12:00:00Z', people: 1,
  languages: payload ? [html] : ['en', 'ru'],
  funnel: { weeks: [{ week: '2026-11-16', invite: counts, other: { ...counts, registered: 0 } }],
    total: { invite: counts, other: { ...counts, registered: 0 } }, medians: { invite: medians, other: medians } },
  organizers: { weeks: [{ week: '2026-11-16', ...organizerCounts }], total: organizerCounts,
    median: { toFirstRehearsalHours: null, toFirstRehearsalOf: 0 } },
  sources: { byDay: [{ date: '2026-11-17', invite: 1, own: 0, none: 0 }], byWeek: [{ date: '2026-11-16', invite: 1, own: 0, none: 0 }],
    projects: [{ project: payload ? html : 'Hamlet', owner: payload ? svg : 'Olga O.', joined: 1, newcomers: 1 }],
    languages: [{ value: payload ? html : 'en', people: 1 }], timezones: [{ value: payload ? svg : 'UTC', people: 1 }] },
  projects: [{ id: 1, name: payload ? html : 'Hamlet', owner: payload ? link : 'Olga O.', createdAt: '2026-11-01T00:00:00Z',
    members: 3, rehearsals: 3, rehearsalsLastFourWeeks: 2, nextRehearsalAt: null,
    seenBeforeStart: { seen: 2, of: 4, rate: 50 }, coverage: { people: 2, of: 3, rate: 66.7 },
    calendar: { people: 1, of: 3, rate: 33.3 } }],
  notifications: { devices: { people: 1, of: 5, rate: 20 },
    inbox: [{ type: payload ? html : 'member_joined', created: 2, read: 1, readRate: 50, medianMinutesToRead: 30 }],
    emailCodes: [{ purpose: 'verify', created: 2, sent: 2, failed: 0, used: 1, replaced: 1, locked: 0 }] },
});
// The test cohort and the week before it (T-425), as /analytics?…&cohort=1 answers.
const cohortColumn = (from, to, registered, perDay = 0.3) => ({ from, to, days: 7, registered, perDay,
  onboarding: { count: 1, of: 2, rate: 50 }, project: { count: 1, of: 2, rate: 50 },
  // T-427: nobody created a project — 0 of 0; the test's own below.
  invite: { count: 0, of: 0, rate: null }, member: null, threeMembers: null, firstRehearsal: null, secondRehearsal: null, inProject: null,
  calendar: { count: 1, of: 2, rate: 50 }, manual: { count: 0, of: 2, rate: 0 }, day1: { count: 1, of: 2, rate: 50 }, day7: null });
// The test's per day is null: none of its days begun yet.
const cohortBody = { stepDays: 7, recorded: true,
  test: { ...cohortColumn('2026-11-10', '2026-11-16', 2, null), invite: { count: 1, of: 1, rate: 100 } },
  before: cohortColumn('2026-11-03', '2026-11-09', 2) };
const report = { id: '1);window.__xss=4;//', name: html, message: html + '\n' + escaped,
  screen: svg, status: 'new" onclick="window.__xss=5', createdAt: user.createdAt };
let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
}, { timeout: 30000 });
after(async () => { await browser?.close(); }, { timeout: 10000 });

async function fixture(t, { csp = true, payload = false, signedIn = true } = {}) {
  const diagnostic = stage => console.log(`[admin-browser] ${t.name}: ${stage}`);
  diagnostic('fixture: starting');
  const state = { empty: false, unauthorized: false, requests: [], statuses: new Map(), recorded: true };
  const stats = payload ? {
    users: { total: html, newThisWeek: svg, newThisMonth: link },
    signIns: { rate: html, notInLast30Days: svg },
    usage: { projects: html, rehearsals: link },
  } : {
    users: { total: 61, newThisWeek: 3, newThisMonth: 5 },
    signIns: { rate: 10, notInLast30Days: 6 },
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
  app.get('/admin/api/analytics', (req, res) => {
    if (state.refusal) return res.status(400).json(state.refusal);
    const body = analyticsBody(payload, state.recorded);
    res.json(req.query.cohort === '1' ? { ...body, cohort: cohortBody } : body);
  });
  app.get('/admin/api/users', (req, res) => {
    const all = state.empty ? [] : users;
    const offset = Number(req.query.offset);
    res.json({ users: all.slice(offset, offset + 30).map(row => (state.recorded ? row : { ...row, lastAppDay: null })),
      total: all.length, appDaysRecorded: state.recorded });
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
  const server = createServer(app);
  const owned = trackOwnedHttpServer(server);
  let context;
  t.after(() => closeOwnedBrowserFixture({ context, owned, diagnostic }), { timeout: 12000 });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context = await browser.newContext();
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
  diagnostic('fixture: document loaded');
  t.after(() => assert.deepEqual(unexpectedRequests, [], 'No requests may leave the test origin'));
  return { page, state, response, base, errors };
}

async function waitForDashboard(page) {
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#stats-loading').waitFor({ state: 'hidden' });
  await page.locator('#users-body tr td:nth-child(4)').first().waitFor();
  await page.locator('#bugs-body .status-btn').first().waitFor();
}

test('untrusted admin API values remain literal text, even without CSP', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t, { csp: false, payload: true });
  await waitForDashboard(page);
  // Checking only execution is insufficient: CSP could mask an unsafe HTML sink.
  assert.equal(await page.locator('[data-xss-probe]').count(), 0, 'API data created HTML elements');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#users-body td').nth(0).textContent(), `${html} ${svg}`);
  assert.equal(await page.locator('#users-body td').nth(1).textContent(), link);
  assert.equal(await page.locator('#users-body td').nth(4).textContent(), '24.11.2026');
  assert.equal(await page.locator('#users-body td').nth(5).textContent(), `Приглашение в ${quoteName(html, 'ru')} (владелец ${svg})`);
  assert.equal(await page.locator('#users-body td').nth(7).textContent(), `en / ${svg}`);
  // The analytics carry project, owner, language, zone and type names as text.
  await page.locator('#analytics-body .analytics-block').first().waitFor();
  const cells = await page.locator('#analytics-body td').allTextContents();
  for (const value of [html, svg, link]) assert.ok(cells.includes(value), `analytics shows ${value} literally`);
  assert.ok(await page.locator('#filter-lang option').evaluateAll((options, value) =>
    options.some(option => option.textContent === value), html));
  assert.equal(await page.locator('#bugs-body td').nth(0).textContent(), report.name);
  assert.equal(await page.locator('#bugs-body td').nth(1).textContent(), report.message);
  assert.equal(await page.locator('#bugs-body td').nth(2).textContent(), report.screen);
  assert.deepEqual(await page.locator('.card-value').allTextContents(), [html, `${html}${NB}%`, html, link]);
  assert.equal(await page.locator('[onclick], [onerror], [onload], script:not([src])').count(), 0);
  const patched = page.waitForResponse(r => r.request().method() === 'PATCH');
  await page.locator('#bugs-body').getByRole('button', { name: 'Исправлена', exact: true }).click();
  assert.equal((await patched).status(), 200);
  await page.locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.statuses.get(report.id), 'fixed', 'ID stays data in a closure and an encoded path segment');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(errors, []);
});

test('production CSP loads admin assets, blocks inline execution and preserves per-response nonces', { timeout: 30000 }, async t => {
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

// The figure counts sign-ins: a session renews itself without one, so a user
// who has not signed in for a month may be using the app every day. Its card
// says what it counts and what it does not, rather than "churn" (H03).
test('the sign-in figure is named for sign-ins, not churn or inactivity', { timeout: 30000 }, async t => {
  const { page, errors } = await fixture(t);
  await waitForDashboard(page);
  const figure = page.locator('#stats-cards .card').nth(1);
  assert.equal(await figure.locator('.card-label').textContent(), `Не входили 30${NB}дней`);
  assert.equal(await figure.locator('.card-value').textContent(), `10${NB}%`);
  const note = await figure.locator('.card-sub').textContent();
  assert.match(note, /^Пользователей: 6 /);
  assert.match(note, /не показатель использования/);
  const cards = (await page.locator('#stats-cards').textContent()).toLowerCase();
  assert.doesNotMatch(cards, /churn|inactive|отток|неактивн/);
  assert.deepEqual(errors, []);
});

// Use of the app (T-294): the figures with migration 016, and without it a
// sentence saying there is no data — never zeros, which would read as nobody.
test('use of the app shows its figures, or "no data" without migration 016', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t);
  await waitForDashboard(page);
  const block = page.locator('#analytics-body .analytics-block', { has: page.getByRole('heading', { name: 'Использование приложения' }) });
  await block.waitFor();
  assert.match(await block.locator('.metric').textContent(), /^Активных сегодня: 1 \(25\u00a0%\) · за 7\u00a0дней: 2 \(50\u00a0%\) · за 30\u00a0дней: 3 \(75\u00a0%\)$/);
  const cells = await block.locator('td').allTextContents();
  for (const value of ['16.11.2026', `1 из 2 (50${NB}%)`, '42', 'Не указана', 'Hamlet', 'Olga O.', '6', '3']) {
    assert.ok(cells.includes(value), `use of the app shows ${value}`);
  }
  assert.equal(await page.locator('#users-body td').nth(4).textContent(), '24.11.2026');

  state.recorded = false;
  const reloaded = page.waitForResponse(r => new URL(r.url()).pathname === '/admin/api/analytics');
  await page.getByRole('button', { name: 'Обновить' }).click();
  await reloaded;
  await page.waitForFunction(() => document.querySelector('#analytics-body')?.textContent.includes('Нет данных: миграция\u00a0016 не применена.'));
  assert.equal(await block.locator('td').count(), 0, 'no table of zeros');
  await page.waitForFunction(() => document.querySelectorAll('#users-body tr')[0]?.children[4]?.textContent === 'Нет данных: миграция\u00a0016 не применена');
  assert.deepEqual(errors, []);
});

// One period and one selection for every section; service accounts only when asked (T-293).
test('the filters reach every statistics request, and the service switch only the users table', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t);
  await waitForDashboard(page);
  await page.locator('#analytics-body .analytics-block').first().waitFor();
  const query = (name) => new URL(state.requests.filter(r => r.path.startsWith('/admin/api/' + name)).at(-1).path,
    'http://fixture.test').searchParams;
  for (const name of ['stats', 'analytics', 'users']) assert.equal(query(name).get('period'), 'all');
  const answered = (name, test) => page.waitForResponse(r => {
    const url = new URL(r.url());
    return url.pathname === '/admin/api/' + name && test(url.searchParams);
  });
  await page.locator('#filter-period').selectOption('30');
  await page.locator('#filter-lang').selectOption('ru');
  const all = ['stats', 'analytics', 'users'].map(name =>
    answered(name, params => params.get('source') === 'invite'));
  await page.locator('#filter-source').selectOption('invite');
  await Promise.all(all);
  for (const name of ['stats', 'analytics', 'users']) {
    const params = query(name);
    assert.deepEqual([params.get('period'), params.get('source'), params.get('lang')], ['30', 'invite', 'ru'], name);
  }
  assert.equal(query('users').get('service'), null);
  const shown = answered('users', params => params.get('service') === '1');
  await page.locator('#show-service').check();
  await shown;
  assert.equal(query('users').get('service'), '1');
  assert.equal(await page.locator('#filter-lang').inputValue(), 'ru', 'the chosen language survives a reload of the list');
  assert.deepEqual(errors, []);
});

// T-425: registration dates, and the test cohort, which fixes the source while on.
test('dates and the test cohort: the switch locks the source, wrong dates ask nothing, the choice survives a reload', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t);
  await waitForDashboard(page);
  await page.locator('#analytics-body .analytics-block').first().waitFor();
  const last = name => new URL(state.requests.filter(r => r.path.startsWith('/admin/api/' + name)).at(-1).path,
    'http://fixture.test').searchParams;
  const answered = (name, test) => page.waitForResponse(r => {
    const url = new URL(r.url());
    return url.pathname === '/admin/api/' + name && test(url.searchParams);
  });
  const filterError = page.locator('#filter-error');
  const source = page.locator('#filter-source');
  assert.equal(await page.locator('#filter-dates').isVisible(), false);
  await source.selectOption('invite');
  await answered('analytics', params => params.get('source') === 'invite');

  // Dates chosen, none filled: nothing is asked.
  const asked = state.requests.length;
  await page.locator('#filter-period').selectOption('dates');
  assert.equal(await page.locator('#filter-dates').isVisible(), true);
  assert.equal(await filterError.textContent(), 'Укажите обе даты.');
  assert.equal(await page.locator('#filter-dates-note').textContent(),
    `Дни${NB}— по${NB}UTC; первый и${NB}последний входят в${NB}период.`);
  await page.locator('#filter-cohort').check();
  assert.equal(await filterError.textContent(), 'Выберите даты теста.');
  assert.equal(await source.isDisabled(), true, 'the cohort fixes the source');
  assert.equal(await source.locator('option:checked').textContent(), 'Свой / без проекта');
  assert.match(await page.locator('#filter-cohort-note').textContent(), /^Все, кто зарегистрировался в эти даты/);
  await page.locator('#filter-from').fill('2026-11-16');
  await page.locator('#filter-to').fill('2026-11-10');
  assert.equal(await filterError.textContent(), 'Начальная дата позже конечной.');
  await page.locator('#filter-from').fill('2025-01-01');
  await page.locator('#filter-to').fill('2026-11-16');
  assert.equal(await filterError.textContent(), `Слишком длинный период: не больше 366${NB}дней.`);
  assert.equal(state.requests.length, asked, 'wrong dates are not sent');
  assert.equal(await page.locator('#analytics-stale').textContent(), 'Показаны прежние данные — возможно, они устарели.');

  // Good dates: every section asks for them and the cohort, never a source.
  const all = ['stats', 'analytics', 'users'].map(name => answered(name, params => params.get('from') === '2026-11-10'));
  await page.locator('#filter-from').fill('2026-11-10');
  await Promise.all(all);
  assert.equal(await filterError.isVisible(), false);
  for (const name of ['stats', 'analytics', 'users']) {
    const params = last(name);
    assert.deepEqual([params.get('period'), params.get('from'), params.get('to'), params.get('cohort'), params.get('source')],
      [null, '2026-11-10', '2026-11-16', '1', null], name);
  }
  const block = page.locator('#analytics-body .analytics-block').first();
  await block.getByRole('heading', { name: 'Тестовая когорта' }).waitFor();
  assert.deepEqual(await block.locator('th').allTextContents(), ['', 'Когорта (10.11–16.11)', `Неделя до${NB}теста (03.11–09.11)`]);
  const rows = await block.locator('tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(cell => cell.textContent)));
  assert.deepEqual(rows.slice(1).map(row => row[0]), ['Зарегистрировались', `В среднем за${NB}день`,
    `Онбординг (на${NB}текущий момент)`, `За${NB}первые 7${NB}дней после регистрации`, 'Создали проект',
    // T-427: the organiser's steps, in the order of the editor's list.
    'Приглашение открыли', 'Есть участник', `3${NB}участника и${NB}больше`, 'Первая репетиция', 'Вторая репетиция',
    'В проекте', 'Календарь подключён', 'Ручные отметки', `Открыли приложение на${NB}1-й${NB}день`,
    `Открыли приложение на${NB}7-й${NB}день`]);
  assert.deepEqual(rows[2], [`В среднем за${NB}день`, '', '0,3'], 'no day begun: empty, not 0 or "null"');
  assert.deepEqual(rows[5], ['Создали проект', `1 из 2 (50${NB}%)`, `1 из 2 (50${NB}%)`]);
  // Of those who created a project; nobody did in the week before: «—», not 0.
  assert.deepEqual(rows[6], ['Приглашение открыли', `1 из 1 (100${NB}%)`, '—']);
  assert.deepEqual(rows[7], ['Есть участник', '', '']);
  assert.deepEqual(rows[11], ['В проекте', '', ''], 'nobody\'s seven days are over: empty, not 0');
  assert.deepEqual(rows[12], ['Календарь подключён', `1 из 2 (50${NB}%)`, `1 из 2 (50${NB}%)`]);
  assert.deepEqual(rows[13], ['Ручные отметки', `0 из 2 (0${NB}%)`, `0 из 2 (0${NB}%)`]);
  assert.deepEqual(rows[15], [`Открыли приложение на${NB}7-й${NB}день`, '', '']);
  assert.ok((await block.locator('.note').textContent()).includes(`у${NB}него не записано время. Шаги организатора `
    + `после «Создали проект»${NB}— доля от${NB}создавших проект. Пустая ячейка:`));
  // The monitor's note of 28.11: «—» in the organiser's steps is named after the empty cell.
  assert.ok((await block.locator('.note').textContent()).endsWith(`Пустая ячейка: срок ещё ни у${NB}кого не прошёл. `
    + `Прочерк в${NB}шагах организатора: за${NB}первые 7${NB}дней проект не создал никто.`));

  // The server's refusal is named in the page's words.
  state.refusal = { error: 'at most 21 days', code: 'DATES_TOO_LONG', maxDays: 21 };
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.locator('#analytics-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#analytics-error span').textContent(),
    `Не удалось загрузить аналитику. Слишком длинный период: не больше 21${NB}дня.`);
  state.refusal = null;

  // A reload keeps the dates and the switch.
  const restored = answered('analytics', params => params.get('cohort') === '1');
  await page.reload();
  await restored;
  await waitForDashboard(page);
  assert.deepEqual([await page.locator('#filter-period').inputValue(), await page.locator('#filter-from').inputValue(),
    await page.locator('#filter-to').inputValue(), await page.locator('#filter-cohort').isChecked(), await source.isDisabled()],
  ['dates', '2026-11-10', '2026-11-16', true, true]);

  // Off: the source is free again, the earlier choice back in the requests.
  const freed = answered('analytics', params => params.get('cohort') === null);
  await page.locator('#filter-cohort').uncheck();
  await freed;
  assert.equal(await source.isDisabled(), false);
  assert.equal(await source.locator('option', { hasText: 'Свой / без проекта' }).count(), 0);
  await source.selectOption('own');
  await answered('analytics', params => params.get('source') === 'own');
  assert.equal(await page.locator('#analytics-body .block-title').first().textContent(), 'Воронка новичков');

  // Something unreadable stored: all time.
  await page.evaluate(() => localStorage.setItem('admin_filters', '{not json'));
  await page.reload();
  await waitForDashboard(page);
  assert.equal(await page.locator('#filter-period').inputValue(), 'all');
  assert.deepEqual(errors, []);
});

test('login, pagination, status, refresh, empty states and logout work under production CSP', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t, { signedIn: false });
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  // An empty field is asked for before any request; a wrong password's
  // answer carries markup, and the page shows its own words, never the server's (T-419).
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.locator('#login-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#login-error').textContent(), 'Введите пароль.');
  assert.equal(state.requests.length, 0);
  await page.locator('#password-input').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#login-error').textContent === 'Неверный пароль.');
  assert.equal(await page.locator('[data-xss-probe]').count(), 0);
  await page.locator('#password-input').fill('synthetic-password');
  await page.locator('#password-input').press('Enter');
  await waitForDashboard(page);
  assert.deepEqual(await page.locator('.card-value').allTextContents(), ['61', `10${NB}%`, '2', '4']);
  if (process.env.ADMIN_BROWSER_SCREENSHOT) {
    await page.screenshot({ path: process.env.ADMIN_BROWSER_SCREENSHOT });
  }
  assert.equal(await page.locator('#users-body td').nth(3).textContent(), '—');
  assert.equal(await page.locator('#bugs-body td').nth(2).textContent(), '—');

  for (const [id, firstCell] of [['users', 'User'], ['bugs', 'User']]) {
    const pagination = page.locator('#' + id + '-pagination');
    const first = page.locator('#' + id + '-body tr').first().locator('td').first();
    assert.equal(await pagination.locator('.page-label').textContent(), 'Страница 1 из 3');
    assert.equal(await pagination.getByRole('button', { name: 'Предыдущая' }).count(), 0);
    for (const [pageNumber, firstId] of [[2, 31], [3, 61]]) {
      await pagination.getByRole('button', { name: 'Следующая' }).click();
      await page.waitForFunction(({ id, firstId }) =>
        document.querySelector('#' + id + '-body td').textContent === 'User ' + firstId, { id, firstId });
      assert.equal(await first.textContent(), `${firstCell} ${firstId}`);
      assert.equal(await pagination.locator('.page-label').textContent(), `Страница ${pageNumber} из 3`);
    }
    assert.equal(await pagination.getByRole('button', { name: 'Следующая' }).count(), 0);
    await pagination.getByRole('button', { name: 'Предыдущая' }).click();
    await page.waitForFunction(id => document.querySelector('#' + id + '-body td').textContent === 'User 31', id);
  }

  // The callback must keep the selected row's ID and retain the current page.
  for (const [label, status] of [['В работе', 'in_progress'], ['Исправлена', 'fixed'], ['Новая', 'new']]) {
    const row = page.locator('#bugs-body tr').first();
    await row.getByRole('button', { name: label, exact: true }).click();
    await row.locator('.status-btn-' + status + '.active').waitFor();
    assert.equal(state.statuses.get('31'), status);
    assert.equal(await page.locator('#bugs-pagination .page-label').textContent(), 'Страница 2 из 3');
  }
  const patches = state.requests.filter(r => r.method === 'PATCH');
  assert.deepEqual(patches.map(r => [r.path, r.body.status]), [
    ['/admin/api/bug-reports/31/status', 'in_progress'],
    ['/admin/api/bug-reports/31/status', 'fixed'],
    ['/admin/api/bug-reports/31/status', 'new'],
  ]);
  assert.ok(state.requests.every(r => r.authorized));

  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#users-body td').textContent === 'User 1'
    && document.querySelector('#bugs-body td').textContent === 'User 1');
  await page.reload();
  await waitForDashboard(page);
  state.empty = true;
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.getByText('Пользователей нет', { exact: true }).waitFor();
  await page.getByText('Отчётов об ошибках нет', { exact: true }).waitFor();
  assert.deepEqual(await page.locator('#users-pagination, #bugs-pagination').allTextContents(), ['', '']);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null);
  await page.reload();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#dashboard').isVisible(), false);
  state.empty = false;
  await page.locator('#password-input').fill('synthetic-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await waitForDashboard(page);
  const beforePatch = state.requests.filter(r => r.method === 'PATCH').length;
  await page.locator('#bugs-body tr').first().getByRole('button', { name: 'Исправлена', exact: true }).press('Enter');
  await page.locator('#bugs-body tr').first().locator('.status-btn-fixed.active').waitFor();
  assert.equal(state.requests.filter(r => r.method === 'PATCH').length, beforePatch + 1);
  assert.equal(state.statuses.get('1'), 'fixed');
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  assert.deepEqual(errors, []);
});

test('401 returns to login and removes the stored credential', { timeout: 30000 }, async t => {
  const { page, state, errors } = await fixture(t);
  await waitForDashboard(page);
  state.unauthorized = true;
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null);
  assert.equal(await page.locator('#dashboard').isVisible(), false);
  assert.deepEqual(errors, []);
});
