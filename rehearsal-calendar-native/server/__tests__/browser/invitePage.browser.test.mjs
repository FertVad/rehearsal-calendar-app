import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

// Run against the real application and its unmodified securityHeaders policy.
// No server.js, .env, database initialization, live domain or external HTTP is
// needed for this route. Refuse inherited database configuration as well.
assert.equal(process.env.DATABASE_URL, undefined, 'Run this fixture without DATABASE_URL');
assert.equal(process.env.POSTGRES_URL, undefined, 'Run this fixture without POSTGRES_URL');
const { createApp } = await import('../../app.js');
const database = await import('../../database/db.js');
assert.equal(database.default, undefined, 'Invite fixture must not initialize a database');

let browser;
let server;
let base;

before(async () => {
  server = await new Promise((resolve, reject) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.equal(database.default, undefined, 'Browser checks must not initialize a database');
});

async function fixture(t, { code = 'ABCDEFGH', query = '', javaScriptEnabled = true, blockScript = false, locale = 'en-US' } = {}) {
  const context = await browser.newContext({ javaScriptEnabled, locale, serviceWorkers: 'block' });
  const unexpectedRequests = [];
  const blockedScripts = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      unexpectedRequests.push(url.href);
      return route.abort();
    }
    if (blockScript && url.pathname === '/invite-page/invite.js') {
      blockedScripts.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => {
    window.inviteCspViolations = [];
    window.inviteActivations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.inviteCspViolations.push(event.violatedDirective);
    });
    // Capture trusted anchor activation, then suppress its default action in
    // this fixture. Chromium cannot establish delivery to an installed iOS app.
    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('#openButton, #nativeOpenButton');
      if (anchor) {
        window.inviteActivations.push({ href: anchor.href, trusted: event.isTrusted, defaultPrevented: event.defaultPrevented });
        event.preventDefault();
      }
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (javaScriptEnabled) {
    await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'));
  }
  const response = await page.goto(`${base}/invite/${encodeURIComponent(code)}${query}`);
  t.after(async () => {
    await context.close();
    assert.deepEqual(unexpectedRequests, [], 'No HTTP request may leave the isolated test origin');
    assert.deepEqual(errors, [], 'The invite document must not raise browser errors');
  });
  assert.equal(response.status(), 200);
  return { page, response, blockedScripts };
}

function assertStrictPolicy(response) {
  const policy = response.headers()['content-security-policy'];
  assert.ok(policy, 'The real route must send its security policy');
  assert.match(policy, /'nonce-[A-Za-z0-9+/]{22}=='/);
  const directives = Object.fromEntries(policy.split(';').map(value => {
    const [name, ...tokens] = value.trim().split(/\s+/);
    return [name, tokens.join(' ').replace(/'nonce-[^']+'/g, "'nonce-RESPONSE'")];
  }));
  assert.deepEqual(directives, {
    'default-src': "'self'",
    'script-src': "'self' 'nonce-RESPONSE'",
    'script-src-attr': "'none'",
    'style-src': "'self' https://fonts.googleapis.com",
    'font-src': "'self' https://fonts.gstatic.com",
    'img-src': "'self' data:",
    'connect-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
    'upgrade-insecure-requests': '',
  }, 'The invite fix must not weaken or replace the global CSP');
}

async function assertCleanDocument(page) {
  assert.equal(await page.locator('[onclick], [onerror], [onload], [style], style, script:not([src])').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.inviteCspViolations), []);
}

