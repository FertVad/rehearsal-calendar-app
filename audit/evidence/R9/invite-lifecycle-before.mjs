// The lifecycle test of invitePage.browser.test.mjs exactly as in 712995b
// (fixture reduced to the steps this test uses). Produced
// invite-lifecycle-before.txt. To rerun, copy it to
// rehearsal-calendar-native/server/__tests__/browser/ and run `node --test` on it.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const { createApp } = await import('../../app.js');

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
});

async function fixture(t, { code = 'ABCDEFGH', query = '', locale = 'en-US' } = {}) {
  const context = await browser.newContext({ locale, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'));
  const response = await page.goto(`${base}/invite/${encodeURIComponent(code)}${query}`);
  t.after(() => context.close());
  assert.equal(response.status(), 200);
  return { page, response };
}

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
    await page.evaluate(event => {
      if (event === 'visibilitychange') document.dispatchEvent(new Event(event));
      else window.dispatchEvent(new PageTransitionEvent(event, { persisted: true }));
    }, lifecycleEvent);
    assert.equal(await page.locator('#manual').isVisible(), true);
    await page.clock.runFor(3000);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(attempts, ['exp://127.0.0.1:8081/--/invite/ABCDEFGH'], lifecycleEvent);
    await cdp.detach();
  }
});
