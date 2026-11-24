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

// T-293: the admin's statistics are a purpose of their own, named in every language.
// T-295: the whole list of what they read (rehearsals created, the introduction,
// calendar sync used either way), overall and per account, and what they show
// (notifications and email codes reaching people).
// T-294: two records are collected only for them — the days in the app with its
// version, and the invitation counts — so the section names them instead of
// "nothing extra", and the lede no longer says "only what the app needs".
const STATISTICS = {
  en: { heading: 'Internal statistics',
    purpose: /also use some of the data listed above for statistics, both overall and for each account, on our own admin page/,
    shows: /how people come to Rehearsly[^.]*first steps[^.]*projects are doing[^.]*notifications and email codes reach people[^.]*how often people use the app and which versions of it are still in use/,
    onlyForThem: /Two of these records are collected only for the statistics: the days you use the app with its version, and the invitation counts \(no IP addresses, not linked to anyone\)/,
    onlyOperator: /Only the person who runs Rehearsly sees these statistics/, noThirdParty: /not shared with third parties[^.]*no third-party analytics SDK/,
    reads: [/finished or skipped the app’s introduction/, /including which ones you created and which you have marked as seen/,
      /whether you have used calendar sync/, /the notifications in your in-app inbox/, /the days you have used the app with its version/,
      /for each project, the counts of how often its invitation is opened and how many people join through it/],
    signInWhy: /still in use, and for the internal statistics/, updated: 'Last updated: November 25, 2026',
    lede: /keeps what it needs to run the app and schedule rehearsals, plus two records for its internal statistics, described below: the days you use the app, and counts of how often invitations are opened and how many people join through them\./,
    elseKept: /Everything else on this list is kept anyway, for the purposes given in the table above/,
    wasOnly: /keeps only what it needs|Nothing extra is collected|kept to run the app anyway/ },
  ru: { heading: 'Внутренняя статистика',
    purpose: /Часть перечисленных выше данных мы используем и для статистики в нашей собственной панели администратора/,
    shows: /как люди приходят в Rehearsly[^.]*первые шаги[^.]*как живут проекты[^.]*доходят ли до людей уведомления и письма с кодами[^.]*как часто пользуются приложением и какие его версии ещё в ходу/,
    onlyForThem: /Только для неё мы собираем две вещи: дни, когда вы пользуетесь приложением, с его версией, а также счётчики приглашений \(без IP-адресов и без связи с человеком\)/,
    onlyOperator: /Эту статистику видит только тот, кто отвечает за Rehearsly/, noThirdParty: /Третьим лицам она не передаётся[^.]*сторонние SDK аналитики/,
    reads: [/Статистика строится как в целом, так и по каждому аккаунту/, /прошли или пропустили знакомство с приложением/,
      /какие из них создали вы и какие отметили как просмотренные/, /пользовались ли вы синхронизацией календаря/,
      /дни, когда вы пользовались приложением, и его версию/, /по каждому проекту — счётчики открытий его приглашения и присоединений по нему/],
    signInWhy: /ещё пользуются, и составлять внутреннюю статистику \(о ней ниже\)/, updated: 'Обновлено: 25 ноября 2026 г.',
    lede: /хранит то, что нужно для работы приложения и планирования репетиций, и несколько записей для внутренней статистики: дни, когда вы пользуетесь приложением, и счётчики открытий приглашений и присоединений по ним \(о них ниже\)/,
    elseKept: /Всё остальное из этого списка хранится и так — для целей, указанных в таблице выше/,
    wasOnly: /хранит только то|Дополнительных данных для неё мы не собираем|хранится и так — для работы приложения/ },
  es: { heading: 'Estadísticas internas',
    purpose: /también se usan para elaborar estadísticas en nuestro propio panel de administración, tanto en conjunto como para cada cuenta/,
    shows: /cómo llegan las personas a Rehearsly[^.]*primeros pasos[^.]*cómo marchan los proyectos[^.]*con qué frecuencia se usa la aplicación y qué versiones siguen en uso/,
    onlyForThem: /Solo para ellas se recopilan dos cosas: los días en que usas la aplicación, con su versión, y los recuentos de las invitaciones \(sin direcciones IP y sin vínculo con ninguna persona\)/,
    onlyOperator: /Solo la persona que gestiona Rehearsly ve estas estadísticas/, noThirdParty: /No se comparten con terceros[^.]*ningún SDK de análisis de terceros/,
    reads: [/si has completado u omitido la introducción de la aplicación/, /cuáles has creado tú y cuáles has marcado como vistos/,
      /si has usado la sincronización de calendario/, /llegan a sus destinatarios/, /los días en que has usado la aplicación y su versión/,
      /de cada proyecto, cuántas veces se ha abierto su invitación y cuántas personas se han unido con ella/],
    signInWhy: /siguen en uso y elaborar las estadísticas internas/, updated: 'Última actualización: 25 de noviembre de 2026',
    lede: /guarda lo que necesita para funcionar y para planificar ensayos, además de unos pocos registros para sus estadísticas internas: los días en que usas la aplicación, cuántas veces se abren las invitaciones y cuántas personas se unen con ellas \(se describen más abajo\)/,
    elseKept: /Todo lo demás de esta lista se guarda de todos modos, para los fines indicados en la tabla de arriba/,
    wasOnly: /y nada más|no se recopila ningún dato adicional|para que la aplicación funcione\./ },
  de: { heading: 'Interne Statistik',
    purpose: /nutzen wir auch für Statistiken in unserem eigenen Admin-Bereich, sowohl insgesamt als auch für jedes einzelne Konto/,
    shows: /wie Menschen zu Rehearsly kommen[^.]*ersten Schritte[^.]*wie es den Projekten geht[^.]*ob Mitteilungen und E-Mail-Codes ankommen[^.]*wie oft die App genutzt wird und welche Versionen noch im Einsatz sind/,
    onlyForThem: /Nur dafür erheben wir zwei Dinge: an welchen Tagen du die App nutzt, samt App-Version, und die Zählungen der Einladungen \(ohne IP-Adressen und ohne Verbindung zu einer Person\)/,
    onlyOperator: /Diese Statistiken sieht nur die Person, die Rehearsly betreibt/, noThirdParty: /nicht an Dritte weitergegeben[^.]*kein Analyse-SDK eines Drittanbieters/,
    reads: [/ob du die Einführung in die App abgeschlossen oder übersprungen hast/, /welche davon du angelegt und welche du als gesehen markiert hast/,
      /ob du die Kalendersynchronisation genutzt hast/, /an welchen Tagen du die App genutzt hast und mit welcher Version/,
      /für jedes Projekt, wie oft seine Einladung geöffnet wurde und wie viele darüber beigetreten sind/],
    signInWhy: /noch genutzt werden, und die unten beschriebene interne Statistik erstellen/, updated: 'Zuletzt aktualisiert: 25. November 2026',
    lede: /speichert, was für den Betrieb der App und die Probenplanung nötig ist, und dazu einige wenige Einträge für die interne Statistik: an welchen Tagen du die App nutzt, wie oft Einladungen geöffnet werden und wie viele darüber beitreten \(siehe unten\)/,
    elseKept: /Alles andere in dieser Liste wird ohnehin gespeichert, für die Zwecke in der Tabelle oben/,
    wasOnly: /und nicht mehr|keine zusätzlichen Daten erhoben|ohnehin für den Betrieb der App gespeichert/ },
};

