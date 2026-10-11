// T-204 probe 1: what the invite page's automatic scheme attempts do to
// Playwright's navigation tracking and to clock.runFor. Same steps as the old
// fixture of invitePage.browser.test.mjs (no in-page cancellation).
// Copy to rehearsal-calendar-native/server/__tests__/browser/ and run:
//   node <file> <runs> <query> [verbose] [real wait ms before runFor]
// e.g. `node <file> 80 ''` (failures only) or
//      `node <file> 1 '?expoHost=127.0.0.1%3A8081' verbose 300`.
import { chromium } from 'playwright';

const { createApp } = await import('../../app.js');
const server = await new Promise(resolve => {
  const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const runs = Number(process.argv[2] || 20);
const query = process.argv[3] ?? '?expoHost=127.0.0.1%3A8081';

for (let run = 0; run < runs; run++) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const start = Date.now();
  const log = [];
  const at = message => log.push(`${String(Date.now() - start).padStart(5)}ms ${message}`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  cdp.on('Page.frameRequestedNavigation', e => at(`requestedNavigation ${e.url} (${e.reason})`));
  cdp.on('Page.frameStartedLoading', () => at('frameStartedLoading'));
  cdp.on('Page.frameStoppedLoading', () => at('frameStoppedLoading'));
  cdp.on('Page.frameNavigated', e => at(`frameNavigated ${e.frame.url}`));
  page.on('load', () => at('page load'));
  page.on('request', r => at(`request ${r.url()} nav=${r.isNavigationRequest()}`));
  page.on('requestfailed', r => at(`requestfailed ${r.url()} ${r.failure()?.errorText}`));
  page.on('requestfinished', r => at(`requestfinished ${r.url()}`));
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'));
  let outcome = 'ok';
  try {
    await page.goto(`${base}/invite/ABCDEFGH${query}`);
    at(`goto resolved, page clock ${await page.evaluate(() => new Date().toISOString())}`);
    if (process.argv[5]) {
      await new Promise(resolve => setTimeout(resolve, Number(process.argv[5])));
      at('real wait done');
    }
    await page.clock.runFor(3000);
    at(`runFor resolved, page clock ${await page.evaluate(() => new Date().toISOString())}`);
    at(`after runFor manual visible=${await page.locator('#manual').isVisible()}`);
    await page.locator('#openButton').click();
    at('clicked');
  } catch (error) {
    outcome = `FAIL ${error.message.split('\n')[0]}`;
  }
  console.log(`run ${run}: ${outcome}`);
  if (outcome !== 'ok' || process.argv[4] === 'verbose') console.log(log.join('\n'));
  await context.close();
}
await browser.close();
server.close();
