/**
 * T-269: the privacy policy says what the server really keeps, in each of its
 * four languages, as App Review 5.1.1(i) and Google's brand verification ask.
 * Read through the real app and its /privacy and /support routes. Every language
 * is written on its own, so every language is checked on its own.
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

// The app's plain strings, by language: a button the policy names has to exist.
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
const calendarSync = strings('calendarSync.ts');
const profile = strings('profile.ts');

let server;
const pages = {};
beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  await new Promise((resolve, reject) => {
    server = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  for (const page of ['privacy', 'support']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/${page}`);
    expect(response.status).toBe(200);
    pages[page] = await response.text();
  }
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

function markup(page, lang) {
  const match = new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`).exec(pages[page]);
  expect(match).not.toBeNull();
  return match[1];
}
// Markup out and lines joined, so a phrase broken across lines still reads.
const text = (page, lang) => markup(page, lang).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// The part of the policy under one <h2>, up to the next one.
function part(lang, heading) {
  const html = markup('privacy', lang);
  const start = html.search(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = html.indexOf('<h2>', start + 4);
  return html.slice(start, next < 0 ? undefined : next).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

const COPY = {
  en: {
    processors: /same or equal protection as stated in this policy/,
    signIns: /time of your last sign-in/i,
    inbox: /notifications? .*inbox/i,
    seen: /marked as seen/i,
    ipHash: /keyed hash of your IP address/i,
    hostingLogs: /Vercel[^.]*about an hour/i,
    restoreHistory: /Neon[^.]*up to 7 days/i,
    keepsImported: /Turning off Auto Sync[^.]*does not remove/i,
    oldButton: 'Clear imported',
    cardPromise: /card details|payment provider/i,
    free: /free[^.]*no purchases/i,
  },
  ru: {
    processors: /защищает ваши данные так же или не хуже/,
    signIns: /время последнего входа/i,
    inbox: /уведомления[^.]*входящи/i,
    seen: /просмотрен/i,
    ipHash: /хеш вашего IP-адреса/i,
    hostingLogs: /Vercel[^.]*около часа/i,
    restoreHistory: /Neon[^.]*до 7 дней/i,
    keepsImported: /Выключение[^.]*Автосинхронизаци[^.]*не удаляет/i,
    oldButton: 'Очистить импортированные',
    cardPromise: /данные (банковских )?карт|платёжн/i,
    free: /бесплат[^.]*покупок[^.]*нет/i,
  },
  es: {
    processors: /protección igual o equivalente/,
    signIns: /hora de tu último inicio de sesión/i,
    inbox: /notificaciones[^.]*bandeja de entrada/i,
    seen: /marcad[oa]s? como vist[oa]s?/i,
    ipHash: /hash con clave de tu dirección IP/i,
    hostingLogs: /Vercel[^.]*alrededor de una hora/i,
    restoreHistory: /Neon[^.]*hasta 7 días/i,
    keepsImported: /Desactivar la Sincronización automática[^.]*no elimina/i,
    oldButton: 'Borrar lo importado',
    cardPromise: /tarjeta|proveedor de pagos/i,
    free: /gratuita[^.]*no (tiene|contiene) compras/i,
  },
  de: {
    processors: /mindestens so gut/,
    signIns: /Zeitpunkt deiner letzten Anmeldung/i,
    inbox: /Mitteilungen[^.]*Posteingang/i,
    seen: /als gesehen markiert/i,
    ipHash: /mit Schlüssel gebildeter Hash deiner IP-Adresse/i,
    hostingLogs: /Vercel[^.]*etwa eine Stunde/i,
    restoreHistory: /Neon[^.]*bis zu 7 Tage/i,
    keepsImported: /Wenn du Auto-Sync ausschaltest[^.]*nicht gelöscht/i,
    oldButton: 'Importierte löschen',
    cardPromise: /Kartendaten|Zahlungsdienstleister/i,
    free: /kostenlos[^.]*keine Käufe/i,
  },
};

describe.each(LANGS)('privacy policy, %s', lang => {
  const copy = COPY[lang];

  test('confirms that the providers protect the data as this policy does', () => {
    expect(text('privacy', lang)).toMatch(copy.processors);
  });

  test('names sign-in times, the notification inbox and the seen marks', () => {
    const page = text('privacy', lang);
    expect(page).toMatch(copy.signIns);
    expect(page).toMatch(copy.inbox);
    expect(page).toMatch(copy.seen);
  });

  test('says what happens to the IP address and how long the history lasts', () => {
    const page = text('privacy', lang);
    expect(page).toMatch(copy.ipHash);
    expect(page).toMatch(copy.hostingLogs);
    expect(page).toMatch(copy.restoreHistory);
  });

  test('names no button the app does not have', () => {
    const labels = Object.values(calendarSync[lang]);
    expect(labels.length).toBeGreaterThan(0);
    if (!labels.includes(copy.oldButton)) expect(text('privacy', lang)).not.toContain(copy.oldButton);
  });

  test('sends people to the calendar screen by its name in the app', () => {
    expect(text('privacy', lang)).toContain(`${profile[lang].title} → ${calendarSync[lang].title}`);
  });

  test('says that switching Auto Sync off keeps what was imported', () => {
    expect(text('privacy', lang)).toContain(calendarSync[lang].autoSync);
    expect(text('privacy', lang)).toMatch(copy.keepsImported);
  });

  test('promises no card payment: the app is free, with no purchases', () => {
    const page = text('privacy', lang);
    expect(page).not.toMatch(copy.cardPromise);
    expect(page).toMatch(copy.free);
  });
});

// Google's verification asks how the app gets, uses, keeps and shares the data
// of a Google user. Each line stands for what the code does: oauthVerification.js
// takes these fields, accountLinking.js keeps them, no Google API is called.
const SIGN_IN = {
  en: {
    heading: /<h2>Google and Apple sign-in data<\/h2>/,
    says: [/first and last name/i, /email address/i, /verified/i, /account identifier/i, /profile photo/i,
      /Gmail/, /Google Calendar/, /Google Contacts/, /Neon/, /do not sell/i, /advertising/i, /train/i,
      /Delete Account/, /Google Account settings/, /privaterelay\.appleid\.com/, /Hide My Email/],
  },
  ru: {
    heading: /<h2>Данные Google и Apple при входе<\/h2>/,
    limitedUse: /соответствуют[^.]*Limited Use/,
    says: [/имя и фамилия/i, /адрес почты/i, /подтвержд/i, /идентификатор/i, /фото профиля/i,
      /Gmail/, /Google Календар/, /Google Контакт/, /Neon/, /не продаём/i, /реклам/i, /обучени/i,
      /Удалить аккаунт/, /настройках аккаунта Google/, /privaterelay\.appleid\.com/, /Скрыть e-mail/],
  },
  es: {
    heading: /<h2>Datos de Google y Apple al iniciar sesión<\/h2>/,
    limitedUse: /cumplen[^.]*Limited Use/,
    says: [/nombre y apellido/i, /dirección de correo/i, /verificad/i, /identificador/i, /foto de perfil/i,
      /Gmail/, /Google Calendar/, /Google Contacts/, /Neon/, /no los vendemos/i, /publicidad/i, /entrenar/i,
      /Eliminar cuenta/, /ajustes de tu cuenta de Google/, /privaterelay\.appleid\.com/, /Ocultar mi correo/],
  },
  de: {
    heading: /<h2>Google- und Apple-Daten bei der Anmeldung<\/h2>/,
    limitedUse: /entspricht[^.]*Limited Use/,
    says: [/Vor- und Nachname/i, /E-Mail-Adresse/i, /bestätig/i, /Kennung/i, /Profilfoto/i,
      /Gmail/, /Google Kalender/, /Google Kontakte/, /Neon/, /verkaufen/i, /Werbung/i, /Training/i,
      /Konto löschen/, /Einstellungen deines Google-Kontos/, /privaterelay\.appleid\.com/, /E-Mail-Adresse verbergen/],
  },
};
const LIMITED_USE = "Rehearsly's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.";
const USER_DATA_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy';

describe.each(LANGS)('Google and Apple sign-in data, %s', lang => {
  const copy = SIGN_IN[lang];

  test('has its own section, saying what is received, why, where it goes and how it is removed', () => {
    const body = part(lang, copy.heading);
    for (const claim of copy.says) expect(body).toMatch(claim);
  });

  test('carries the Limited Use statement word for word, with the link to the policy', () => {
    const body = part(lang, copy.heading);
    expect(body).toContain(LIMITED_USE);
    if (copy.limitedUse) expect(body).toMatch(copy.limitedUse);
    expect(markup('privacy', lang)).toContain(`href="${USER_DATA_POLICY}"`);
  });
});

// The owner's rule: the texts do not guess a person's gender.
const GUESSES = {
  ru: [/занят с \d/, /единственным администратором/, /аккаунт завёл/],
  es: [/estás ocupado/, /«ocupado de/, /el único administrador/, /a un administrador/, /un menor/],
  de: [/der einzige Administrator/i, /einzige\s+Administrator/, /einen Admin\b/, /Teilnehmer(?!in|nde)/],
};
const CYRILLIC_END = '(?![а-яё])';

describe.each(['privacy', 'support'])('%s page does not guess the reader’s gender', page => {
  test.each(Object.keys(GUESSES))('%s', lang => {
    for (const guess of GUESSES[lang]) expect(text(page, lang)).not.toMatch(guess);
  });

  test('ru: no masculine past tense in the first person', () => {
    const body = text(page, 'ru');
    expect(body).not.toMatch(new RegExp(`(^|[^а-яё])я\\s+[а-яё]+л(ся)?${CYRILLIC_END}`, 'i'));
    // A question put in the reader's voice drops the pronoun: "Регистрировался через Google".
    expect(body).not.toMatch(new RegExp(`[а-яё]{3,}[аеиыя]лся${CYRILLIC_END}`, 'i'));
    const questions = [...markup(page, 'ru').matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(([, q]) => q.trim());
    for (const question of questions) {
      expect(question).not.toMatch(new RegExp(`^[А-ЯЁ][а-яё]+л(ся)?${CYRILLIC_END}`));
    }
  });
});