// T-294: the two records in "What we collect" — what, why, when, how long; the
// days go with the account, the counts carry no IP and no person.
const USAGE_ROWS = {
  en: [['The days you use the app, with the app version on each of them. Kept for no longer than 13 months and deleted with your account',
    'To see how often Rehearsly is used and which versions of the app are still in use',
    'When the app, signed in to your account, contacts our server'],
  ['Daily counts of how often each project’s invitation is opened — in a browser and in the app — and how many people join through it. No IP addresses, and nothing that links a count to a person. Kept for no longer than 13 months and deleted with its project',
    'To see how invitations bring people into projects', 'When an invitation is opened or someone joins through it']],
  ru: [['Дни, когда вы пользовались приложением, и версия приложения в каждый из них. Хранятся не дольше 13 месяцев и удаляются вместе с аккаунтом',
    'Видеть, как часто пользуются Rehearsly и какие версии приложения ещё в ходу',
    'Когда приложение, в котором вы вошли в аккаунт, обращается к нашему серверу'],
  ['Счётчики по дням: сколько раз открыли приглашение в каждый проект — в браузере и в приложении — и сколько человек по нему присоединилось. Без IP-адресов и без связи с конкретным человеком. Хранятся не дольше 13 месяцев и удаляются вместе с проектом',
    'Видеть, как приглашения приводят людей в проекты', 'Когда приглашение открывают или по нему присоединяются']],
  es: [['Los días en que usas la aplicación, con la versión de la aplicación de cada uno. Se conservan como máximo 13 meses y se borran junto con tu cuenta',
    'Ver con qué frecuencia se usa Rehearsly y qué versiones de la aplicación siguen en uso',
    'Cuando la aplicación, con tu sesión iniciada, se comunica con nuestro servidor'],
  ['Recuentos diarios de cuántas veces se abre la invitación de cada proyecto —en el navegador y en la aplicación— y de cuántas personas se unen con ella. Sin direcciones IP y sin nada que vincule un recuento con una persona. Se conservan como máximo 13 meses y se borran junto con su proyecto',
    'Ver cómo las invitaciones atraen a personas a los proyectos', 'Cuando se abre una invitación o alguien se une con ella']],
  de: [['Die Tage, an denen du die App nutzt, jeweils mit der App-Version. Höchstens 13 Monate gespeichert und mit deinem Konto gelöscht',
    'Sehen, wie oft Rehearsly genutzt wird und welche App-Versionen noch im Einsatz sind',
    'Wenn die App, in der du angemeldet bist, unseren Server kontaktiert'],
  ['Tägliche Zählungen, wie oft die Einladung eines Projekts geöffnet wurde – im Browser und in der App – und wie viele darüber beigetreten sind. Ohne IP-Adressen und ohne etwas, das eine Zählung mit einer Person verbindet. Höchstens 13 Monate gespeichert und mit dem jeweiligen Projekt gelöscht',
    'Sehen, wie Einladungen Menschen in Projekte bringen', 'Wenn eine Einladung geöffnet wird oder jemand darüber beitritt']],
};