test('real invite route retains strict CSP, styling and the timed fallback', async t => {
  const { page, response } = await fixture(t);
  assertStrictPolicy(response);
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).display), 'flex');
  assert.match(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/);
  assert.equal(await page.locator('#openButton').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
  assert.equal(await page.locator('#manual').isVisible(), false, 'Enhanced page initially offers the automatic attempt');
  assert.equal(await page.locator('#status').isVisible(), true);
  await page.clock.runFor(1999);
  assert.equal(await page.locator('#manual').isVisible(), false, 'Manual fallback must not appear before its timeout');
  await page.clock.runFor(1001);
  assert.equal(await page.locator('#manual').isVisible(), true);
  assert.equal(await page.locator('#status').isVisible(), false);
  assert.equal(await page.locator('#openButton').textContent(), 'Open App');
  await assertCleanDocument(page);
  if (process.env.INVITE_BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.INVITE_BROWSER_SCREENSHOT });
  for (const [asset, mime] of [['invite.js', /javascript/], ['invite.css', /text\/css/]]) {
    const assetResponse = await page.request.get(`${base}/invite-page/${asset}`);
    assert.equal(assetResponse.status(), 200);
    assert.match(assetResponse.headers()['content-type'], mime);
    assert.equal(assetResponse.headers()['x-content-type-options'], 'nosniff');
  }
});

for (const code of ['ABCDEFGH', '0123456789abcdef0123456789abcdef']) {
  test(`manual mouse and keyboard activation preserve the ${code.length === 8 ? 'short' : 'legacy 32-hex'} invite path under CSP`, async t => {
    const { page } = await fixture(t, { code });
    const href = `rehearsalapp://invite/${encodeURIComponent(code)}`;
    assert.equal(await page.locator('#openButton').getAttribute('href'), href);
    await page.clock.runFor(3000);
    await page.locator('#openButton').click();
    await page.clock.runFor(3000);
    await page.locator('#openButton').press('Enter');
    assert.deepEqual(await page.evaluate(() => window.inviteActivations), [
      { href, trusted: true, defaultPrevented: false }, { href, trusted: true, defaultPrevented: false },
    ]);
    await assertCleanDocument(page);
  });
}

for (const mode of ['disabled', 'unavailable']) {
  test(`manual native link remains usable when JavaScript is ${mode}`, async t => {
    const { page, response, blockedScripts } = await fixture(t, {
      javaScriptEnabled: mode !== 'disabled', blockScript: mode === 'unavailable',
    });
    assertStrictPolicy(response);
    assert.equal(await page.locator('#manual').isVisible(), true);
    assert.equal(await page.locator('#status').isVisible(), false);
    assert.equal(await page.locator('#openButton').getAttribute('href'), 'rehearsalapp://invite/ABCDEFGH');
    assert.equal(await page.locator('#openButton').textContent(), 'Open App');
    assert.match(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/);
    if (mode === 'unavailable') assert.deepEqual(blockedScripts, ['/invite-page/invite.js']);
  });
}

test('Expo links preserve their encoded invite path and retain a native app link', async t => {
  const code = 'ABCDEFGH';
  const { page } = await fixture(t, { code, query: '?expoHost=127.0.0.1%3A8081' });
  assert.equal(await page.locator('#openButton').getAttribute('href'), `exp://127.0.0.1:8081/--/invite/${code}`);
  assert.equal(await page.locator('#nativeOpenButton').getAttribute('href'), `rehearsalapp://invite/${code}`);
  await page.clock.runFor(3000);
  await page.locator('#openButton').click();
  await page.clock.runFor(3000);
  await page.locator('#nativeOpenButton').click();
  assert.deepEqual(await page.evaluate(() => window.inviteActivations.map(event => event.href)), [
    `exp://127.0.0.1:8081/--/invite/${code}`, `rehearsalapp://invite/${code}`,
  ]);
  await assertCleanDocument(page);
});

test('untrusted invite codes remain encoded data without creating or executing markup', async t => {
  const code = '</script><img data-invite-xss src=x onerror="window.__inviteXss=1">\'"&?#/`';
  const { page } = await fixture(t, { code });
  const href = await page.locator('#openButton').getAttribute('href');
  assert.equal(href, `rehearsalapp://invite/${encodeURIComponent(code)}`);
  assert.equal(decodeURIComponent(href.slice('rehearsalapp://invite/'.length)), code);
  assert.equal(await page.locator('[data-invite-xss]').count(), 0);
  assert.equal(await page.evaluate(() => window.__inviteXss), undefined);
  await page.clock.runFor(3000);
  await page.locator('#openButton').click();
  assert.equal(await page.evaluate(() => window.inviteActivations[0].href), href);
  await assertCleanDocument(page);
});

