import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { closeOwnedBrowserFixture } from './ownedFixture.mjs';
import { PASSWORD, ZONE, held, login, startAdminFixture } from './adminRussianFixture.mjs';

// The admin page is in Russian (T-419, the owner, 26.11.2026): every word on it
// is the native editor's (audit/evidence/T-419/natives-ru.md), only the data is
// as stored. The browser runs west of UTC, where a date without a time read
// through new Date falls on the day before (CLAUDE.md, rule 3).
const NB = ' ';

// Words a Russian page keeps in Latin letters: names, a unit of the API, variable
// names and domains, and the "N" of «Последние N дней».
const ALLOWED = ['ADMIN_SERVICE_EMAILS', 'MIN_IOS_BUILD', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD',
  'demo.rehearsly.me', 'rehearsly.me', 'Rehearsly', 'Apple', 'Google', 'UTC', 'push', 'N'];
// The fixture's stored values that stay as they are: addresses, a screen's
// name, language and zone codes, and a type the page has no name for.
const DATA = ['maria@example.test', 'olga@example.test', 'service@rehearsly.me', 'future_kind', 'Profile',
  'America/New_York', 'Europe/Moscow', 'ru', 'en'];

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
}, { timeout: 30000 });
after(async () => { await browser?.close(); }, { timeout: 10000 });

async function fixture(t) {
  const diagnostic = stage => console.log(`[admin-russian] ${t.name}: ${stage}`);
  const { base, state, owned } = await startAdminFixture();
  let context;
  t.after(async () => {
    state.held.forEach(plan => plan.release());
    await closeOwnedBrowserFixture({ context, owned, diagnostic });
  }, { timeout: 12000 });
  context = await browser.newContext({ timezoneId: ZONE, locale: 'en-US' });
  await context.route('**/*', route => (new URL(route.request().url()).origin === base ? route.continue() : route.abort()));
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/admin');
  t.after(() => assert.deepEqual(errors, []));
  return { page, state };
}

/**
 * Every Latin word in the document — its text, hidden or not, its title and the
 * title, aria-label and placeholder attributes — that is not data or an allowed
 * name. Before T-419 this is the whole page.
 */
async function englishWords(page) {
  const text = await page.evaluate(() => {
    const parts = [document.title];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    for (const node of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
      for (const name of ['title', 'aria-label', 'placeholder']) {
        if (node.hasAttribute(name)) parts.push(node.getAttribute(name));
      }
    }
    return parts.join('\n');
  });
  let rest = text;
  // Whole words only: "en" is a language code, not a part of "Calendar".
  for (const value of [...DATA, ...ALLOWED].sort((a, b) => b.length - a.length)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    rest = rest.replace(new RegExp(`(?<![A-Za-z_@.])${escaped}(?![A-Za-z_])`, 'g'), ' ');
  }
  return [...new Set(rest.match(/[A-Za-z_]+/g) || [])];
}

async function assertRussian(page, where) {
  assert.deepEqual(await englishWords(page), [], `English on the page: ${where}`);
}

const loginError = page => page.locator('#login-error');

test('the login screen and each of its messages are in Russian, never the server\'s text', { timeout: 30000 }, async t => {
  const { page, state } = await fixture(t);
  await assertRussian(page, 'login screen');
  assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
  assert.equal(await page.title(), 'Админка Rehearsly');
  assert.equal(await page.locator('#login-screen h2').textContent(), 'Админка Rehearsly');
  assert.equal(await page.locator('#password-input').getAttribute('placeholder'), 'Пароль');
  assert.equal(await page.locator('#login-button').textContent(), 'Войти');

  const message = async (plan, password = 'wrong') => {
    if (plan) state.plans.login.push(plan);
    await page.locator('#password-input').fill(password);
    await page.locator('#login-button').click();
    await loginError(page).waitFor({ state: 'visible' });
    await page.locator('#login-button:not([disabled])').waitFor();
    const text = await loginError(page).textContent();
    await assertRussian(page, 'login message ' + text);
    return text;
  };
  // 401: the server says "Invalid password"; the page says it in its own words.
  assert.equal(await message(null), 'Неверный пароль.');
  assert.equal(await message(null, ''), 'Введите пароль.');
  assert.equal(await message({ status: 400, body: { error: 'Password must be a non-empty string' } }), 'Введите пароль.');
  // 61 seconds is two minutes once rounded up; without the header, the window.
  assert.equal(await message({ status: 429, headers: { 'Retry-After': '61' }, body: { error: 'Too many login attempts, please try again later' } }),
    `Слишком много попыток входа. Попробуйте снова через 2${NB}мин.`);
  assert.equal(await message({ status: 429, headers: { 'Retry-After': '20' }, body: {} }),
    `Слишком много попыток входа. Попробуйте снова через 1${NB}мин.`);
  assert.equal(await message({ status: 429, body: {} }),
    `Слишком много попыток входа. Подождите до 15${NB}минут и попробуйте снова.`);
  assert.equal(await message({ status: 503, body: { error: 'Admin panel not configured' } }),
    'Вход не настроен: на сервере не задан пароль администратора (ADMIN_PASSWORD_HASH или ADMIN_PASSWORD).');
  // Any other 503 (the database, the rate limiter's store) is not "not configured".
  assert.equal(await message({ status: 503, body: { error: 'Service temporarily unavailable' } }), 'Не удалось войти. Попробуйте ещё раз.');
  assert.equal(await message({ status: 500, body: { error: 'Internal' } }), 'Не удалось войти. Попробуйте ещё раз.');

  const pending = held(state, 'login');
  await page.locator('#password-input').fill(PASSWORD);
  await page.locator('#login-button').click();
  await pending.arrival;
  assert.equal(await page.locator('#login-button').textContent(), 'Вход…');
  pending.release();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
});

