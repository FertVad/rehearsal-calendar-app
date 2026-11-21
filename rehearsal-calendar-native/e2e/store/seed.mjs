/**
 * The world the App Store's screenshots show (T-274), one for each language
 * of the store's pages — on the e2e runner's throwaway database and its local
 * server, never anything real (e2e/run.mjs --store=<locale>).
 *
 * People made up, with names natural to the language; a play in the public
 * domain (Shakespeare, Chekhov, Lorca, Kleist), a concert and a music video;
 * the director runs all three and is the one signed in. Accounts are inserted
 * with their addresses confirmed, as e2e/seed.mjs does (registering needs a
 * mailed code); everything after that goes through the server's API as the
 * app sends it: the projects, the joins by invite, everyone's busy times, the
 * rehearsals and the "seen" marks.
 *
 * What the frames need of it:
 * - the Planner's first day shows all four levels — nobody busy, up to 25 %,
 *   up to 50 %, more than 50 % — in its first hours (busyBlocks);
 *   busy times for everyone in the play over the next four weeks;
 * - the director's own month has days and hours marked (frame 2);
 * - a slot where some of the cast are busy, for the form (frame 3: FORM_DAY,
 *   FORM_TIME);
 * - a rehearsal of 8 of whom 5 marked it seen: "5 of 8" on screen, as frame 5's
 *   caption says (SEEN_REHEARSAL);
 * - a rehearsal of all 12, nobody's mark on it yet, for the video's counter
 *   that runs to 12 of 12 (T-275; EVERYONE_REHEARSAL);
 * - rehearsals ahead in all three projects (frame 6), each seen by some of
 *   its cast and not all (seenBy; since T-286, after the screenshots were
 *   approved: README).
 *
 * Times are the world's zone's (seedStore), every profile in it.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASSWORD, zoneDate, zoneInstant } from '../seed.mjs';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'server');
const bcrypt = createRequire(path.join(SERVER, 'package.json'))('bcrypt');

/**
 * Each store page's world. `language` is the account's (the app's four);
 * `clock24` the phone's, as a phone of that country is set; `appleLocale` and
 * `appleLanguage` the phone's region and language for iOS's own words.
 * People: the director, then the eleven of the play, two musicians and one of
 * the film crew (the video's); three of the play play in the concert. `words`: the app's own words the flow taps where there is no
 * id to take — iOS's action sheet, the calendar's provider, the conflict
 * alert's "Create Anyway" (the video, T-275) — as src/i18n/translations has them.
 */