// T-294: "How long we keep it" — the days in the app with their version are
// among what goes with the account; the days and the invitation counts are kept
// at most 13 months, and the counts also go with their project.
const RETENTION = {
  en: [/project memberships, and the days you used the app with its version — is removed from our database/,
    /The days you use the app and the invitation counts are kept for no longer than 13 months, and the counts of an invitation are also deleted with its project/],
  ru: [/участие в проектах, дни, когда вы пользовались приложением, с его версией/,
    /Дни использования приложения и счётчики приглашений хранятся не дольше 13 месяцев, а счётчики удаляются и вместе со своим проектом/],
  es: [/pertenencia a proyectos, así como los días en que usaste la aplicación, con su versión/,
    /Los días de uso de la aplicación y los recuentos de las invitaciones se conservan como máximo 13 meses, y los recuentos de una invitación se borran también junto con su proyecto/],
  de: [/Projektmitgliedschaften, außerdem die Tage, an denen du die App genutzt hast, samt App-Version/,
    /Die Tage der App-Nutzung und die Zählungen der Einladungen speichern wir höchstens 13 Monate, und die Zählungen einer Einladung werden außerdem mit ihrem Projekt gelöscht/],
};

// T-298: the native speakers' fixes, by meaning. The days row records only a day
// and a version, so it shows how *often* the app is used, not how; both new rows
// keep their records *at most* 13 months, as "How long we keep it" says, never a
// bare "13 months"; and the lede calls them the *internal* statistics, the name
// of the section, not "own statistics".
const NATIVE = {
  en: { often: 'To see how often Rehearsly is used', atMost: 'Kept for no longer than 13 months', months: /13 months/,
    lede: /records for its internal statistics/, ledeWas: /own statistics/ },
  ru: { often: 'Видеть, как часто пользуются Rehearsly', atMost: 'Хранятся не дольше 13 месяцев', months: /13 месяцев/,
    lede: /записей для внутренней статистики/, ledeWas: /собственной статистики/ },
  es: { often: 'Ver con qué frecuencia se usa Rehearsly', atMost: 'Se conservan como máximo 13 meses', months: /13 meses/,
    lede: /registros para sus estadísticas internas/, ledeWas: /propias estadísticas/ },
  de: { often: 'Sehen, wie oft Rehearsly genutzt wird', atMost: 'Höchstens 13 Monate gespeichert', months: /13 Monate/,
    lede: /Einträge für die interne Statistik/, ledeWas: /eigene Statistik/ },
};