test('the dashboard with data: Russian words, codes named, dates, decimals and units', { timeout: 30000 }, async t => {
  const { page } = await fixture(t);
  await login(page);
  await assertRussian(page, 'dashboard');
  assert.equal(await page.locator('.header h1').textContent(), 'Админка Rehearsly');

  // Cards: a decimal comma and a no-break space before the percent sign.
  assert.deepEqual(await page.locator('.card-value').allTextContents(), ['12', `40,5${NB}%`, '2', '4']);
  assert.equal(await page.locator('#stats-cards .card-sub').first().textContent(), `+1 за 7${NB}дней, +3 за 30${NB}дней`);

  // Users: a date without a time is the date in the string, wherever the browser is.
  const user = await page.locator('#users-body tr').first().locator('td').allTextContents();
  assert.deepEqual(user, ['Мария К.', 'maria@example.test', '10.09.2026', '10.09.2026', '10.09.2026',
    'Приглашение в «Гамлет» (владелец Ольга О.)', 'Apple, Google, почта', `ru / ${ZONE}`,
    'Онбординг: да · проектов: 2 (владелец — 1, участник — 1) · отметок: 3, по 10.09.2026'
      + ' · синхронизация календаря: да · устройство: нет · просмотрено: 1 из 2 · создано репетиций: 1']);
  const own = await page.locator('#users-body tr').nth(1).locator('td').allTextContents();
  assert.equal(own[3], '—');
  assert.equal(own[4], '—');
  assert.equal(own[5], 'Свой проект «Вишнёвый сад»');
  assert.match(own[8], /^Онбординг: нет · проектов: 2 \(владелец — 1, администратор — 1\) · отметок: нет · синхронизация календаря: нет · устройство: есть ·/);
  const service = await page.locator('#users-body tr').nth(2).locator('td').allTextContents();
  assert.deepEqual(service.slice(1, 3), ['service@rehearsly.me [служебный]', '—']);
  assert.equal(service[5], 'Без проекта');
  assert.equal(await page.locator('#users-pagination .page-label').textContent(), 'Страница 1 из 2');
  assert.equal(await page.locator('#users-pagination').getByRole('button', { name: 'Следующая' }).count(), 1);

  const body = page.locator('#analytics-body');
  const cells = await body.locator('td').allTextContents();
  for (const value of ['07.09.2026', '10.09.2026', `3 (100${NB}%)`, `2 (66,7${NB}%)`, 'По приглашению', 'Свой / без проекта',
    `1 из 2 (50${NB}%)`, 'Не указана', '42', 'Гамлет', 'Ольга О.', '—', `2 из 3 (66,7${NB}%)`,
    '10.09.2026', '12.09.2026', `30${NB}мин`, `2,5${NB}ч`, `1${NB}ч`, `40,5${NB}%`,
    'Новая репетиция / Вас позвали на репетицию', 'Вас сняли с репетиции', 'Напоминание за час', 'future_kind',
    'Подтверждение адреса при регистрации', 'Сброс пароля', 'Смена адреса: код на новый адрес',
    'Смена адреса: код на текущий адрес']) {
    assert.ok(cells.includes(value), `analytics shows ${value}`);
  }
  // X of 0 is no figure, not "0 of 0 (—)": the projects' "seen before start" here.
  const project = await body.locator('tr', { has: page.locator('td', { hasText: '12.09.2026' }) }).locator('td').allTextContents();
  assert.deepEqual(project, ['Гамлет', 'Ольга О.', '10.09.2026', '3', '4', '2', '12.09.2026', '—', `2 из 3 (66,7${NB}%)`]);
  const text = await body.textContent();
  assert.ok(text.includes(`По приглашению: медиана от регистрации до проекта${NB}— 2,5${NB}ч (по 12${NB}чел.), до первых отметок занятости${NB}— пока никого.`));
  assert.ok(text.includes(`Активных сегодня: 1 (33,3${NB}%) · за 7${NB}дней: 1 (33,3${NB}%) · за 30${NB}дней: 2 (66,7${NB}%)`));
  assert.ok(text.includes('Записи ведутся с 10.09.2026.'));
  assert.ok(text.includes(`Есть устройство для уведомлений: 1 из 3 (33,3${NB}%)`));
  // The monitor's additions, each confirmed by the code.
  assert.ok(text.includes(`7 и 30${NB}дней${NB}— это календарные даты по поясу человека, считая сегодняшнюю, а не сутки от текущего момента, как в фильтре. Записи ведутся с`));
  assert.ok(text.includes('Уведомления, которые человек удалил, не учитываются.'));
  assert.equal(text.split('Считаются только люди, подходящие под фильтры «Источник» и «Язык».').length - 1, 3);
  // A dash never begins a line of a note.
  assert.doesNotMatch(await page.locator('.note').allTextContents().then(notes => notes.join('\n')), / —/);

  const report = await page.locator('#bugs-body tr').first().locator('td').allTextContents();
  assert.deepEqual(report, ['Мария К.', 'Не открывается экран', 'Profile', 'Новая В работе Исправлена', '10.09.2026']);
  assert.equal(await page.locator('#bugs-body tr').first().locator('.status-btn.active').textContent(), 'В работе');
  assert.equal(await page.locator('#bugs-body tr').nth(1).locator('td').nth(2).textContent(), '—');
});

