/**
 * T-267: the page a person without the app lands on from an invite link
 * (/invite/:code) is Rehearsly's, speaks the app's four languages, and leads to
 * the App Store: a button and Safari's Smart App Banner, whose app-argument is
 * this invitation's own address. Read through the real app and its route.
 */
import { jest } from '@jest/globals';

const database = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));
jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Tests must not load .env'); });

const runtime = { ensureInitialized: jest.fn(), checkReady: jest.fn() };
const APP_STORE = 'https://apps.apple.com/app/id6830809401';
const LANGS = ['en', 'ru', 'es', 'de'];

let server;
let base;
beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  await new Promise((resolve, reject) => {
    server = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function page(code, query = '') {
  const response = await fetch(`${base}/invite/${encodeURIComponent(code)}${query}`);
  expect(response.status).toBe(200);
  return response.text();
}

const decode = value => value
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function smartBanner(html) {
  const tags = html.match(/<meta name="apple-itunes-app"[^>]*>/g) || [];
  expect(tags).toHaveLength(1);
  return /content="([^"]*)"/.exec(tags[0])[1];
}

test('all four languages are in the markup, English shown and the rest hidden until a script picks one', async () => {
  const html = await page('ABCDEFGH');
  for (const lang of LANGS) {
    const blocks = html.match(new RegExp(`<[a-z0-9]+ [^>]*data-l="${lang}"[^>]*>`, 'g')) || [];
    // Heading, steps, both buttons and the status line each say it in every language.
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    for (const tag of blocks) {
      expect(tag).toContain(`lang="${lang}"`);
      expect(/\shidden(?=[\s>])/.test(tag)).toBe(lang !== 'en');
    }
  }
  // Written in each language, not left in English.
  expect(html).toContain('Открыть приглашение');
  expect(html).toContain('Abrir invitación');
  expect(html).toContain('Einladung öffnen');
  expect(html).toContain('Open invitation');
});

test('the page is Rehearsly with its logo, and the old name is gone', async () => {
  const html = await page('ABCDEFGH');
  expect(html).not.toMatch(/Rehearsal App/i);
  expect(html).toMatch(/<title>[^<]*Rehearsly[^<]*<\/title>/);
  expect(html).toMatch(/<img [^>]*src="\/assets\/icon-180\.png"/);
});

test('the App Store button leads to the app, and the steps say to come back after installing', async () => {
  const html = await page('ABCDEFGH');
  const button = /<a [^>]*id="appStoreButton"[^>]*>/.exec(html);
  expect(button).not.toBeNull();
  expect(button[0]).toContain(`href="${APP_STORE}"`);
  expect(html).toMatch(/<ol [^>]*class="steps"/);
  expect(html).toContain('Вернитесь на эту страницу и нажмите «Открыть приглашение»');
});

test('the Smart App Banner names the app and hands it this invitation\'s address', async () => {
  const html = await page('ABCDEFGH');
  expect(smartBanner(html)).toBe(`app-id=6830809401, app-argument=${base}/invite/ABCDEFGH`);
});

test('an untrusted code stays escaped data in the banner and the links', async () => {
  const code = '"><script>window.x=1</script>, app-id=1&\'';
  const html = await page(code);
  expect(html).not.toContain('<script>window.x=1');
  const content = smartBanner(html);
  const argument = `${base}/invite/${encodeURIComponent(code)}`;
  expect(decode(content)).toBe(`app-id=6830809401, app-argument=${argument}`);
  // The comma that separates the banner's parameters cannot come from the code.
  expect(decode(content).split(',')).toHaveLength(2);
  expect(html).toContain(`href="rehearsalapp://invite/${encodeURIComponent(code).replace(/'/g, '&#39;')}"`);
});

// The editors' reading of each language (T-267 review), on the terms the
// native speakers set for the app (T-256): one Spanish for every country, no
// "Ensemble" in German, a no-break space before the German ellipsis, and the
// project's people named alike in all four. [lang, new wording, old wording].
const EDITS = [
  ['en', 'shows when everyone in the project is free', 'whole cast'],
  ['ru', 'когда свободны все участники проекта', 'свободна вся команда'],
  ['es', 'Tienes una invitación a un proyecto', 'Te invitaron'],
  ['es', 'cuándo están libres todos los participantes', 'elenco'],
  ['es', 'Pasa directamente al paso 2. Instalarla no abre la invitación', 'directo al paso'],
  ['de', 'wann alle im Projekt Zeit haben', 'Ensemble'],
  ['de', 'Rehearsly wird geöffnet …', 'Rehearsly wird geöffnet …'],
];

test.each(EDITS)('%s reads as its editor left it: "%s", not "%s"', async (lang, now, before) => {
  const html = await page('ABCDEFGH');
  const said = (html.match(new RegExp(`<[a-z0-9]+ [^>]*data-l="${lang}"[^>]*>[^<]*`, 'g')) || [])
    .map(block => block.replace(/^<[^>]*>/, '')).join('\n');
  expect(said).toContain(now);
  expect(said).not.toContain(before);
});

test('the Expo development link is kept beside the installed app\'s', async () => {
  const html = await page('ABCDEFGH', '?expoHost=127.0.0.1%3A8081');
  expect(html).toMatch(/id="openButton"[^>]*href="exp:\/\/127\.0\.0\.1:8081\/--\/invite\/ABCDEFGH"|href="exp:\/\/127\.0\.0\.1:8081\/--\/invite\/ABCDEFGH"[^>]*id="openButton"/);
  expect(html).toMatch(/href="rehearsalapp:\/\/invite\/ABCDEFGH"[^>]*id="nativeOpenButton"/);
  expect(smartBanner(html)).toBe(`app-id=6830809401, app-argument=${base}/invite/ABCDEFGH`);
});
