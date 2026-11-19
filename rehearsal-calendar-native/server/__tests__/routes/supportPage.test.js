/**
 * T-268: the support page, the App Store's Support URL, tells the truth about
 * the app it supports, in all four of its languages. It sent people to a bug
 * report button "in the banner at the top of every screen" that attached the
 * screen they were on; the banner went in T-008, the button is in the profile's
 * About block, and the report's screen is always the profile. Its other paths
 * are read against the app's own strings too, so a renamed row fails here.
 * Read through the real app and its /support route.
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const database = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
jest.unstable_mockModule('../../database/db.js', () => ({ default: database, isPostgres: false }));
jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Tests must not load .env'); });

const runtime = { ensureInitialized: jest.fn(), checkReady: jest.fn() };
const LANGS = ['en', 'ru', 'es', 'de'];
const TRANSLATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/i18n/translations');

// The app's own strings, by language, from its translation files: the page
// names what the person sees on the screen, word for word.
function strings(file) {
  const source = fs.readFileSync(path.join(TRANSLATIONS, file), 'utf8');
  const byLang = {};
  for (const [, lang, body] of source.matchAll(/export const (\w+) = \{([\s\S]*?)\n\};/g)) {
    byLang[lang] = {};
    for (const [, key, value] of body.matchAll(/^\s+(\w+): '((?:[^'\\]|\\.)*)',$/gm)) {
      byLang[lang][key] = value.replace(/\\(.)/g, '$1');
    }
  }
  return byLang;
}
const profile = strings('profile.ts');
const projects = strings('projects.ts');
const auth = strings('auth.ts');

let server;
let html;
beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  await new Promise((resolve, reject) => {
    server = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/support`);
  expect(response.status).toBe(200);
  html = await response.text();
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

function section(lang) {
  const match = new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  expect(match).not.toBeNull();
  // Markup out and lines joined, so a phrase broken across lines still reads.
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function strongs(lang) {
  const match = new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  return [...match[1].matchAll(/<strong>([\s\S]*?)<\/strong>/g)]
    .map(([, text]) => text.replace(/\s+/g, ' ').replace(/^[«„"“]|[»“"”]$/g, ''));
}

test('the translations were read', () => {
  for (const lang of LANGS) {
    for (const key of ['title', 'about', 'reportBug', 'notifications', 'deleteAccount']) {
      expect(profile[lang]?.[key]).toBeTruthy();
    }
    expect(projects[lang]?.shareLink).toBeTruthy();
    expect(auth[lang]?.forgotPassword).toBeTruthy();
  }
});

test.each(LANGS)('%s: the bug report button is named as the app names it, and found in the profile’s About', lang => {
  const { title, about, reportBug } = profile[lang];
  expect(strongs(lang)).toContain(reportBug);
  expect(section(lang)).toContain(`${title} → ${about} →`);
});

test('no language sends anyone to a banner, which the app has not had since T-008', () => {
  const text = html.replace(/<[^>]+>/g, ' ');
  expect(text).not.toMatch(/banner|баннер|franja/i);
});

// What the page promised and the app does not do: the report's screen is
// always the profile (BugReportSheet), and the deletion's confirmation lists no
// projects — only afterwards does the app say how many went.
const UNTRUE = {
  en: ['attaches the screen', 'tells you which ones before you confirm'],
  ru: ['прикладывается экран', 'покажет их список до подтверждения'],
  es: ['Adjunta automáticamente', 'te muestra cuáles antes de confirmar'],
  de: ['hängt automatisch an', 'zeigt sie dir vor der Bestätigung'],
};
test.each(LANGS)('%s: promises nothing the app does not do', lang => {
  for (const claim of UNTRUE[lang]) expect(section(lang)).not.toContain(claim);
});

test.each(LANGS)('%s: the profile’s rows are named as the app names them', lang => {
  const { title, notifications, deleteAccount } = profile[lang];
  const text = section(lang);
  expect(text).toContain(`${title} → ${notifications}`);
  expect(text).toContain(`${title} → ${deleteAccount}`);
});

// iOS's own path, in Apple's words for each language (support.apple.com, "Change
// notification settings on iPhone"): Settings → Notifications → the app. Since
// iOS 18 an app is no longer a row of Settings itself but sits under Apps, so
// "Settings → Rehearsly" leads nowhere; the Notifications list holds on every iOS.
// Spanish names the Settings app by description: it is «Ajustes» in Spain and
// «Configuración» in Latin America (T-256; the es editor, T-269).
const IOS = {
  en: { settings: 'Settings', path: 'Settings → Notifications → Rehearsly' },
  ru: { settings: 'Настройки', path: 'Настройки → Уведомления → Rehearsly' },
  es: { settings: 'Ajustes', path: 'la configuración del teléfono: Notificaciones → Rehearsly' },
  de: { settings: 'Einstellungen', path: 'Einstellungen → Mitteilungen → Rehearsly' },
};
test.each(LANGS)('%s: iOS’s notification settings are found where iOS has them', lang => {
  const { settings, path: where } = IOS[lang];
  const text = section(lang);
  expect(text).toContain(where);
  expect(text).not.toContain(`${settings} → Rehearsly`);
});

// The owner's rule (17.11): the texts do not say who made the app.
const AUTHOR = {
  en: 'built by one person',
  ru: 'делает один человек',
  es: 'la hace una sola persona',
  de: 'von einer Person gebaut',
};
test.each(LANGS)('%s: does not say who makes the app', lang => {
  expect(section(lang)).not.toContain(AUTHOR[lang]);
});

test.each(LANGS)('%s: a fresh invite comes from the project’s own button', lang => {
  expect(section(lang)).toContain(projects[lang].shareLink);
});

test.each(LANGS)('%s: a Google or Apple account can still get a password, by the reset', lang => {
  expect(section(lang)).toContain(auth[lang].forgotPassword);
});