test('loading, failure, stale data and the status messages are in Russian', { timeout: 30000 }, async t => {
  const { page, state } = await fixture(t);
  await login(page);

  // A refresh held open: the indicator and the note over the old data.
  const refresh = held(state, 'stats');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await refresh.arrival;
  assert.equal(await page.locator('#stats-loading').textContent(), 'Обновление…');
  assert.equal(await page.locator('#stats-stale').textContent(), 'Идёт обновление — пока показаны прежние данные.');
  await assertRussian(page, 'refreshing');
  refresh.release();
  await page.locator('#stats-loading').waitFor({ state: 'hidden' });

  for (const [section, key, label] of [['stats', 'stats', 'статистику'], ['analytics', 'analytics', 'аналитику'],
    ['users', 'users', 'пользователей'], ['bugs', 'bugs', 'отчёты об ошибках']]) {
    state.plans[key].push({ status: 500, body: { error: 'Failed to load' } });
    await page.getByRole('button', { name: 'Обновить', exact: true }).click();
    await page.locator(`#${section}-error`).waitFor({ state: 'visible' });
    assert.equal(await page.locator(`#${section}-error span`).textContent(), `Не удалось загрузить ${label}. Запрос не выполнен. Попробуйте ещё раз.`);
    assert.equal(await page.locator(`#${section}-stale`).textContent(), 'Показаны прежние данные — возможно, они устарели.');
    await assertRussian(page, section + ' failed');
    await page.locator(`#${section}-error`).getByRole('button', { name: 'Повторить', exact: true }).click();
    await page.locator(`#${section}-error`).waitFor({ state: 'hidden' });
    await page.locator(`#${section}-loading`).waitFor({ state: 'hidden' });
  }
  state.plans.users.push({ status: 200, body: { nonsense: true } });
  await page.locator('#users-pagination').getByRole('button', { name: 'Следующая', exact: true }).click();
  await page.locator('#users-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#users-error span').textContent(),
    'Не удалось загрузить пользователей. Сервер ответил не так, как ожидалось.');

  // Saving a status: in progress, unconfirmed, saved.
  const row = page.locator('#bugs-body tr').first();
  const saving = held(state, 'patch');
  await row.getByRole('button', { name: 'Исправлена', exact: true }).click();
  await saving.arrival;
  assert.equal(await page.locator('#bugs-mutation-status').textContent(), `Отчёт №${NB}7: сохраняем статус…`);
  saving.release();
  await page.locator('#bugs-mutation-status').getByText(`Отчёт №${NB}7: статус сохранён.`, { exact: true }).waitFor();
  state.plans.patch.push({ status: 500, body: { error: 'Failed to update status' } });
  await row.getByRole('button', { name: 'Новая', exact: true }).click();
  await page.locator('#bugs-mutation-status[role="alert"]').waitFor();
  assert.equal(await page.locator('#bugs-mutation-status p').textContent(), `Отчёт №${NB}7: не удалось подтвердить смену статуса.`
    + ' Возможно, сервер её всё же сохранил: обновите отчёты и проверьте, прежде чем пробовать снова.');
  assert.equal(await page.locator('#bugs-mutation-status button').textContent(), 'Обновить отчёты');
  await assertRussian(page, 'status unconfirmed');

  // The session ends: the login screen says so.
  state.plans.stats.push({ status: 401, body: { error: 'Invalid or expired admin token' } });
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.locator('#login-screen').waitFor({ state: 'visible' });
  assert.equal(await loginError(page).textContent(), 'Сессия истекла. Войдите снова.');
  await assertRussian(page, 'session expired');
});
