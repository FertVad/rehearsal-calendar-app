// T-204 probe 2: what a scheme attempt that starts before the load event does
// to page.goto. A delayed image holds back load, as a busy machine does.
// Copy to rehearsal-calendar-native/server/__tests__/browser/ and run `node <file>`.
import { chromium } from 'playwright';

const { createApp } = await import('../../app.js');
const server = await new Promise(resolve => {
  const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
await context.route('**/slow.png', async route => {
  await new Promise(resolve => setTimeout(resolve, 300));
  await route.fulfill({ status: 404, body: '' });
});
await context.route('**/invite-page/invite.js', route => route.fulfill({
  contentType: 'text/javascript',
  body: `const image = new Image(); image.src = '/slow.png'; document.body.append(image);
    setTimeout(() => location.assign('rehearsalapp://invite/ABCDEFGH'), 0);`,
}));
const page = await context.newPage();
page.setDefaultTimeout(5000);
const start = Date.now();
page.on('request', r => console.log(Date.now() - start, 'request', r.url()));
page.on('requestfailed', r => console.log(Date.now() - start, 'requestfailed', r.url(), r.failure()?.errorText));
page.on('load', () => console.log(Date.now() - start, 'load'));
try {
  await page.goto(`${base}/invite/ABCDEFGH`);
  console.log(Date.now() - start, 'goto resolved');
} catch (error) {
  console.log(Date.now() - start, error.message);
}
await browser.close();
server.close();