// T-295: the rows for what the app keeps about calendar export and the
// introduction, each right after the row it belongs beside, and the export
// records named among what goes with the account. `after` is the start of the
// row before; text() leaves one space between cells.
const ROWS = {
  en: {
    exported: ['Which rehearsals Rehearsly has added to your phone’s calendar, with technical identifiers of that calendar and of each event',
      'So that the next sync updates those events instead of adding copies, and so that they can be removed later',
      'Only if you turn on calendar sync'],
    exportedAfter: 'Start and end times of your calendar events',
    introduction: ['Whether you have finished or skipped the app’s introduction', 'To show the introduction only once', 'When you finish or skip it'],
    introductionAfter: 'Time zone, language, first day of the week',
    keeping: /<h2>How long we keep it<\/h2>/,
    goesWithAccount: /the record of which rehearsals were added to\s+your phone’s calendar/,
  },
  ru: {
    exported: ['Какие репетиции Rehearsly добавил в календарь вашего телефона — с техническими идентификаторами этого календаря и каждого события',
      'Чтобы следующая синхронизация не добавила копии, а обновила эти события и чтобы их потом можно было удалить',
      'Только если включена синхронизация календаря'],
    exportedAfter: 'Время начала и окончания событий календаря',
    introduction: ['Отметка о том, что вы прошли или пропустили знакомство с приложением',
      'Показывать знакомство с приложением только один раз', 'Когда вы проходите или пропускаете его'],
    introductionAfter: 'Часовой пояс, язык, начало недели',
    keeping: /<h2>Сколько храним<\/h2>/,
    goesWithAccount: /записи о том, какие репетиции\s+добавлены в календарь вашего телефона/,
  },
  es: {
    exported: ['Los ensayos que Rehearsly ha añadido al calendario de tu teléfono, con identificadores técnicos de ese calendario y de cada evento',
      'Actualizar esos eventos en la siguiente sincronización, en lugar de duplicarlos, y poder eliminarlos más adelante',
      'Solo si activas la sincronización de calendario'],
    exportedAfter: 'Hora de inicio y fin de los eventos de tu calendario',
    introduction: ['Si has completado u omitido la introducción de la aplicación', 'Mostrar la introducción una sola vez',
      'Cuando la completas o la omites'],
    introductionAfter: 'Zona horaria, idioma, inicio de la semana',
    keeping: /<h2>Cuánto tiempo conservamos tus datos<\/h2>/,
    goesWithAccount: /registro de los ensayos añadidos al calendario de tu teléfono/,
  },
  de: {
    exported: ['Welche Proben Rehearsly in den Kalender auf deinem iPhone eingetragen hat, sowie technische Kennungen dieses Kalenders und jedes Termins',
      'Damit die nächste Synchronisation diese Termine aktualisiert, statt sie doppelt einzutragen, und damit sie sich später wieder entfernen lassen',
      'Nur wenn du die Kalendersynchronisation einschaltest'],
    exportedAfter: 'Beginn und Ende deiner Kalendertermine',
    introduction: ['Ob du die Einführung in die App abgeschlossen oder übersprungen hast', 'Die Einführung nur einmal anzeigen',
      'Wenn du sie abschließt oder überspringst'],
    introductionAfter: 'Zeitzone, Sprache, Wochenbeginn',
    keeping: /<h2>Wie lange wir sie speichern<\/h2>/,
    goesWithAccount: /der Vermerk, welche Proben in den Kalender auf deinem iPhone eingetragen wurden/,
  },
};