const WORLDS = {
  'en-US': {
    language: 'en', clock24: false, appleLocale: 'en_US', appleLanguage: 'en-US', zone: 'America/New_York',
    director: ['Emily', 'Carter'], email: 'emily.carter@example.com',
    cast: [['James', 'Miller'], ['Olivia', 'Johnson'], ['Michael', 'Brown'], ['Sophia', 'Davis'], ['Daniel', 'Wilson'],
      ['Ava', 'Martinez'], ['Ethan', 'Anderson'], ['Mia', 'Thompson'], ['Noah', 'Garcia'], ['Chloe', 'Robinson'], ['Lucas', 'White']],
    musicians: [['Grace', 'Lee'], ['Ryan', 'Clark']],
    crew: [['Hannah', 'Lewis']],
    play: ['Twelfth Night', 'Spring production'],
    concert: ['Spring Gala Concert', 'City Hall, May'],
    clip: ['Music Video “Northern Lights”', 'Two shoot days'],
    titles: {
      play: ['Act I run-through', 'Full run-through', 'Blocking: Act II', 'Scene work'],
      concert: ['Band rehearsal', 'Sound check'],
      clip: ['Choreography', 'Shoot day 1', 'Shoot day 2'],
    },
    places: { play: 'Main stage', concert: 'Rehearsal room', clip: 'Studio B' },
    words: { markBusy: 'Mark Busy', apple: 'Apple Calendar', showCode: 'Show Code', createAnyway: 'Create Anyway' },
  },
  'en-GB': {
    language: 'en', clock24: true, appleLocale: 'en_GB', appleLanguage: 'en-GB', zone: 'Europe/London',
    director: ['Charlotte', 'Hughes'], email: 'charlotte.hughes@example.com',
    cast: [['Oliver', 'Bennett'], ['Amelia', 'Clarke'], ['Harry', 'Wright'], ['Isla', 'Turner'], ['George', 'Walker'],
      ['Poppy', 'Edwards'], ['Alfie', 'Morgan'], ['Freya', 'Cooper'], ['Jack', 'Phillips'], ['Imogen', 'Ward'], ['Archie', 'Hall']],
    musicians: [['Rosie', 'Evans'], ['Callum', 'Baker']],
    crew: [['Eleanor', 'Price']],
    // Short: frame 7's header has room for about twenty letters.
    play: ['The Tempest', 'Summer production'],
    concert: ['Winter Concert', 'Town hall, December'],
    clip: ['Music Video “Harbour Lights”', 'Two shoot days'],
    titles: {
      play: ['Act I run-through', 'Full run-through', 'Blocking: Act II', 'Scene work'],
      concert: ['Band rehearsal', 'Sound check'],
      clip: ['Choreography', 'Shoot day 1', 'Shoot day 2'],
    },
    places: { play: 'Main stage', concert: 'Rehearsal room', clip: 'Studio B' },
    words: { markBusy: 'Mark Busy', apple: 'Apple Calendar', showCode: 'Show Code', createAnyway: 'Create Anyway' },
  },
  ru: {
    language: 'ru', clock24: true, appleLocale: 'ru_RU', appleLanguage: 'ru-RU', zone: 'Europe/Moscow',
    director: ['Анна', 'Соколова'], email: 'anna.sokolova@example.com',
    cast: [['Дмитрий', 'Орлов'], ['Мария', 'Белова'], ['Алексей', 'Смирнов'], ['Екатерина', 'Волкова'], ['Иван', 'Кузнецов'],
      ['Ольга', 'Морозова'], ['Сергей', 'Павлов'], ['Наталья', 'Козлова'], ['Андрей', 'Лебедев'], ['Татьяна', 'Егорова'], ['Павел', 'Николаев']],
    musicians: [['Елена', 'Фёдорова'], ['Михаил', 'Степанов']],
    crew: [['Юлия', 'Васильева']],
    play: ['Чайка', 'Весенняя премьера'],
    concert: ['Весенний концерт', 'Дом культуры, май'],
    clip: ['Клип «Белые ночи»', 'Два съёмочных дня'],
    titles: {
      play: ['Прогон первого акта', 'Общий прогон', 'Разводка второго акта', 'Работа над сценами'],
      concert: ['Репетиция ансамбля', 'Саундчек'],
      clip: ['Хореография', 'Съёмочный день 1', 'Съёмочный день 2'],
    },
    places: { play: 'Большая сцена', concert: 'Репетиционный зал', clip: 'Студия' },
    words: { markBusy: 'Отметить занятость', apple: 'Календарь iPhone', showCode: 'Показать код', createAnyway: 'Создать всё равно' },
  },
  'es-ES': {
    language: 'es', clock24: true, appleLocale: 'es_ES', appleLanguage: 'es-ES', zone: 'Europe/Madrid',
    director: ['Lucía', 'Fernández'], email: 'lucia.fernandez@example.com',
    cast: [['Pablo', 'García'], ['Carmen', 'López'], ['Javier', 'Martín'], ['Elena', 'Sánchez'], ['Diego', 'Romero'],
      ['Marta', 'Navarro'], ['Álvaro', 'Torres'], ['Sara', 'Ruiz'], ['Hugo', 'Molina'], ['Paula', 'Ortega'], ['Adrián', 'Delgado']],
    musicians: [['Irene', 'Castro'], ['Sergio', 'Vidal']],
    crew: [['Laura', 'Gil']],
    play: ['Bodas de sangre', 'Estreno de primavera'],
    concert: ['Concierto de primavera', 'Auditorio, mayo'],
    clip: ['Videoclip «Luna nueva»', 'Dos días de rodaje'],
    titles: {
      play: ['Pasada del primer acto', 'Pasada general', 'Marcaje del segundo acto', 'Trabajo de escenas'],
      concert: ['Ensayo con la banda', 'Prueba de sonido'],
      clip: ['Coreografía', 'Rodaje, día 1', 'Rodaje, día 2'],
    },
    places: { play: 'Sala principal', concert: 'Sala de ensayo', clip: 'Estudio B' },
    words: { markBusy: 'Marcar horas ocupadas', apple: 'Apple Calendar', showCode: 'Mostrar el código', createAnyway: 'Crear de todos modos' },
  },
  'de-DE': {
    language: 'de', clock24: true, appleLocale: 'de_DE', appleLanguage: 'de-DE', zone: 'Europe/Berlin',
    director: ['Katharina', 'Schneider'], email: 'katharina.schneider@example.com',
    cast: [['Jonas', 'Becker'], ['Lena', 'Hoffmann'], ['Felix', 'Wagner'], ['Sophie', 'Fischer'], ['Lukas', 'Schulz'],
      ['Hannah', 'Weber'], ['Maximilian', 'Koch'], ['Laura', 'Richter'], ['Paul', 'Neumann'], ['Marie', 'Wolf'], ['Tim', 'Braun']],
    musicians: [['Julia', 'Zimmermann'], ['Jan', 'Krüger']],
    crew: [['Anna', 'Hartmann']],
    play: ['Der zerbrochne Krug', 'Frühjahrspremiere'],
    concert: ['Frühlingskonzert', 'Stadthalle, Mai'],
    clip: ['Musikvideo „Nachtfahrt“', 'Zwei Drehtage'],
    titles: {
      play: ['Durchlauf 1. Akt', 'Hauptprobe', 'Stellprobe 2. Akt', 'Szenenarbeit'],
      concert: ['Bandprobe', 'Soundcheck'],
      clip: ['Choreografie', 'Drehtag 1', 'Drehtag 2'],
    },
    places: { play: 'Große Bühne', concert: 'Probenraum', clip: 'Studio B' },
    words: { markBusy: 'Als beschäftigt markieren', apple: 'Apple Kalender', showCode: 'Code anzeigen', createAnyway: 'Trotzdem erstellen' },
  },
};

