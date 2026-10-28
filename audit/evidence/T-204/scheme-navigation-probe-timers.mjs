// T-204 timers probe: which zero-delay page timers run on their own under each
// way of pausing the Playwright clock before navigation.
// Copy to rehearsal-calendar-native/server/__tests__/browser/ and run `node <file>`.
import { chromium } from 'playwright';

const { createApp } = await import('../../app.js');
const server = await new Promise(resolve => {
  const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
for (const mode of ['install+pauseAt', 'pauseAt', 'install+pauseAt', 'pauseAt']) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/invite-page/invite.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.__log = [];
      setTimeout(() => window.__log.push('t0 ' + new Date().toISOString() + ' ' + document.readyState), 0);
      setTimeout(() => window.__log.push('t1'), 1);
      window.addEventListener('load', () => setTimeout(() => window.__log.push('afterLoad0'), 0));`,
  }));
  const page = await context.newPage();
  if (mode === 'install+pauseAt') await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'));
  await page.goto(`${base}/invite/ABCDEFGH`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const before = await page.evaluate(() => window.__log.join(', '));
  await page.clock.runFor(10);
  console.log(`${mode}: before runFor [${before}] after runFor [${await page.evaluate(() => window.__log.join(', '))}]`);
  await context.close();
}
await browser.close();
server.close();
