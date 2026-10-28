// T-204 probe 3: can an init script observe and cancel the page's scheme
// navigations through the Navigation API, so Chromium never starts a
// navigation request? Copy to rehearsal-calendar-native/server/__tests__/browser/
// and run `node <file>`.
import { chromium } from 'playwright';

const { createApp } = await import('../../app.js');
const server = await new Promise(resolve => {
  const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
await context.addInitScript(() => {
  window.attempts = [];
  navigation.addEventListener('navigate', event => {
    window.attempts.push({ url: event.destination.url, cancelable: event.cancelable, userInitiated: event.userInitiated });
    if (/^(exp|rehearsalapp):/.test(event.destination.url)) event.preventDefault();
  });
});
const page = await context.newPage();
const start = Date.now();
page.on('request', r => console.log(Date.now() - start, 'request', r.url()));
page.on('requestfailed', r => console.log(Date.now() - start, 'requestfailed', r.url()));
await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'));
await page.goto(`${base}/invite/ABCDEFGH?expoHost=127.0.0.1%3A8081`);
await page.clock.runFor(3000);
console.log('manual visible', await page.locator('#manual').isVisible());
await page.locator('#openButton').click();
await page.locator('#nativeOpenButton').press('Enter');
console.log(await page.evaluate(() => JSON.stringify(window.attempts)));
await browser.close();
server.close();