/** The four levels by how many of the play's twelve are busy: none, ≤25 %, ≤50 %, more. */
const LEVEL = { perfect: 0, good: 2, ok: 5, bad: 8 };

/** The Planner's day ends at 23:00; today's three busy levels take an hour each from the next full hour. */
const DAY_END = 23;
/**
 * The last hour on the page's clock at which the world can be seeded: at 19:xx
 * the levels are 20–21, 21–22, 22–23; from 20:00 there is no room for the
 * third, and frame 1 would lack a level while the run passed green.
 */
export const LAST_HOUR = DAY_END - 3 - 1;

/** The zone of `locale`'s page's country: its world's, every profile's in it. */
export function storeZone(locale) {
  const world = WORLDS[locale];
  if (!world) throw new Error(`No store world for ${locale}: ${Object.keys(WORLDS).join(', ')}`);
  return world.zone;
}

/** The hour now on `locale`'s page's clock (its world's zone). */
export function storeHour(locale, now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: storeZone(locale), hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/**
 * The pages of `locales`, taken one after another about `minutesAPage` each
 * from `now`, that would be seeded after LAST_HOUR in their country: the seed
 * refuses them then, so shoot.mjs and record.mjs say so before the first.
 */
export function latePages(locales, minutesAPage, now = Date.now()) {
  return locales.filter((locale, i) => storeHour(locale, new Date(now + i * minutesAPage * 60_000)) > LAST_HOUR);
}

/**
 * Which hours of day `day` how many of the play's actors are busy:
 * [{ from, to, busy }] in minutes from midnight. From the day after tomorrow:
 * the morning taken by day jobs, the afternoon freeing up, the evening between.
 * Today from the next full hour on (9:00 at the earliest), and tomorrow from
 * 9:00, the levels one window each: the Planner drops the hours gone, and its
 * first card — today's — must show all four on the first screen. `hourNow`:
 * the hour on the world's clock, LAST_HOUR at the latest (seedStore refuses after).
 */
export function busyBlocks(day, hourNow) {
  const h = (hours) => hours * 60;
  // The first card lists its windows best first, and on the phone's first
  // screen there is room for six or so: one window a level, the rest free.
  if (day === 0) {
    if (hourNow > LAST_HOUR) throw new Error(`No room for today's levels after ${LAST_HOUR}:59`);
    const start = Math.max(9, hourNow + 1);
    return ['bad', 'ok', 'good'].map((level, i) => ({ from: h(start + i), to: h(start + i + 1), busy: LEVEL[level] }));
  }
  if (day === 1) {
    return [
      { from: h(9), to: h(11), busy: LEVEL.bad },
      { from: h(11), to: h(13), busy: LEVEL.ok },
      { from: h(13), to: h(15), busy: LEVEL.good },
    ];
  }
  return [
    { from: h(9), to: h(11), busy: LEVEL.bad },
    { from: h(11), to: h(13), busy: LEVEL.ok },
    { from: h(13), to: h(15), busy: LEVEL.good },
    { from: h(15), to: h(17.5), busy: LEVEL.perfect },
    { from: h(17.5), to: h(19), busy: 3 },
    { from: h(19), to: h(21), busy: 4 },
    { from: h(21), to: h(23), busy: 1 },
  ];
}

/**
 * Who of a rehearsal's `cast` (the director first, as the seed lists it) has
 * seen it, the `i`th of the world's: about half to two thirds — 4 of 7, 2 of 4,
 * 3 of 4 — never nobody, never everyone, never the director; so the calendar
 * under the video's "12 of 12" reads like a week in work (T-286).
 */
function seenBy(cast, i) {
  const share = [0.5, 0.6, 0.7][i % 3];
  const count = Math.min(cast.length - 1, Math.max(1, Math.round(cast.length * share)));
  return cast.filter((key) => key !== 'director').slice(0, count);
}

/** The director's own marks (frame 2): whole days away and hours taken. */
const DIRECTOR_AWAY = [4, 10, 11, 17, 18, 24];
const DIRECTOR_HOURS = [[6, 10, 14], [13, 18, 22], [20, 9, 13]];


/**
 * One request to the local server. The server takes twenty invitations a
 * minute from one address, and this world has as many (three invites, 17
 * joins), so they are spent by the end of it; should one more be asked then,
 * a 429 is waited out as its Retry-After says, as a person would, and asked again.
 */
async function call(apiUrl, method, route, { token, body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(apiUrl + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (response.status === 429 && attempt < 3) {
      const wait = Number(response.headers.get('retry-after')) || 60;
      console.log(`[store] ${method} ${route}: the server's minute is spent, asking again in ${wait} s`);
      await new Promise((resolve) => setTimeout(resolve, (wait + 1) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`${method} ${route} answered ${response.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
}

/**
 * Seeds `locale`'s world through `client` (the accounts) and the local server
 * at `apiUrl` (the rest). Returns what the flow needs, in e2e/seed.mjs's shape.
 *
 * Everyone's profile and the projects are in the world's own zone — New York,
 * London, Moscow, Madrid, Berlin — which the profile names (frame 8), and
 * every day and hour here is that zone's, not the machine's.
 */
export async function seedStore({ client, apiUrl, locale, now = new Date() }) {
  const world = WORLDS[locale];
  if (!world) throw new Error(`No store world for ${locale}: ${Object.keys(WORLDS).join(', ')}`);
  const timezone = world.zone;
  const localDate = (day) => zoneDate(timezone, day);
  // Written with the zone's own offset, as the app sends it: the server takes
  // a busy slot as on the day its text names (manualDays.js), and in UTC an
  // evening in New York is the next day's.
  const localInstant = (day, hours, minutes = 0) => {
    const instant = new Date(zoneInstant(timezone, day, hours, minutes));
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(instant).find((part) => part.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
    const pad = (n) => String(n).padStart(2, '0');
    return `${localDate(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
  };
  const at = (day, minutes) => localInstant(day, Math.floor(minutes / 60), minutes % 60);
  const hourNow = storeHour(locale, now);
  if (hourNow > LAST_HOUR) {
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(now);
    throw new Error(`It is ${clock} in ${timezone}: the Planner's first card has no room left for all four levels `
      + `after ${LAST_HOUR}:59 there. Shoot ${locale} before 20:00 its time (e2e/store/README.md).`);
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  const people = { director: world.director };
  world.cast.forEach((name, i) => { people[`actor${i}`] = name; });
  world.musicians.forEach((name, i) => { people[`musician${i}`] = name; });
  world.crew.forEach((name, i) => { people[`crew${i}`] = name; });

  const ids = {};
  const emails = {};
  for (const [key, [firstName, lastName]] of Object.entries(people)) {
    // The director's is on the profile (frame 8): a person's, at example.com,
    // which is reserved and reaches nobody; the others' are never shown.
    emails[key] = key === 'director' ? world.email : `${key}.${locale.toLowerCase()}@store.test`;
    const { rows } = await client.query(
      `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale, onboarding_completed, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE) RETURNING id`,
      [emails[key], hash, firstName, lastName, timezone, world.language]);
    ids[key] = rows[0].id;
    await client.query(
      `INSERT INTO native_email_identities (user_id, email, status, verified_at, verified_by)
       VALUES ($1, $2, 'verified', NOW(), 'code')`,
      [ids[key], emails[key]]);
  }

  // Each signed in once: the server takes twenty sign-ins a minute from one
  // address, and these are 15, the app's own the 16th.
  const tokens = {};
  const token = async (key) => {
    tokens[key] ??= (await call(apiUrl, 'POST', '/auth/login', { body: { email: emails[key], password: PASSWORD } })).accessToken;
    return tokens[key];
  };

  const actors = world.cast.map((_, i) => `actor${i}`);
  const project = async ([name, description], cast) => {
    const { project: made } = await call(apiUrl, 'POST', '/native/projects',
      { token: await token('director'), body: { name, description, timezone } });
    const { inviteCode } = await call(apiUrl, 'POST', `/native/projects/${made.id}/invite`, { token: await token('director'), body: {} });
    for (const key of cast) await call(apiUrl, 'POST', `/native/invite/${inviteCode}/join`, { token: await token(key), body: {} });
    return { id: made.id, inviteCode };
  };
  // Newest first in the app's lists: the play made last, so the Planner opens on it.
  const clip = await project(world.clip, ['musician0', 'musician1', 'crew0']);
  const concert = await project(world.concert, ['actor8', 'actor9', 'actor10']);
  const play = await project(world.play, actors);

  // Everyone's busy times for four weeks, before the rehearsals book theirs.
  const busy = Object.fromEntries(actors.map((key) => [key, {}]));
  for (let day = 0; day < 28; day++) {
    busyBlocks(day, hourNow).forEach((block, b) => {
      for (let j = 0; j < block.busy; j++) {
        const key = actors[(day * 3 + b * 4 + j) % actors.length];
        const ranges = (busy[key][day] ??= []);
        const last = ranges.at(-1);
        if (last && last.to === block.from) last.to = block.to;
        else ranges.push({ from: block.from, to: block.to });
      }
    });
  }
  for (const key of actors) {
    const days = Object.entries(busy[key]).map(([day, ranges]) => ({
      date: localDate(Number(day)),
      entries: ranges.map(({ from, to }) => ({ startsAt: at(Number(day), from), endsAt: at(Number(day), to), type: 'busy' })),
    }));
    await call(apiUrl, 'PUT', '/native/availability/days', { token: await token(key), body: { days } });
  }
  const allDay = (day) => ({ date: localDate(day), entries: [{ startsAt: `${localDate(day)}T00:00:00.000Z`, endsAt: `${localDate(day)}T23:59:59.999Z`, type: 'busy', isAllDay: true }] });
  await call(apiUrl, 'PUT', '/native/availability/days', {
    token: await token('director'),
    body: {
      days: [...DIRECTOR_AWAY.map(allDay),
        ...DIRECTOR_HOURS.map(([day, from, to]) => ({ date: localDate(day), entries: [{ startsAt: localInstant(day, from), endsAt: localInstant(day, to), type: 'busy' }] }))],
    },
  });

  const rehearsal = async (which, projectId, title, day, from, to, cast) => {
    const { rehearsal: made } = await call(apiUrl, 'POST', `/native/projects/${projectId}/rehearsals`, {
      token: await token('director'),
      body: {
        title, startsAt: localInstant(day, from), endsAt: localInstant(day, to), location: world.places[which],
        participant_ids: cast.map((key) => String(ids[key])),
      },
    });
    return made.id;
  };
  const { titles } = world;
  const playCast = (from, count) => ['director', ...Array.from({ length: count }, (_, j) => actors[(from + j) % actors.length])];
  const concertCast = ['director', 'actor8', 'actor9', 'actor10'];
  const clipCast = ['director', 'musician0', 'musician1', 'crew0'];

  // Some of a rehearsal's cast mark it seen, each from a phone of their own,
  // as the app sends it.
  const markSeen = async (id, keys) => {
    for (const key of keys) {
      await call(apiUrl, 'POST', `/native/rehearsals/${id}/respond`, { token: await token(key), body: { response: 'yes' } });
    }
  };
  // Every rehearsal of the world but two — the "5 of 8" one and the one of
  // all twelve — with its cast: each is seen by some of them (seenBy).
  const upcoming = [];

  // Tomorrow: the concert in the morning, when the play's cast is mostly at
  // work anyway, the clip's choreography in the evening — neither moves a
  // level of the Planner's first card.
  upcoming.push([await rehearsal('concert', concert.id, titles.concert[0], 1, 9, 11, concertCast), concertCast]);
  upcoming.push([await rehearsal('clip', clip.id, titles.clip[0], 1, 19, 21, clipCast), clipCast]);
  // In two days: the director and seven of the cast, five of them have seen it.
  const seenCast = playCast(0, 7);
  const seen = await rehearsal('play', play.id, titles.play[0], 2, 18, 21, seenCast);
  await markSeen(seen, seenCast.slice(0, 5));
  upcoming.push([await rehearsal('clip', clip.id, titles.clip[1], 2, 10, 14, clipCast), clipCast]);
  // All twelve, nobody's mark yet: the video's counter (T-275), which runs
  // from 4 to 12 of 12 in its shot 6 (video.yaml).
  const everyone = await rehearsal('play', play.id, titles.play[1], 3, 18, 21, playCast(0, 11));
  const ahead = [
    ['play', 5, 11, 14, 2, playCast(3, 6)], ['concert', 6, 19, 21, 1, concertCast], ['play', 7, 18, 21, 3, playCast(5, 5)],
    ['concert', 8, 11, 13, 0, concertCast], ['clip', 9, 10, 16, 2, clipCast], ['play', 9, 18, 21, 0, playCast(1, 8)],
    ['play', 12, 18, 21, 3, playCast(2, 6)], ['concert', 13, 11, 13, 1, concertCast], ['play', 14, 18, 21, 1, playCast(0, 11)],
    ['play', 16, 11, 14, 2, playCast(4, 7)], ['play', 19, 18, 21, 3, playCast(6, 6)], ['play', 21, 18, 21, 1, playCast(0, 11)],
  ];
  for (const [which, day, from, to, title, cast] of ahead) {
    const id = which === 'play' ? play.id : which === 'concert' ? concert.id : clip.id;
    upcoming.push([await rehearsal(which, id, titles[which][title % titles[which].length], day, from, to, cast), cast]);
  }
  // The calendar lists them under the count that runs to 12 of 12 (the video's
  // shots 6 and 7): "0/7" there would say nobody knows of the next (T-286).
  for (const [i, [id, cast]] of upcoming.entries()) await markSeen(id, seenBy(cast, i));

  return {
    password: PASSWORD,
    people: { director: { email: emails.director } },
    invites: { play: play.inviteCode },
    // The video's (T-275, video.yaml): two free days the director marks busy
    // (shot 2), and the day of the rehearsal of all twelve (shot 6).
    days: { today: localDate(0), tomorrow: localDate(1), form: localDate(1), busy_a: localDate(8), busy_b: localDate(9), everyone: localDate(3) },
    // Tomorrow's 11:00, when five of the play's cast are busy: the form names them (frame 3).
    times: { form: '11:00' },
    labels: {
      play: world.play[0], seen: titles.play[0], concert: titles.concert[0],
      mark_busy: world.words.markBusy, apple: world.words.apple, show_code: world.words.showCode,
      // The phone as one of that country is set, given the app at launch (shots.yaml).
      apple_languages: `<array><string>${world.appleLanguage}</string></array>`,
      apple_locale: world.appleLocale,
      clock24: world.clock24 ? '<true/>' : '<false/>',
      // The video's (T-275). Shot 4 picks three of the cast: tomorrow at
      // FORM_TIME the first is busy and the others are not (busyBlocks), so
      // shot 5's form names one. Shot 6: the rehearsal of all twelve, and the
      // eleven of the cast who mark it seen, through the API, as their phones would.
      pick_0: world.cast[0].join(' '), pick_1: world.cast[1].join(' '), pick_2: world.cast[2].join(' '),
      // Their rows in the picker (`participant-<id>`), where the preview's light falls (T-289).
      pick_0_id: String(ids.actor0), pick_1_id: String(ids.actor1), pick_2_id: String(ids.actor2),
      create_anyway: world.words.createAnyway,
      everyone_title: titles.play[1],
      seen_emails: actors.map((key) => emails[key]).join(','),
    },
    rehearsals: { seen, everyone },
  };
}
