/**
 * A new or changed rehearsal, and a response to one, say when it is (T-023).
 *
 * "Hamlet: Full dress scheduled" did not say when: every reader had to open it
 * to find out, and "responded to a rehearsal in Hamlet" did not even say which.
 * The day and time are worded as the reminders word them — in each reader's
 * own zone and language (reminderText.js) — so two readers in different zones
 * read different times.
 *
 * And "New member" carries its project's id: with the name alone, a tap on it
 * opened nothing.
 *
 * What is read is the inbox row, written with the same title and body the push
 * carries. Nobody here has a device, so nothing is sent.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from './setup.js';

let testDb;

jest.unstable_mockModule('../../database/db.js', () => ({
  default: {
    run: (sql, params) => testDb.run(sql, params),
    get: (sql, params) => testDb.get(sql, params),
    all: (sql, params) => testDb.all(sql, params),
    transaction: (fn) => testDb.transaction(fn),
  },
  isPostgres: false,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  notifyRehearsalCreated,
  notifyRehearsalUpdated,
  notifyMemberResponse,
  notifyMemberJoined,
  notifyAddedToRehearsal,
  notifyRemovedFromRehearsal,
  notifyRehearsalDeleted,
  notifyRoleChanged,
  notifyMemberRemoved,
  notifyAdminAppointed,
  notifyProjectDeleted,
  notifyRehearsal24h,
  notifyRehearsal1h,
} = await import('../../services/notifications/pushNotificationService.js');

// Intl separates "3:00" from "PM" with a narrow no-break space.
const plain = (text) => text.replace(/\s/g, ' ');

// 06:00 UTC on 5 October; the rehearsal starts at 19:00 UTC on the 6th —
// 22:00 tomorrow in Jerusalem, 15:00 tomorrow in New York.
const now = new Date('2026-10-05T06:00:00Z');

let data;
let natasha; // Russian, in Jerusalem
let john; // English, in New York
let rehearsal;

const addReader = (name, locale, timezone) => Number(testDb.run(
  `INSERT INTO native_users (email, password_hash, first_name, locale, timezone) VALUES (?, ?, ?, ?, ?)`,
  [`${name}@test.com`, 'hash', name, locale, timezone]
).lastInsertId);

// Who a notice names, as the routes hand it over (T-278): the name, and the
// account it belongs to — one that exists, or no notice is written.
const named = (name) => ({ id: Number(data.memberId), name });

/** What each reader's inbox got, newest first. */
const inboxOf = (userId) => testDb.all(
  'SELECT type, title, body, data, related_type, related_id FROM native_notifications WHERE user_id = ? ORDER BY id DESC',
  [userId]
).map((row) => ({ ...row, body: plain(row.body), data: JSON.parse(row.data) }));

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  data = await seedTestData(testDb);
  natasha = addReader('natasha', 'ru', 'Asia/Jerusalem');
  john = addReader('john', 'en', 'America/New_York');
  const id = Number(testDb.run(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, ?, ?, ?)`,
    [data.projectId, 'Full dress', '2026-10-06T19:00:00.000Z', '2026-10-06T22:00:00.000Z']
  ).lastInsertId);
  // As the routes hand it over after a save: the service's shape, startsAt.
  rehearsal = { id: String(id), projectId: String(data.projectId), title: 'Full dress', startsAt: '2026-10-06T19:00:00.000Z' };
});

afterAll(() => closeIntegrationDb());

beforeEach(() => testDb.run('DELETE FROM native_notifications'));

const readers = () => [{ user_id: natasha }, { user_id: john }];

describe('Each reader is told when, on their own clock and in their own language', () => {
  it('a new rehearsal', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', readers(), { now });

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Репетиция «Full dress» назначена на завтра в 22:00');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled tomorrow at 3:00 PM');
  });

  it('a changed rehearsal, with what changed', async () => {
    await notifyRehearsalUpdated(rehearsal, 'Hamlet', readers(), ['datetime'], { now });

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Full dress — теперь завтра в 22:00');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress — moved to tomorrow at 3:00 PM');
  });

  it('a "seen" names the rehearsal and when it is', async () => {
    // The seen route hands over the row itself: starts_at.
    const row = { id: rehearsal.id, project_id: data.projectId, title: 'Full dress', starts_at: '2026-10-06T19:00:00.000Z' };
    await notifyMemberResponse(row, 'Hamlet', named('Ophelia Bright'), [natasha, john], { now });

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Full dress, завтра в 22:00 — Ophelia Bright в курсе');
    expect(inboxOf(john)[0].body).toBe('Ophelia Bright has seen “Full dress” (tomorrow at 3:00 PM) in Hamlet');
  });

  it('further out, the date', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', readers(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(natasha)[0].body).toMatch(/^Hamlet: Репетиция «Full dress» назначена на вт, 6 окт\.? в 22:00$/);
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled on Tue, Oct 6 at 3:00 PM');
  });
});

describe('Put on or taken off a rehearsal (T-233)', () => {
  it('whoever is added is told which one, when and where, and a tap opens it', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', readers(), { now });

    const [ru] = inboxOf(natasha);
    const [en] = inboxOf(john);
    expect(ru.title).toBe('Вас позвали на репетицию');
    expect(ru.body).toBe('Hamlet: Репетиция «Full dress» назначена на завтра в 22:00, место: Main stage');
    expect(en.title).toBe('You Were Added to a Rehearsal');
    expect(en.body).toBe('Hamlet: Full dress scheduled tomorrow at 3:00 PM at Main stage');
    // As a new rehearsal: the inbox and a tapped push open it.
    expect(en.type).toBe('rehearsal_created');
    expect(en.related_type).toBe('rehearsal');
    expect(String(en.related_id)).toBe(rehearsal.id);
  });

  it('whoever is taken off is told so, and a tap does not try to open it', async () => {
    await notifyRemovedFromRehearsal(rehearsal, 'Hamlet', readers(), { now });

    const [ru] = inboxOf(natasha);
    const [en] = inboxOf(john);
    expect(ru.title).toBe('Вас сняли с репетиции');
    expect(ru.body).toBe('Hamlet: Full dress, завтра в 22:00 — вас больше нет в составе');
    expect(en.body).toBe('Hamlet: Full dress, tomorrow at 3:00 PM — you are no longer on it');
    // No rehearsal to open — they can no longer see it; the app opens the calendar.
    expect(en.type).toBe('rehearsal_removed');
    expect(en.data.rehearsalId).toBeUndefined();
    expect(en.related_type).not.toBe('rehearsal');
  });
});

/**
 * Spanish and German, as native speakers read them (T-248).
 *
 * "Hamlet: Esgrima programado mañana" read as "was scheduled tomorrow" — the
 * date the scheduling happened, not the rehearsal's: Spanish says "programado
 * para". German puts the participle last: "morgen um 21:00 angesetzt", not
 * "angesetzt morgen um 21:00".
 */
describe('Spanish and German say a rehearsal is set for a day, in their own word order (T-248)', () => {
  let carmen; // Spanish, in Madrid
  let klaus; // German, in Berlin
  const latins = () => [{ user_id: carmen }, { user_id: klaus }];

  beforeAll(() => {
    carmen = addReader('carmen', 'es', 'Europe/Madrid');
    klaus = addReader('klaus', 'de', 'Europe/Berlin');
  });

  // 19:00 UTC on the 6th is 21:00 in Madrid and in Berlin.
  it('a new rehearsal tomorrow', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', latins(), { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para mañana a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ morgen um 21:00 angesetzt');
  });

  it('a new rehearsal today', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-06T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para hoy a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ heute um 21:00 angesetzt');
  });

  it('a new rehearsal further out, on its date', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para el martes 6 de octubre a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ am Di., 6. Okt. um 21:00 angesetzt');
  });

  it('added to one, with and without a place', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', latins(), { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para mañana a las 21:00. Lugar: Main stage');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ morgen um 21:00 angesetzt, Ort: Main stage');

    await notifyAddedToRehearsal(rehearsal, 'Hamlet', latins(), { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para mañana a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ morgen um 21:00 angesetzt');
  });

  it('added to one on its date, with a place', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', latins(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para el martes 6 de octubre a las 21:00. Lugar: Main stage');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ am Di., 6. Okt. um 21:00 angesetzt, Ort: Main stage');
  });

  it('added to one today', async () => {
    await notifyAddedToRehearsal(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-06T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para hoy a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Full dress“ heute um 21:00 angesetzt');
  });
});

/**
 * The title is whatever the director typed, of any gender (T-248).
 *
 * A participle agreeing with it — "Прогон назначена", "Escena del balcón
 * programado" — was wrong for every title not of the gender the text assumed.
 * It agrees with the word "rehearsal" itself, which the title follows.
 */
describe('Any title reads correctly, whatever its gender (T-248)', () => {
  let carmen;
  let olga;
  beforeAll(() => {
    carmen = addReader('carmen2', 'es', 'Europe/Madrid');
    olga = addReader('olga', 'ru', 'Asia/Jerusalem');
  });

  it('a feminine title in Spanish, a masculine one in Russian', async () => {
    await notifyRehearsalCreated({ ...rehearsal, title: 'Escena del balcón' }, 'Hamlet', [{ user_id: carmen }], { now });
    await notifyRehearsalCreated({ ...rehearsal, title: 'Прогон' }, 'Гамлет', [{ user_id: olga }], { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Escena del balcón» programado para mañana a las 21:00');
    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция «Прогон» назначена на завтра в 22:00');
  });

  it('added to one with a neuter title in Russian', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, title: 'Чтение', location: 'Зал 2' }, 'Гамлет', [{ user_id: olga }], { now });

    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция «Чтение» назначена на завтра в 22:00, место: Зал 2');
  });

  it('with no title, the word "rehearsal" alone', async () => {
    await notifyRehearsalCreated({ ...rehearsal, title: '' }, 'Hamlet', [{ user_id: carmen }, { user_id: olga }], { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo programado para mañana a las 21:00');
    expect(inboxOf(olga)[0].body).toBe('Hamlet: Репетиция назначена на завтра в 22:00');
  });
});

/**
 * Nothing agrees with what the server cannot know (T-251).
 *
 * The title's gender: "Прогон отменена", "Escena del balcón cancelado". The
 * person's: "Мальвина присоединился", "откликнулся" — wrong for every woman.
 * The reader's: "Has sido eliminado", "Ahora eres administrador", "Du bist
 * jetzt Administrator". And "Вы теперь администратором проекта" had no verb
 * for its instrumental.
 */
describe('No word agrees with a title, a member or a reader the server cannot know (T-251)', () => {
  let carmen;
  let klaus;
  let olga;
  beforeAll(() => {
    carmen = addReader('carmen3', 'es', 'Europe/Madrid');
    klaus = addReader('klaus3', 'de', 'Europe/Berlin');
    olga = addReader('olga3', 'ru', 'Asia/Jerusalem');
  });

  it('a cancelled rehearsal agrees with "rehearsal", not with its title', async () => {
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Прогон' }, 'Гамлет', [{ user_id: olga }], { now });
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Escena del balcón' }, 'Hamlet', [{ user_id: carmen }], { now });
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Fechtszene' }, 'Hamlet', [{ user_id: klaus }], { now });

    expect(inboxOf(olga)[0]).toMatchObject({ title: 'Отменена репетиция', body: 'Гамлет: Репетиция «Прогон» на завтра в 22:00 отменена' });
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ensayo cancelado', body: 'Hamlet: Cancelado el ensayo «Escena del balcón» previsto para mañana a las 21:00' });
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Fechtszene“ morgen um 21:00 abgesagt');
  });

  it('a cancelled rehearsal with no title', async () => {
    await notifyRehearsalDeleted({ ...rehearsal, title: '' }, 'Гамлет', [{ user_id: olga }, { user_id: carmen }], { now });

    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция на завтра в 22:00 отменена');
    expect(inboxOf(carmen)[0].body).toBe('Гамлет: Cancelado el ensayo previsto para mañana a las 21:00');
  });

  it('a woman and a man who join read the same', async () => {
    await notifyMemberJoined('Гамлет', named('Офелия Полониева'), [olga], data.projectId);
    expect(inboxOf(olga)[0].body).toBe('Офелия Полониева теперь в проекте «Гамлет»');

    await notifyMemberJoined('Гамлет', named('Гамлет Датский'), [olga], data.projectId);
    expect(inboxOf(olga)[0].body).toBe('Гамлет Датский теперь в проекте «Гамлет»');
  });

  it('a woman and a man who have seen a rehearsal read the same, in the app\'s word', async () => {
    const row = { id: rehearsal.id, project_id: data.projectId, title: 'Сцена с письмом', starts_at: '2026-10-06T09:00:00.000Z' };
    await notifyMemberResponse(row, 'Иллирия', named('Виола Себастьянова'), [olga, carmen, klaus], { now });
    expect(inboxOf(olga)[0]).toMatchObject({ title: 'Репетиция просмотрена', body: 'Иллирия: Сцена с письмом, завтра в 12:00 — Виола Себастьянова в курсе' });
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ensayo visto', body: 'Виола Себастьянова ha visto «Сцена с письмом» (mañana a las 11:00) en Иллирия' });
    expect(inboxOf(klaus)[0]).toMatchObject({ title: 'Probe gesehen', body: 'Иллирия: Виола Себастьянова hat die Probe „Сцена с письмом“ (morgen um 11:00) als gesehen markiert' });

    await notifyMemberResponse(row, 'Иллирия', named('Мальволио Стюард'), [olga, john], { now });
    expect(inboxOf(olga)[0].body).toBe('Иллирия: Сцена с письмом, завтра в 12:00 — Мальволио Стюард в курсе');
    expect(inboxOf(john)[0]).toMatchObject({ title: 'Rehearsal Seen', body: 'Мальволио Стюард has seen “Сцена с письмом” (tomorrow at 5:00 AM) in Иллирия' });
  });

  it('a role given reads right in Russian, and agrees with no reader in Spanish and German', async () => {
    for (const reader of [olga, carmen, klaus, john]) {
      await notifyRoleChanged('Hamlet', reader, 'admin');
    }
    expect(inboxOf(olga)[0].body).toBe('Теперь вы администратор проекта «Hamlet»');
    expect(inboxOf(carmen)[0].body).toBe('Ahora administras el proyecto «Hamlet»');
    expect(inboxOf(klaus)[0].body).toBe('Du verwaltest jetzt das Projekt „Hamlet“');
    expect(inboxOf(john)[0].body).toBe('You are now an administrator of Hamlet');

    for (const reader of [olga, carmen, klaus, john]) {
      await notifyRoleChanged('Hamlet', reader, 'member');
    }
    expect(inboxOf(olga)[0].body).toBe('Вы больше не администратор проекта «Hamlet»');
    // Rights taken away say so in every language (T-261).
    expect(inboxOf(carmen)[0].body).toBe('Ya no administras el proyecto «Hamlet»');
    expect(inboxOf(klaus)[0].body).toBe('Du verwaltest das Projekt „Hamlet“ nicht mehr');
    expect(inboxOf(john)[0].body).toBe('You are no longer an administrator of Hamlet');
  });

  it('someone removed from a project, in Spanish, is no participle', async () => {
    await notifyMemberRemoved('Hamlet', carmen);

    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ya no estás en el proyecto', body: 'Ya no formas parte del proyecto «Hamlet»' });
  });
});

/**
 * A change says what changed, in a sentence (T-250).
 *
 * "Лебединое озеро: Кордебалет, сегодня в 19:00 — дата/время" left the reader
 * to work out that the time was the new one and what "дата/время" meant. The
 * landing page, read by native speakers, shows it as "Кордебалет — теперь
 * сегодня в 19:00", "Corps de ballet — now today at 7:00 PM", "Cuerpo de baile,
 * pasa a hoy a las 19:00", "Corps de ballet – verlegt auf heute, 19:00".
 */
describe('A changed rehearsal says what changed, as a native speaker says it (T-250)', () => {
  let carmen;
  let klaus;
  let olga;
  let nick;
  const all = () => [carmen, klaus, olga, nick].map((user_id) => ({ user_id }));
  const bodies = () => [carmen, klaus, olga, nick].map((reader) => inboxOf(reader)[0].body);
  const today = new Date('2026-10-06T06:00:00Z');

  beforeAll(() => {
    carmen = addReader('carmen4', 'es', 'Europe/Madrid');
    klaus = addReader('klaus4', 'de', 'Europe/Berlin');
    olga = addReader('olga4', 'ru', 'Europe/Moscow');
    nick = addReader('nick4', 'en', 'Europe/London');
  });

  let swan;
  beforeAll(() => { swan = { ...rehearsal, title: 'Кордебалет', location: 'Зал 2' }; });

  it('moved: where to, today', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['datetime'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, pasa a hoy a las 21:00',
      'Лебединое озеро: Probe „Кордебалет“ – verlegt auf heute, 21:00',
      'Лебединое озеро: Кордебалет — теперь сегодня в 22:00',
      'Лебединое озеро: Кордебалет — moved to today at 8:00 PM',
    ]);
  });

  it('moved to a date: "al", not "a el"; "auf Di.", not "auf am"', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['datetime'], { now: new Date('2026-10-01T06:00:00Z') });

    const [es, de, ru, en] = bodies();
    expect(es).toBe('Лебединое озеро: Кордебалет, pasa al martes 6 de octubre a las 21:00');
    expect(de).toBe('Лебединое озеро: Probe „Кордебалет“ – verlegt auf Di., 6. Okt., 21:00');
    expect(ru).toMatch(/^Лебединое озеро: Кордебалет — теперь вт, 6 окт\.? в 22:00$/);
    expect(en).toBe('Лебединое озеро: Кордебалет — moved to Tue, Oct 6 at 8:00 PM');
  });

  it('moved and to a new place', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['datetime', 'location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, pasa a mañana a las 21:00. Lugar: Зал 2',
      'Лебединое озеро: Probe „Кордебалет“ – verlegt auf morgen, 21:00, Ort: Зал 2',
      'Лебединое озеро: Кордебалет — теперь завтра в 22:00, место: Зал 2',
      'Лебединое озеро: Кордебалет — moved to tomorrow at 8:00 PM at Зал 2',
    ]);
  });

  it('a new place only: which', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — nuevo lugar: Зал 2',
      'Лебединое озеро: Probe „Кордебалет“, morgen um 21:00 – neuer Ort: Зал 2',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — новое место: Зал 2',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — new location: Зал 2',
    ]);
  });

  it('the place taken away', async () => {
    await notifyRehearsalUpdated({ ...swan, location: '' }, 'Лебединое озеро', all(), ['location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — ya sin lugar asignado',
      'Лебединое озеро: Probe „Кордебалет“, morgen um 21:00 – kein Ort mehr',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — место больше не указано',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — location removed',
    ]);
  });

  it('renamed: the new name, and that it is one', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['title'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — nuevo título',
      'Лебединое озеро: Probe „Кордебалет“, morgen um 21:00 – neuer Titel',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — новое название',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — renamed',
    ]);
  });

  // 19:00–21:00 made 19:00–22:30 did not move: "теперь сегодня в 19:00",
  // "verlegt auf heute, 19:00" said it had, and the new end was lost.
  it('made longer, the start where it was: until when, not moved', async () => {
    const longer = { ...swan, endsAt: '2026-10-06T20:30:00.000Z' };
    await notifyRehearsalUpdated(longer, 'Лебединое озеро', all(), ['end'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, hoy a las 21:00 — ahora termina a las 22:30',
      'Лебединое озеро: Probe „Кордебалет“, heute um 21:00 – jetzt bis 22:30',
      'Лебединое озеро: Кордебалет, сегодня в 22:00 — теперь до 23:30',
      'Лебединое озеро: Кордебалет, today at 8:00 PM — now until 9:30 PM',
    ]);
  });

  it('made longer and to a new place', async () => {
    const longer = { ...swan, endsAt: '2026-10-06T20:30:00.000Z' };
    await notifyRehearsalUpdated(longer, 'Лебединое озеро', all(), ['end', 'location'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, hoy a las 21:00 — ahora termina a las 22:30, nuevo lugar: Зал 2',
      'Лебединое озеро: Probe „Кордебалет“, heute um 21:00 – jetzt bis 22:30, neuer Ort: Зал 2',
      'Лебединое озеро: Кордебалет, сегодня в 22:00 — теперь до 23:30, новое место: Зал 2',
      'Лебединое озеро: Кордебалет, today at 8:00 PM — now until 9:30 PM, new location: Зал 2',
    ]);
  });

  // The start moved and the end stayed: the new start, and the end it keeps.
  // Russian says a span "с … до …", not "в 21:00 до 23:30" (T-256).
  it('the start moved and the length changed: from when and until when', async () => {
    const earlier = { ...swan, startsAt: '2026-10-06T18:00:00.000Z', endsAt: '2026-10-06T20:30:00.000Z' };
    await notifyRehearsalUpdated(earlier, 'Лебединое озеро', all(), ['datetime', 'end'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, pasa a hoy a las 20:00, hasta las 22:30',
      'Лебединое озеро: Probe „Кордебалет“ – verlegt auf heute, 20:00 bis 22:30',
      'Лебединое озеро: Кордебалет — теперь сегодня с 21:00 до 23:30',
      'Лебединое озеро: Кордебалет — moved to today at 7:00 PM until 9:30 PM',
    ]);
  });

  it('one o\'clock in Spanish is singular: "a la 1:00", "hasta la 1:30"', async () => {
    const late = { ...swan, startsAt: '2026-10-06T23:00:00.000Z', endsAt: '2026-10-06T23:30:00.000Z' };
    await notifyRehearsalUpdated(late, 'Лебединое озеро', all(), ['end'], { now: today });

    expect(bodies()[0]).toBe('Лебединое озеро: Кордебалет, mañana a la 1:00 — ahora termina a la 1:30');
  });

  /**
   * An end past midnight is the next day's, said so (T-256): "теперь до 1:00"
   * read as the small hours of the same night only to whoever worked it out.
   * Midnight itself is "полночь", not "0:00 следующего дня". The day is the
   * reader's: 23:00 UTC is 2:00 the next day in Moscow, midnight in London.
   */
  it('made longer past midnight: the next day, in the reader\'s zone', async () => {
    const late = { ...swan, endsAt: '2026-10-06T23:00:00.000Z' };
    await notifyRehearsalUpdated(late, 'Лебединое озеро', all(), ['end'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, hoy a las 21:00 — ahora termina a la 1:00 del día siguiente',
      'Лебединое озеро: Probe „Кордебалет“, heute um 21:00 – jetzt bis 1:00 am Folgetag',
      'Лебединое озеро: Кордебалет, сегодня в 22:00 — теперь до 2:00 следующего дня',
      'Лебединое озеро: Кордебалет, today at 8:00 PM — now until midnight',
    ]);
  });

  it('made longer to midnight: midnight, not "0:00 the next day"', async () => {
    const late = { ...swan, endsAt: '2026-10-06T22:00:00.000Z' };
    await notifyRehearsalUpdated(late, 'Лебединое озеро', all(), ['end'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, hoy a las 21:00 — ahora termina a la medianoche',
      'Лебединое озеро: Probe „Кордебалет“, heute um 21:00 – jetzt bis Mitternacht',
      'Лебединое озеро: Кордебалет, сегодня в 22:00 — теперь до 1:00 следующего дня',
      'Лебединое озеро: Кордебалет, today at 8:00 PM — now until 11:00 PM',
    ]);

    await notifyRehearsalUpdated({ ...swan, endsAt: '2026-10-06T21:00:00.000Z' }, 'Лебединое озеро', all(), ['end'], { now: today });
    expect(bodies()[2]).toBe('Лебединое озеро: Кордебалет, сегодня в 22:00 — теперь до полуночи');
  });

  it('moved, ending past midnight', async () => {
    const late = { ...swan, endsAt: '2026-10-06T23:00:00.000Z' };
    await notifyRehearsalUpdated(late, 'Лебединое озеро', all(), ['datetime', 'end'], { now: today });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, pasa a hoy a las 21:00, hasta la 1:00 del día siguiente',
      'Лебединое озеро: Probe „Кордебалет“ – verlegt auf heute, 21:00 bis 1:00 am Folgetag',
      'Лебединое озеро: Кордебалет — теперь сегодня с 22:00 до 2:00 следующего дня',
      'Лебединое озеро: Кордебалет — moved to today at 8:00 PM until midnight',
    ]);
  });

  /** Renamed to nothing: not "a new name" (T-256). */
  it('the title erased: "without a title", not "renamed"', async () => {
    await notifyRehearsalUpdated({ ...swan, title: '' }, 'Лебединое озеро', all(), ['title'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Ensayo, mañana a las 21:00 — ya sin título',
      'Лебединое озеро: Probe, morgen um 21:00 – Titel entfernt',
      'Лебединое озеро: Репетиция, завтра в 22:00 — теперь без названия',
      'Лебединое озеро: Rehearsal, tomorrow at 8:00 PM — title removed',
    ]);
  });

  /** A cancelled rehearsal says which one: when it was (T-256). */
  it('cancelled: when it was, as every other notice says it', async () => {
    await notifyRehearsalDeleted(swan, 'Лебединое озеро', all(), { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Cancelado el ensayo «Кордебалет» previsto para mañana a las 21:00',
      'Лебединое озеро: Probe „Кордебалет“ morgen um 21:00 abgesagt',
      'Лебединое озеро: Репетиция «Кордебалет» на завтра в 22:00 отменена',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — canceled',
    ]);

    await notifyRehearsalDeleted({ ...swan, title: '' }, 'Лебединое озеро', all(), { now: new Date('2026-10-01T06:00:00Z') });
    const [es, de, ru, en] = bodies();
    expect(es).toBe('Лебединое озеро: Cancelado el ensayo previsto para el martes 6 de octubre a las 21:00');
    expect(de).toBe('Лебединое озеро: Probe am Di., 6. Okt. um 21:00 abgesagt');
    expect(ru).toMatch(/^Лебединое озеро: Репетиция на вт, 6 окт\.? в 22:00 отменена$/);
    expect(en).toBe('Лебединое озеро: Rehearsal, on Tue, Oct 6 at 8:00 PM — canceled');
  });
});

/**
 * The rest of the native speakers' reading (T-256): English titles in Title
 * Case (Apple HIG, notifications), "canceled"; a project's name in quotes
 * after the word "project" in Russian and German, which also carries the
 * German case ("ist dem Projekt „Der Kirschgarten“ beigetreten", not "ist Der
 * Kirschgarten beigetreten"); no generic word in quotes as if it were a title.
 */
describe('Titles, names and the words around them, as native speakers read them (T-256)', () => {
  let carmen;
  let klaus;
  let olga;
  let nick;
  const readersOf = () => [carmen, klaus, olga, nick];
  const all = () => readersOf().map((user_id) => ({ user_id }));
  const latest = () => readersOf().map((reader) => inboxOf(reader)[0]);
  const titles = () => latest().map((row) => row.title);
  const bodies = () => latest().map((row) => row.body);

  beforeAll(() => {
    carmen = addReader('carmen5', 'es', 'Europe/Madrid');
    klaus = addReader('klaus5', 'de', 'Europe/Berlin');
    olga = addReader('olga5', 'ru', 'Europe/Moscow');
    nick = addReader('nick5', 'en', 'Europe/London');
  });

  const untitled = () => ({ ...rehearsal, title: '' });

  it('the notices about a rehearsal', async () => {
    await notifyAddedToRehearsal(rehearsal, 'Hamlet', all(), { now });
    expect(titles()).toEqual(['Te han añadido a un ensayo', 'Du wurdest für eine Probe eingeteilt', 'Вас позвали на репетицию', 'You Were Added to a Rehearsal']);

    await notifyRemovedFromRehearsal(rehearsal, 'Hamlet', all(), { now });
    // The German title is one line on the lock screen (T-261).
    expect(titles()).toEqual(['Te han quitado de un ensayo', 'Nicht mehr eingeteilt', 'Вас сняли с репетиции', 'You Were Taken Off a Rehearsal']);
    expect(bodies()).toEqual([
      'Hamlet: Full dress, mañana a las 21:00 — ya no estás en este ensayo',
      'Hamlet: Probe „Full dress“, morgen um 21:00 – du bist nicht mehr dabei',
      'Hamlet: Full dress, завтра в 22:00 — вас больше нет в составе',
      'Hamlet: Full dress, tomorrow at 8:00 PM — you are no longer on it',
    ]);

    await notifyRehearsalCreated(rehearsal, 'Hamlet', all(), { now });
    expect(titles()[3]).toBe('New Rehearsal');

    await notifyRehearsalUpdated(rehearsal, 'Hamlet', all(), ['title'], { now });
    expect(titles()[3]).toBe('Rehearsal Updated');

    await notifyRehearsalDeleted(rehearsal, 'Hamlet', all(), { now });
    expect(titles()).toEqual(['Ensayo cancelado', 'Probe abgesagt', 'Отменена репетиция', 'Rehearsal Canceled']);
  });

  it('"seen" with no title: the rehearsal, not "Rehearsal" in quotes', async () => {
    await notifyMemberResponse(untitled(), 'Hamlet', named('Anna Smith'), readersOf(), { now });

    expect(titles()[3]).toBe('Rehearsal Seen');
    expect(bodies()).toEqual([
      'Anna Smith ha visto el ensayo (mañana a las 21:00) en Hamlet',
      'Hamlet: Anna Smith hat die Probe (morgen um 21:00) als gesehen markiert',
      'Hamlet: Репетиция, завтра в 22:00 — Anna Smith в курсе',
      'Anna Smith has seen the rehearsal (tomorrow at 8:00 PM) in Hamlet',
    ]);
  });

  it('the notices about a project: its name in quotes, the German case on "Projekt"', async () => {
    await notifyMemberJoined('Der Kirschgarten', named('Anna Schmidt'), readersOf(), data.projectId);
    expect(titles()).toEqual(['Nuevo miembro', 'Neues Mitglied', 'Новый участник', 'New Member']);
    expect(bodies()).toEqual([
      'Anna Schmidt se unió al proyecto «Der Kirschgarten»',
      'Anna Schmidt ist dem Projekt „Der Kirschgarten“ beigetreten',
      'Anna Schmidt теперь в проекте «Der Kirschgarten»',
      'Anna Schmidt joined Der Kirschgarten',
    ]);

    await notifyAdminAppointed('Der Kirschgarten', named('Anna Schmidt'), readersOf(), data.projectId);
    expect(titles()).toEqual(['Permisos de administrador', 'Adminrechte vergeben', 'Новый администратор', 'New Administrator']);
    expect(bodies()).toEqual([
      'Anna Schmidt ahora administra el proyecto «Der Kirschgarten»',
      'Anna Schmidt verwaltet jetzt das Projekt „Der Kirschgarten“',
      'Anna Schmidt теперь администратор проекта «Der Kirschgarten»',
      'Anna Schmidt is now an administrator of Der Kirschgarten',
    ]);

    for (const reader of readersOf()) await notifyRoleChanged('Der Kirschgarten', reader, 'admin');
    expect(titles()[3]).toBe('Role Changed');

    for (const reader of readersOf()) await notifyMemberRemoved('Der Kirschgarten', reader);
    expect(titles()[3]).toBe('Removed from Project');
    expect(bodies()).toEqual([
      'Ya no formas parte del proyecto «Der Kirschgarten»',
      'Du wurdest aus dem Projekt „Der Kirschgarten“ entfernt',
      'Вас удалили из проекта «Der Kirschgarten»',
      'You were removed from the project Der Kirschgarten',
    ]);

    await notifyProjectDeleted('Der Kirschgarten', readersOf());
    expect(titles()[3]).toBe('Project Deleted');
    expect(bodies()).toEqual([
      'El proyecto «Der Kirschgarten» ha sido eliminado',
      'Das Projekt „Der Kirschgarten“ wurde gelöscht',
      'Проект «Der Kirschgarten» удалён',
      'The project Der Kirschgarten has been deleted',
    ]);
  });

  it('the reminders: English titles in Title Case, Spanish and German natural', async () => {
    await notifyRehearsal24h(rehearsal, 'Hamlet', readersOf(), { now });
    expect(titles()).toEqual(['Ensayo mañana a las 21:00', 'Probe morgen um 21:00', 'Репетиция завтра в 22:00', 'Rehearsal Tomorrow at 8:00 PM']);

    await notifyRehearsal24h(rehearsal, 'Hamlet', readersOf(), { now: new Date('2026-10-06T06:00:00Z') });
    expect(titles()[3]).toBe('Rehearsal Today at 8:00 PM');

    await notifyRehearsal24h(rehearsal, 'Hamlet', readersOf(), { now: new Date('2026-10-01T06:00:00Z') });
    expect(titles()[3]).toBe('Rehearsal on Tue, Oct 6 at 8:00 PM');

    await notifyRehearsal1h(rehearsal, 'Hamlet', readersOf(), { now: new Date('2026-10-06T18:30:00Z') });
    expect(titles()).toEqual(['Ensayo en breve: hoy a las 21:00', 'Probe beginnt bald: heute um 21:00', 'Скоро репетиция: сегодня в 22:00', 'Rehearsal Soon — Today at 8:00 PM']);
    // The body keeps its lower case.
    expect(bodies()[3]).toBe('Hamlet: Full dress');
  });
});

/**
 * The second reading (T-261). A name typed in quotes — a theatre writes a
 * production's name so — had them doubled: «Проект ««Вишнёвый сад»» удалён»,
 * «Репетиция «Прогон «Чайки»» назначена». The quotes around a whole name go,
 * those inside it become the language's second level. Rights taken away say
 * so in every language, and Spanish quotes the project as the others do.
 */
describe('A name in quotes, rights taken away, Spanish project notices (T-261)', () => {
  let carmen;
  let klaus;
  let olga;
  let nick;
  const readersOf = () => [carmen, klaus, olga, nick];
  const all = () => readersOf().map((user_id) => ({ user_id }));
  const bodies = () => readersOf().map((reader) => inboxOf(reader)[0].body);

  beforeAll(() => {
    carmen = addReader('carmen6', 'es', 'Europe/Madrid');
    klaus = addReader('klaus6', 'de', 'Europe/Berlin');
    olga = addReader('olga6', 'ru', 'Europe/Moscow');
    nick = addReader('nick6', 'en', 'Europe/London');
  });

  it('a project named in quotes is not quoted twice', async () => {
    await notifyProjectDeleted('«Вишнёвый сад»', readersOf());
    expect(bodies()).toEqual([
      'El proyecto «Вишнёвый сад» ha sido eliminado',
      'Das Projekt „Вишнёвый сад“ wurde gelöscht',
      'Проект «Вишнёвый сад» удалён',
      // English sets no quotes of its own here: the name as typed.
      'The project «Вишнёвый сад» has been deleted',
    ]);

    await notifyMemberJoined('"Der Kirschgarten"', named('Anna Schmidt'), readersOf(), data.projectId);
    expect(bodies()).toEqual([
      'Anna Schmidt se unió al proyecto «Der Kirschgarten»',
      'Anna Schmidt ist dem Projekt „Der Kirschgarten“ beigetreten',
      'Anna Schmidt теперь в проекте «Der Kirschgarten»',
      'Anna Schmidt joined "Der Kirschgarten"',
    ]);

    await notifyMemberRemoved('„Die Räuber“', olga);
    expect(inboxOf(olga)[0].body).toBe('Вас удалили из проекта «Die Räuber»');
  });

  // Review of T-261: a mark right after a closing one read as an opening one,
  // and a name nested right lost its outer pair: „‚Durchlauf ‚Die Möwe‘‚“.
  it('a project named with quotes nested right keeps them', async () => {
    await notifyProjectDeleted('„Durchlauf ‚Die Möwe‘“', readersOf());
    expect(bodies()).toEqual([
      'El proyecto «Durchlauf “Die Möwe”» ha sido eliminado',
      'Das Projekt „Durchlauf ‚Die Möwe‘“ wurde gelöscht',
      'Проект «Durchlauf „Die Möwe“» удалён',
      'The project „Durchlauf ‚Die Möwe‘“ has been deleted',
    ]);

    await notifyRehearsalCreated({ ...rehearsal, title: '„Durchlauf ‚Die Möwe‘“' }, 'Hamlet', [{ user_id: klaus }], { now });
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Probe „Durchlauf ‚Die Möwe‘“ morgen um 21:00 angesetzt');
  });

  // Review of T-261, round 2: an apostrophe inside ‚…‘ closed the pair, and
  // ‚Actors’ Studio‘ read „‚Actors‘ Studio‘“. A single closing mark closes
  // only its own pair; else it is an apostrophe.
  it('an apostrophe inside German single quotes stays an apostrophe', async () => {
    await notifyProjectDeleted('‚Actors’ Studio‘', readersOf());
    expect(bodies()).toEqual([
      'El proyecto «Actors’ Studio» ha sido eliminado',
      'Das Projekt „Actors’ Studio“ wurde gelöscht',
      'Проект «Actors’ Studio» удалён',
      'The project ‚Actors’ Studio‘ has been deleted',
    ]);
  });

  it('quotes inside a rehearsal\'s title are the second level', async () => {
    await notifyRehearsalCreated({ ...rehearsal, title: 'Прогон «Чайки»' }, 'Hamlet', all(), { now });
    expect(bodies()).toEqual([
      'Hamlet: Ensayo «Прогон “Чайки”» programado para mañana a las 21:00',
      'Hamlet: Probe „Прогон ‚Чайки‘“ morgen um 21:00 angesetzt',
      'Hamlet: Репетиция «Прогон „Чайки“» назначена на завтра в 22:00',
      'Hamlet: Прогон «Чайки» scheduled tomorrow at 8:00 PM',
    ]);

    await notifyMemberResponse({ ...rehearsal, title: 'Szene „Fenster“' }, 'Hamlet', named('Anna Smith'), readersOf(), { now });
    expect(bodies()).toEqual([
      'Anna Smith ha visto «Szene “Fenster”» (mañana a las 21:00) en Hamlet',
      'Hamlet: Anna Smith hat die Probe „Szene ‚Fenster‘“ (morgen um 21:00) als gesehen markiert',
      'Hamlet: Szene „Fenster“, завтра в 22:00 — Anna Smith в курсе',
      'Anna Smith has seen “Szene ‘Fenster’” (tomorrow at 8:00 PM) in Hamlet',
    ]);

    await notifyRehearsalDeleted({ ...rehearsal, title: '“Escena del duelo”' }, 'Hamlet', [{ user_id: carmen }], { now });
    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Cancelado el ensayo «Escena del duelo» previsto para mañana a las 21:00');
  });

  it('a role given and a role taken away, in every language', async () => {
    for (const reader of readersOf()) await notifyRoleChanged('«Hamlet»', reader, 'admin');
    expect(bodies()).toEqual([
      'Ahora administras el proyecto «Hamlet»',
      'Du verwaltest jetzt das Projekt „Hamlet“',
      'Теперь вы администратор проекта «Hamlet»',
      'You are now an administrator of «Hamlet»',
    ]);

    for (const reader of readersOf()) await notifyRoleChanged('Bodas de sangre 2026', reader, 'member');
    expect(readersOf().map((reader) => inboxOf(reader)[0].title)).toEqual(['Cambio de rol', 'Rolle geändert', 'Изменение роли', 'Role Changed']);
    expect(bodies()).toEqual([
      'Ya no administras el proyecto «Bodas de sangre 2026»',
      'Du verwaltest das Projekt „Bodas de sangre 2026“ nicht mehr',
      'Вы больше не администратор проекта «Bodas de sangre 2026»',
      'You are no longer an administrator of Bodas de sangre 2026',
    ]);
  });

  it('Spanish: the project in quotes after "proyecto" in every notice about it', async () => {
    await notifyAdminAppointed('Bodas de sangre 2026', named('Lucía Martín'), [carmen], data.projectId);
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Permisos de administrador', body: 'Lucía Martín ahora administra el proyecto «Bodas de sangre 2026»' });
    await notifyMemberJoined('Hamlet', named('Lucía Martín'), [carmen], data.projectId);
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Nuevo miembro', body: 'Lucía Martín se unió al proyecto «Hamlet»' });
    await notifyMemberRemoved('Hamlet', carmen);
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ya no estás en el proyecto', body: 'Ya no formas parte del proyecto «Hamlet»' });
    await notifyProjectDeleted('Bodas de sangre 2026', [carmen]);
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Proyecto eliminado', body: 'El proyecto «Bodas de sangre 2026» ha sido eliminado' });
  });

  it('German: taken off a rehearsal, in a title that fits one line', async () => {
    await notifyRemovedFromRehearsal(rehearsal, 'Hamlet', [{ user_id: klaus }], { now });
    expect(inboxOf(klaus)[0]).toMatchObject({
      title: 'Nicht mehr eingeteilt',
      body: 'Hamlet: Probe „Full dress“, morgen um 21:00 – du bist nicht mehr dabei',
    });
  });
});

describe('No words for a notice nobody sends (T-251)', () => {
  it('"invited you to the project" is gone in every language', async () => {
    const { t } = await import('../../i18n/pushNotifications.js');
    for (const locale of ['ru', 'en', 'es', 'de']) expect(t(locale, 'projectInvite')).toBeUndefined();
  });
});

describe('"New member"', () => {
  it('carries its project, so a tap can open it', async () => {
    await notifyMemberJoined('Test Project', named('Nina Petrova'), [natasha], data.projectId);

    const [row] = inboxOf(natasha);
    expect(row.type).toBe('member_joined');
    expect(Number(row.data.projectId)).toBe(Number(data.projectId));
    expect(row.related_type).toBe('project');
    expect(Number(row.related_id)).toBe(Number(data.projectId));
  });
});
