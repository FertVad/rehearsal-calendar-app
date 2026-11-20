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
    processors: /защищают их не хуже, чем обещает эта политика/,
    signIns: /время последнего входа/i,
    inbox: /Уведомления, отправленные вам[^.]*на экране «Уведомления»/,
    seen: /просмотрен/i,
    ipHash: /хеш вашего IP-адреса/i,
    hostingLogs: /Vercel[^.]*около часа/i,
    restoreHistory: /Neon[^.]*до 7 дней/i,
    keepsImported: /выключить переключатель «Автосинхронизация»[^.]*не удалится/,
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
    restoreHistory: /Neon[^.]*un máximo de 7 días/i,
    keepsImported: /Si desactivas la sincronización automática[^.]*no se borran/,
    oldButton: 'Borrar lo importado',
    cardPromise: /tarjeta|proveedor de pagos/i,
    free: /gratuita[^.]*no ofrece compras/i,
  },
  de: {
    processors: /mindestens so gut/,
    signIns: /Zeitpunkt deiner letzten Anmeldung/i,
    inbox: /Mitteilungen[^.]*Posteingang/i,
    seen: /als gesehen markiert/i,
    ipHash: /mit einem geheimen Schlüssel gebildeter Hash deiner IP-Adresse/i,
    hostingLogs: /Vercel[^.]*etwa eine Stunde/i,
    restoreHistory: /Neon[^.]*bis zu 7 Tage/i,
    keepsImported: /Wenn du Auto-Sync ausschaltest[^.]*nicht gelöscht/i,
    oldButton: 'Importierte löschen',
    cardPromise: /Kartendaten|Zahlungsdienstleister/i,
    free: /kostenlos[^.]*keine In-App-Käufe/i,
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
    // Spanish writes the feature in lower case inside a sentence (its editor).
    expect(text('privacy', lang).toLowerCase()).toContain(calendarSync[lang].autoSync.toLowerCase());
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
    // Not «передача Rehearsly информации»: Rehearsly does not decline, and it
    // read as a dative, the transfer *to* Rehearsly (the ru editor).
    limitedUse: /Rehearsly использует и передаёт информацию[^.]*Limited Use/,
    says: [/имя и фамилия/i, /адрес почты/i, /подтвержд/i, /идентификатор/i, /фото профиля/i,
      /Gmail/, /Google Календар/, /Google Контакт/, /Neon/, /не продаём/i, /реклам/i, /обучени/i,
      /Удалить аккаунт/, /настройках аккаунта Google/, /privaterelay\.appleid\.com/, /Скрыть e-mail/],
  },
  es: {
    heading: /<h2>Datos de Google y Apple al iniciar sesión<\/h2>/,
    limitedUse: /cumplen[^.]*Limited Use/,
    says: [/nombre y apellido/i, /dirección de correo/i, /verificad/i, /identificador/i, /foto de perfil/i,
      /Gmail/, /Google Calendar/, /Contactos de Google/, /Neon/, /no los vendemos/i, /publicidad/i, /entrenar/i,
      /Eliminar cuenta/, /configuración de tu cuenta de Google/, /privaterelay\.appleid\.com/, /Ocultar mi correo/],
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

// T-269 review. A person's name goes into the notifications of those who run a
// project (member joined, new administrator, rehearsal seen), delivered through
// Expo and APNs. The owner's decision (19.11): deleting the account deletes those
// notifications too (T-278, released with this policy); only a push already shown
// on someone else's phone is out of reach. Apple's token comes at every sign-in;
// only the name comes once.
const AFTER_DELETION = {
  en: {
    keeping: /<h2>How long we keep it<\/h2>/,
    deletes: /Deleting your account also removes the notifications with your name/,
    pushStays: /push notification already shown on someone else’s phone stays on that phone/,
    exception: [/One thing stays with other people/, /except your name in notifications/,
      /deleting your account does not remove it/],
    delivery: /Expo Push Service[^.]*APNs[^.]*show your name/,
    promise: 'Delete everything',
    tokenExtras: /do not use or keep them/,
    appleEvery: /Each time you sign in, Apple gives us your account identifier/,
    appleOnce: /Your name comes only once, on your first sign-in, and only if you allow it/,
    appleOld: /your name if you allow it, on your first sign-in only/,
  },
  ru: {
    keeping: /<h2>Сколько храним<\/h2>/,
    deletes: /Удаляются и уведомления с вашим именем, которые получили другие люди/,
    pushStays: /Остаются только push-уведомления, которые уже показаны на чужих телефонах/,
    exception: [/Одно остаётся у других людей/, /кроме вашего имени/, /удаление вашего аккаунта его не затрагивает/],
    delivery: /Expo Push Service[^.]*APNs[^.]*вашим именем/,
    promise: 'Удалить всё',
    tokenExtras: /мы их не используем и не храним/,
    appleEvery: /При каждом входе Apple передаёт нам идентификатор аккаунта/,
    appleOnce: /Имя приходит один раз, при первом входе, и только если вы им поделились/,
    appleOld: /имя, если вы его разрешили, — только при первом входе/,
  },
  es: {
    keeping: /<h2>Cuánto tiempo conservamos tus datos<\/h2>/,
    deletes: /Al eliminar tu cuenta, también borramos esas notificaciones de su bandeja de entrada/,
    pushStays: /notificación push que ya llegó al teléfono de otra persona: permanece en ese teléfono/,
    exception: [/Una cosa permanece en manos de otras personas/, /salvo tu nombre/, /eliminar tu cuenta no la borra/],
    delivery: /Expo Push Service[^.]*APNs[^.]*tu nombre/,
    promise: 'Eliminarlo todo',
    tokenExtras: /no los usamos ni los guardamos/,
    appleEvery: /Cada vez que inicias sesión, Apple nos da el identificador de tu cuenta/,
    appleOnce: /Tu nombre solo llega la primera vez que inicias sesión, y únicamente si lo permites/,
    appleOld: /tu nombre si lo permites, solo la primera vez/,
  },
  de: {
    keeping: /<h2>Wie lange wir sie speichern<\/h2>/,
    deletes: /Löschst du dein Konto, entfernen wir diese Mitteilungen auch aus deren Posteingang/,
    pushStays: /Push-Mitteilungen, die auf deren Geräten schon angezeigt wurden, bleiben allerdings dort/,
    exception: [/Eines bleibt bei anderen Personen/, /außer deinem Namen/, /das Löschen deines Kontos entfernt sie nicht/],
    delivery: /Expo Push Service[^.]*APNs[^.]*deinem Namen/,
    promise: 'Alles löschen',
    tokenExtras: /beides nutzen und speichern wir nicht/,
    appleEvery: /Bei jeder Anmeldung gibt uns Apple deine Kontokennung/,
    appleOnce: /Deinen Namen erhalten wir nur einmal, bei der ersten Anmeldung, und nur, wenn du es erlaubst/,
    appleOld: /deinen Namen, wenn du es erlaubst, nur bei der ersten Anmeldung/,
  },
};

describe.each(LANGS)('what the policy promises about names and Apple, %s', lang => {
  const copy = AFTER_DELETION[lang];
  const signIn = () => part(lang, SIGN_IN[lang].heading);

  test('deleting the account deletes the notifications that carry the name; only a shown push stays', () => {
    const body = part(lang, copy.keeping);
    expect(body).toMatch(copy.deletes);
    expect(body).toMatch(copy.pushStays);
  });

  test('keeps no exception for the name, and promises nothing wider than deletion does', () => {
    const page = text('privacy', lang);
    for (const exception of copy.exception) expect(page).not.toMatch(exception);
    expect(page).not.toContain(copy.promise);
  });

  test('names the delivery services that carry the name', () => {
    expect(signIn()).toMatch(copy.delivery);
  });

  test('does not claim the sign-in token’s photo and language are never read', () => {
    expect(signIn()).toMatch(copy.tokenExtras);
  });

  test('separates what Apple sends at every sign-in from the name it sends once', () => {
    const body = signIn();
    expect(body).toMatch(copy.appleEvery);
    expect(body).toMatch(copy.appleOnce);
    expect(body).not.toMatch(copy.appleOld);
  });
});

// The screens the policy sends people to, by the names the app gives them: the
// German policy sent them to «Profil → Benachrichtigungen», a row the profile
// does not have (it is «Mitteilungen»).
describe.each(LANGS)('the screens are named as the app names them, %s', lang => {
  test('profile rows and the calendar screen', () => {
    const page = text('privacy', lang);
    const { title, notifications, deleteAccount, editProfile } = profile[lang];
    for (const row of [calendarSync[lang].title, notifications, deleteAccount, editProfile]) {
      expect(page).toContain(`${title} → ${row}`);
    }
  });
});

// T-270's button, by the name the screen gives it in each language: the
// policy and the button are one string, so neither changes alone.
const IMPORT_BUTTON = Object.fromEntries(LANGS.map(lang => [lang, calendarSync[lang].clearImported]));

test.each(LANGS)('the calendar screen has the button the policy names, %s', lang => {
  expect(typeof IMPORT_BUTTON[lang]).toBe('string');
  expect(IMPORT_BUTTON[lang].length).toBeGreaterThan(0);
});
const IMPORT_HEADING = {
  en: /<h3>About calendar import<\/h3>/,
  ru: /<h3>Про импорт календаря<\/h3>/,
  es: /<h3>Sobre la importación de calendario<\/h3>/,
  de: /<h3>Zum Kalenderimport<\/h3>/,
};
const RIGHTS = {
  en: /<h2>Your rights<\/h2>/,
  ru: /<h2>Ваши права<\/h2>/,
  es: /<h2>Tus derechos<\/h2>/,
  de: /<h2>Deine Rechte<\/h2>/,
};

describe.each(LANGS)('the button that removes imported busy times, %s', lang => {
  test('is named in the calendar import paragraph', () => {
    expect(part(lang, IMPORT_HEADING[lang])).toContain(IMPORT_BUTTON[lang]);
  });

  test('is a right of its own, on the calendar screen', () => {
    const rights = part(lang, RIGHTS[lang]);
    expect(rights).toContain(IMPORT_BUTTON[lang]);
    expect(rights).toContain(`${profile[lang].title} → ${calendarSync[lang].title} →`);
  });
});

// The owner's decision (19.11): material changes are emailed to the account's
// address before they take effect, so Resend's line names that purpose too.
const CHANGES = {
  en: {
    email: /Before a material change takes effect, we will also email you about it at your account’s email address/,
    resend: /Resend[^.;]*notices of material changes/,
    inApp: /notify you in the app/,
  },
  ru: {
    email: /О существенных изменениях мы заранее напишем на адрес почты вашего аккаунта — до того, как они вступят в силу/,
    resend: /Resend[^.;]*писем о существенных изменениях/,
    inApp: /сообщим об этом в приложении/,
  },
  es: {
    email: /te avisaremos además por correo, a la dirección de tu cuenta, antes de que entren en vigor/,
    resend: /Resend[^.;]*avisos de cambios sustanciales/,
    inApp: /te avisaremos en la aplicación/,
  },
  de: {
    email: /Über wesentliche Änderungen informieren wir dich per E-Mail an die Adresse deines Kontos, bevor sie in Kraft treten/,
    resend: /Resend[^.;]*wesentliche Änderungen/,
    inApp: /weisen in der App darauf hin/,
  },
};

describe.each(LANGS)('changes to the policy, %s', lang => {
  test('are emailed before they take effect, and Resend is named as sending them', () => {
    const page = text('privacy', lang);
    expect(page).toMatch(CHANGES[lang].email);
    expect(page).toMatch(CHANGES[lang].resend);
    expect(page).not.toMatch(CHANGES[lang].inApp);
  });
});

// Checked against the code and Apple's and Google's help (E8–E14): the IP hash
// is written on every /api/auth request (app.js), not only at sign-in; two
// per-minute counters are tied to the account (native_invite_account_rate_limits,
// native_member_availability_rate_limits); the seen marks are shown to everyone
// on the rehearsal (rehearsals.js, viewerOf); Google and Apple send us data and
// receive none; Apple's revocation reaches no handler on the server; Google's
// page is now linkedapps; Hide My Email has two domains.
const FACTS = {
  en: {
    ipEveryRequest: /other account requests from the app/,
    counters: /Two request counters linked to your account/,
    seenByRehearsal: /others on the same rehearsal/,
    fromUs: /each of these providers that receives your data from us/,
    appleKeeps: /As with Google, this does not delete what we already hold/,
  },
  ru: {
    ipEveryRequest: /других запросах к аккаунту/,
    counters: /Два счётчика запросов, привязанные к аккаунту/,
    seenByRehearsal: /остальным участникам репетиции/,
    fromUs: /те из этих сервисов, которые получают ваши данные от нас/,
    appleKeeps: /Как и в случае с Google, это не удаляет то, что уже хранится у нас/,
  },
  es: {
    ipEveryRequest: /otras gestiones de tu cuenta/,
    counters: /Dos contadores de peticiones vinculados a tu cuenta/,
    seenByRehearsal: /a los demás participantes del ensayo/,
    fromUs: /cada proveedor al que enviamos tus datos/,
    appleKeeps: /Igual que con Google, eso no borra lo que ya tenemos/,
  },
  de: {
    ipEveryRequest: /anderen Anfragen zu deinem Konto/,
    counters: /Zwei Anfragezähler, die mit deinem Konto verknüpft sind/,
    seenByRehearsal: /für die Probe eingeteilt sind/,
    fromUs: /Jeder dieser Dienste, der deine Daten von uns erhält/,
    appleKeeps: /Wie bei Google löscht das nicht, was wir bereits gespeichert haben/,
  },
};

describe.each(LANGS)('what was checked against the code and the providers’ help, %s', lang => {
  const facts = FACTS[lang];

  test('the IP hash on every account request, and the two counters tied to the account', () => {
    const page = text('privacy', lang);
    expect(page).toMatch(facts.ipEveryRequest);
    expect(page).toMatch(facts.counters);
    expect(page).not.toContain('Smart Planner');
  });

  test('the seen marks are shown to the others on the rehearsal too', () => {
    expect(text('privacy', lang)).toMatch(facts.seenByRehearsal);
  });

  test('the equal-protection promise covers the providers that receive data from us', () => {
    expect(text('privacy', lang)).toMatch(facts.fromUs);
  });

  test('leaving Sign in with Apple deletes nothing; Google’s page is linked apps', () => {
    expect(part(lang, SIGN_IN[lang].heading)).toMatch(facts.appleKeeps);
    const html = markup('privacy', lang);
    expect(html).toContain('href="https://myaccount.google.com/linkedapps"');
    expect(html).not.toContain('myaccount.google.com/connections');
  });

  test('Hide My Email has both of Apple’s domains', () => {
    const body = part(lang, SIGN_IN[lang].heading);
    expect(body).toContain('@privaterelay.appleid.com');
    expect(body).toContain('@private.icloud.com');
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