test('malformed or repeated Expo host parameters cannot change the native fallback', async t => {
  for (const query of [
    '?expoHost=attacker.example%2Fpath',
    '?expoHost=attacker.example%3Fx%3D1',
    '?expoHost=user%40attacker.example',
    '?expoHost=javascript%3Aalert(1)',
    '?expoHost=one.example&expoHost=two.example',
    '?expoHost[host]=attacker.example',
  ]) {
    const { page } = await fixture(t, { query });
    assert.equal(await page.locator('#openButton').getAttribute('href'), 'rehearsalapp://invite/ABCDEFGH', query);
    assert.equal(await page.locator('#nativeOpenButton').count(), 0);
    await page.clock.runFor(3000);
    await assertCleanDocument(page);
  }
});

test('Russian browser language localizes the status, fallback and both manual links', async t => {
  const { page } = await fixture(t, { locale: 'ru-RU', query: '?expoHost=127.0.0.1%3A8081' });
  assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
  assert.equal(await page.locator('#statusText').textContent(), 'Открываем приложение...');
  await page.clock.runFor(3000);
  assert.equal(await page.locator('#manual').isVisible(), true);
  assert.equal(await page.locator('#manualText').textContent(), 'Приложение не открылось автоматически?');
  assert.equal(await page.locator('#openButton').textContent(), 'Открыть приложение');
  assert.equal(await page.locator('#nativeOpenButton').textContent(), 'Открыть установленное приложение');
  assert.equal(await page.locator('#installText').textContent(), 'Если приложение не установлено, установите Rehearsly и вернитесь к этому приглашению.');
  await assertCleanDocument(page);
});

test('visibility changes and page restoration cancel a pending second automatic scheme attempt', async t => {
  for (const lifecycleEvent of ['visibilitychange', 'pageshow']) {
    const { page } = await fixture(t, { query: '?expoHost=127.0.0.1%3A8081' });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    const attempts = [];
    cdp.on('Page.frameRequestedNavigation', event => {
      if (/^(exp|rehearsalapp):/.test(event.url)) attempts.push(event.url);
    });
    const firstAttempt = once(cdp, 'Page.frameRequestedNavigation', { signal: AbortSignal.timeout(5000) });
    await page.clock.runFor(1);
    await firstAttempt;
    assert.deepEqual(attempts, ['exp://127.0.0.1:8081/--/invite/ABCDEFGH']);
    // Exercise the page's lifecycle handlers without claiming a real iOS
    // background/return transition. CDP observes a request, not OS delivery.
    await page.evaluate(event => {
      if (event === 'visibilitychange') document.dispatchEvent(new Event(event));
      else window.dispatchEvent(new PageTransitionEvent(event, { persisted: true }));
    }, lifecycleEvent);
    assert.equal(await page.locator('#manual').isVisible(), true);
    assert.equal(await page.locator('#status').isVisible(), false);
    await page.clock.runFor(3000);
    // Navigation notifications cross the CDP process boundary asynchronously.
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(attempts, ['exp://127.0.0.1:8081/--/invite/ABCDEFGH'], lifecycleEvent);
    await assertCleanDocument(page);
    await cdp.detach();
  }
});

test('the page policy still blocks injected inline scripts and event handlers', async t => {
  const { page, response } = await fixture(t);
  assertStrictPolicy(response);
  await page.clock.runFor(3000);
  await assertCleanDocument(page);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__inlineInviteScript = true';
    document.body.append(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.__inlineInviteHandler = true');
    document.body.append(button);
    button.click();
  });
  await page.waitForFunction(() => window.inviteCspViolations.length >= 2);
  assert.deepEqual(await page.evaluate(() => [window.__inlineInviteScript, window.__inlineInviteHandler]), [undefined, undefined]);
  assert.deepEqual(new Set(await page.evaluate(() => window.inviteCspViolations)), new Set(['script-src-elem', 'script-src-attr']));
});
