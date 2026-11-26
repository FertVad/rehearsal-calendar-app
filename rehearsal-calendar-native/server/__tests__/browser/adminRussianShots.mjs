// Photographs the admin page on adminRussianFixture.mjs's data (T-419): the login
// screen with a wrong password's message and the whole dashboard, at a laptop's
// width and a phone's.
//   node __tests__/browser/adminRussianShots.mjs <directory> <prefix>
// writes <prefix>-{laptop,phone}-{login,dashboard}.png there; run in server/.
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { closeOwnedBrowserFixture } from './ownedFixture.mjs';
import { ZONE, login, startAdminFixture } from './adminRussianFixture.mjs';

const [directory, prefix] = process.argv.slice(2);
if (!directory || !prefix) throw new Error('Usage: adminRussianShots.mjs <directory> <prefix>');

const sizes = { laptop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
try {
  for (const [name, viewport] of Object.entries(sizes)) {
    const { base, owned } = await startAdminFixture();
    const context = await browser.newContext({ viewport, timezoneId: ZONE, deviceScaleFactor: name === 'phone' ? 2 : 1 });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(base + '/admin');
      await page.locator('#password-input').fill('wrong-password');
      await page.locator('#login-button').click();
      await page.locator('#login-error').waitFor({ state: 'visible' });
      await page.locator('#login-button:not([disabled])').waitFor();
      await page.screenshot({ path: join(resolve(directory), `${prefix}-${name}-login.png`) });
      await login(page);
      await page.screenshot({ path: join(resolve(directory), `${prefix}-${name}-dashboard.png`), fullPage: true });
    } finally {
      await closeOwnedBrowserFixture({ context, owned, diagnostic: () => {} });
    }
  }
} finally {
  await browser.close();
}
console.log('Wrote the screenshots to ' + resolve(directory));