// T-295: no analytics or tracking SDK in the app — in the lede and in what is
// not collected, as wide as the English (ru had narrowed it to «third-party»).
const NO_SDK = {
  en: { lede: /no analytics or tracking SDKs in the app/, notCollected: /No advertising identifiers, no analytics or tracking SDKs/ },
  ru: { lede: /в приложении нет SDK ни для аналитики, ни для отслеживания/,
    notCollected: /Рекламные идентификаторы и SDK для аналитики и отслеживания — их в приложении нет/ },
  es: { lede: /la aplicación no incluye ningún SDK de análisis ni de rastreo/,
    notCollected: /Identificadores publicitarios ni datos a través de SDK de análisis o de rastreo/ },
  de: { lede: /die App enthält weder Analyse- noch Tracking-SDKs/, notCollected: /Werbe-IDs, Analyse- oder Tracking-SDKs/ },
};

describe.each(LANGS)('privacy policy, %s', lang => {
  const copy = COPY[lang];

  test('names the internal statistics as a purpose: what they use, who sees them, nothing to third parties', () => {
    const statistics = STATISTICS[lang];
    const page = text('privacy', lang);
    expect(markup('privacy', lang)).toContain(`<h3>${statistics.heading}</h3>`);
    for (const key of ['purpose', 'shows', 'onlyForThem', 'elseKept', 'onlyOperator', 'noThirdParty', 'signInWhy', 'lede']) {
      expect(page).toMatch(statistics[key]);
    }
    for (const claim of statistics.reads) expect(page).toMatch(claim);
    expect(page).toContain(statistics.updated);
    // No longer true once the app's days are recorded for statistics (T-294).
    expect(page).not.toMatch(statistics.wasOnly);
  });

  test('lists the days in the app and the invitation counts in what we collect, with how long they are kept', () => {
    const html = markup('privacy', lang).replace(/\s+/g, ' ');
    for (const row of USAGE_ROWS[lang]) {
      expect(html).toContain(`<tr> ${row.map(cell => `<td>${cell}</td>`).join(' ')} </tr>`);
    }
  });

  test('says how often the app is used, at most 13 months in both rows, and "internal statistics" in the lede', () => {
    const native = NATIVE[lang];
    const html = markup('privacy', lang).replace(/\s+/g, ' ');
    const cells = [...html.matchAll(/<td>([^<]*)<\/td>/g)].map(match => match[1]);
    // The days row says why: how often.
    expect(cells.filter(cell => cell.startsWith(native.often))).toHaveLength(1);
    // Every table cell with a 13-month term is one of the two rows, and says "at most".
    const terms = cells.filter(cell => native.months.test(cell));
    expect(terms).toHaveLength(2);
    for (const cell of terms) expect(cell).toContain(native.atMost);
    // The lede names the section's own term.
    const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(html)[1];
    expect(lede).toMatch(native.lede);
    expect(lede).not.toMatch(native.ledeWas);
  });

  test('says how long the days in the app and the invitation counts are kept, and what deletes them', () => {
    const page = text('privacy', lang);
    for (const claim of RETENTION[lang]) expect(page).toMatch(claim);
  });

  test('has a row for the calendar export records and one for the introduction, each beside its neighbour', () => {
    const rows = ROWS[lang];
    const html = markup('privacy', lang).replace(/\s+/g, ' ');
    for (const [row, after] of [[rows.exported, rows.exportedAfter], [rows.introduction, rows.introductionAfter]]) {
      // The three cells, in order, in one row.
      const at = html.indexOf(`<tr> ${row.map(cell => `<td>${cell}</td>`).join(' ')} </tr>`);
      expect(at).toBeGreaterThan(0);
      // The row before is the one named: exactly one row starts between them.
      const before = html.lastIndexOf(`<td>${after}`, at);
      expect(before).toBeGreaterThan(0);
      expect(html.slice(before, at + 4).match(/<tr>/g)).toHaveLength(1);
    }
  });

  test('names the calendar export records among what goes with the account', () => {
    expect(part(lang, ROWS[lang].keeping)).toMatch(ROWS[lang].goesWithAccount);
  });

  test('says the app has no analytics or tracking SDK, in the lede and in what is not collected', () => {
    const page = text('privacy', lang);
    expect(page).toMatch(NO_SDK[lang].lede);
    expect(page).toMatch(NO_SDK[lang].notCollected);
  });

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
      /Delete Account/, /Google Account settings/, /privaterelay\.appleid\.com/, /Hide My Email/,
      /include your account in the internal statistics described above/],
  },
  ru: {
    heading: /<h2>Данные Google и Apple при входе<\/h2>/,
    // Not «передача Rehearsly информации»: Rehearsly does not decline, and it
    // read as a dative, the transfer *to* Rehearsly (the ru editor).
    limitedUse: /Rehearsly использует и передаёт информацию[^.]*Limited Use/,
    says: [/имя и фамилия/i, /адрес почты/i, /подтвержд/i, /идентификатор/i, /фото профиля/i,
      /Gmail/, /Google Календар/, /Google Контакт/, /Neon/, /не продаём/i, /реклам/i, /обучени/i,
      /Удалить аккаунт/, /настройках аккаунта Google/, /privaterelay\.appleid\.com/, /Скрыть e-mail/,
      /учитывать ваш аккаунт во внутренней статистике \(о ней выше\)/],
  },
  es: {
    heading: /<h2>Datos de Google y Apple al iniciar sesión<\/h2>/,
    limitedUse: /cumplen[^.]*Limited Use/,
    says: [/nombre y apellido/i, /dirección de correo/i, /verificad/i, /identificador/i, /foto de perfil/i,
      /Gmail/, /Google Calendar/, /Contactos de Google/, /Neon/, /no los vendemos/i, /publicidad/i, /entrenar/i,
      /Eliminar cuenta/, /configuración de tu cuenta de Google/, /privaterelay\.appleid\.com/, /Ocultar mi correo/,
      /e incluir tu cuenta en las estadísticas internas/],
  },
  de: {
    heading: /<h2>Google- und Apple-Daten bei der Anmeldung<\/h2>/,
    limitedUse: /entspricht[^.]*Limited Use/,
    says: [/Vor- und Nachname/i, /E-Mail-Adresse/i, /bestätig/i, /Kennung/i, /Profilfoto/i,
      /Gmail/, /Google Kalender/, /Google Kontakte/, /Neon/, /verkaufen/i, /Werbung/i, /Training/i,
      /Konto löschen/, /Einstellungen deines Google-Kontos/, /privaterelay\.appleid\.com/, /E-Mail-Adresse verbergen/,
      /deinen Namen zu zeigen und dein Konto in die oben beschriebene interne Statistik einzubeziehen/],
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
