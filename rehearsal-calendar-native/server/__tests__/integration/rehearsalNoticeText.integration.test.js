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

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Репетиция «Full dress» назначена завтра в 22:00');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled tomorrow at 3:00 PM');
  });

  it('a changed rehearsal, with what changed', async () => {
    await notifyRehearsalUpdated(rehearsal, 'Hamlet', readers(), ['datetime'], { now });

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Full dress — теперь завтра в 22:00');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress — now tomorrow at 3:00 PM');
  });

  it('a "seen" names the rehearsal and when it is', async () => {
    // The seen route hands over the row itself: starts_at.
    const row = { id: rehearsal.id, project_id: data.projectId, title: 'Full dress', starts_at: '2026-10-06T19:00:00.000Z' };
    await notifyMemberResponse(row, 'Hamlet', 'Ophelia Bright', [natasha, john], { now });

    expect(inboxOf(natasha)[0].body).toBe('Ophelia Bright в курсе: «Full dress» (завтра в 22:00), Hamlet');
    expect(inboxOf(john)[0].body).toBe('Ophelia Bright has seen “Full dress” (tomorrow at 3:00 PM) in Hamlet');
  });

  it('further out, the date', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', readers(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(natasha)[0].body).toMatch(/^Hamlet: Репетиция «Full dress» назначена вт, 6 окт\.? в 22:00$/);
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled on Tue, Oct 6 at 3:00 PM');
  });
});

describe('Put on or taken off a rehearsal (T-233)', () => {
  it('whoever is added is told which one, when and where, and a tap opens it', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', readers(), { now });

    const [ru] = inboxOf(natasha);
    const [en] = inboxOf(john);
    expect(ru.title).toBe('Вас добавили в репетицию');
    expect(ru.body).toBe('Hamlet: Репетиция «Full dress» назначена завтра в 22:00, место: Main stage');
    expect(en.title).toBe('You were added to a rehearsal');
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
    expect(ru.title).toBe('Вас убрали из репетиции');
    expect(ru.body).toBe('Hamlet: Full dress, завтра в 22:00 — вас убрали из состава');
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
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress morgen um 21:00 angesetzt');
  });

  it('a new rehearsal today', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-06T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para hoy a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress heute um 21:00 angesetzt');
  });

  it('a new rehearsal further out, on its date', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para el mar, 6 oct a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress am Di., 6. Okt. um 21:00 angesetzt');
  });

  it('added to one, with and without a place', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', latins(), { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para mañana a las 21:00 en Main stage');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress morgen um 21:00 angesetzt, Ort: Main stage');

    await notifyAddedToRehearsal(rehearsal, 'Hamlet', latins(), { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para mañana a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress morgen um 21:00 angesetzt');
  });

  it('added to one on its date, with a place', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', latins(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para el mar, 6 oct a las 21:00 en Main stage');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress am Di., 6. Okt. um 21:00 angesetzt, Ort: Main stage');
  });

  it('added to one today', async () => {
    await notifyAddedToRehearsal(rehearsal, 'Hamlet', latins(), { now: new Date('2026-10-06T06:00:00Z') });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo «Full dress» programado para hoy a las 21:00');
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Full dress heute um 21:00 angesetzt');
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
    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция «Прогон» назначена завтра в 22:00');
  });

  it('added to one with a neuter title in Russian', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, title: 'Чтение', location: 'Зал 2' }, 'Гамлет', [{ user_id: olga }], { now });

    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция «Чтение» назначена завтра в 22:00, место: Зал 2');
  });

  it('with no title, the word "rehearsal" alone', async () => {
    await notifyRehearsalCreated({ ...rehearsal, title: '' }, 'Hamlet', [{ user_id: carmen }, { user_id: olga }], { now });

    expect(inboxOf(carmen)[0].body).toBe('Hamlet: Ensayo programado para mañana a las 21:00');
    expect(inboxOf(olga)[0].body).toBe('Hamlet: Репетиция назначена завтра в 22:00');
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
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Прогон' }, 'Гамлет', [{ user_id: olga }]);
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Escena del balcón' }, 'Hamlet', [{ user_id: carmen }]);
    await notifyRehearsalDeleted({ ...rehearsal, title: 'Fechtszene' }, 'Hamlet', [{ user_id: klaus }]);

    expect(inboxOf(olga)[0]).toMatchObject({ title: 'Отменена репетиция', body: 'Гамлет: Репетиция «Прогон» отменена' });
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ensayo cancelado', body: 'Hamlet: Ensayo «Escena del balcón» cancelado' });
    expect(inboxOf(klaus)[0].body).toBe('Hamlet: Fechtszene abgesagt');
  });

  it('a cancelled rehearsal with no title', async () => {
    await notifyRehearsalDeleted({ ...rehearsal, title: '' }, 'Гамлет', [{ user_id: olga }, { user_id: carmen }]);

    expect(inboxOf(olga)[0].body).toBe('Гамлет: Репетиция отменена');
    expect(inboxOf(carmen)[0].body).toBe('Гамлет: Ensayo cancelado');
  });

  it('a woman and a man who join read the same', async () => {
    await notifyMemberJoined('Гамлет', 'Офелия Полониева', [olga], data.projectId);
    expect(inboxOf(olga)[0].body).toBe('Офелия Полониева теперь в проекте Гамлет');

    await notifyMemberJoined('Гамлет', 'Гамлет Датский', [olga], data.projectId);
    expect(inboxOf(olga)[0].body).toBe('Гамлет Датский теперь в проекте Гамлет');
  });

  it('a woman and a man who have seen a rehearsal read the same, in the app\'s word', async () => {
    const row = { id: rehearsal.id, project_id: data.projectId, title: 'Сцена с письмом', starts_at: '2026-10-06T09:00:00.000Z' };
    await notifyMemberResponse(row, 'Иллирия', 'Виола Себастьянова', [olga, carmen, klaus], { now });
    expect(inboxOf(olga)[0]).toMatchObject({ title: 'Репетиция просмотрена', body: 'Виола Себастьянова в курсе: «Сцена с письмом» (завтра в 12:00), Иллирия' });
    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ensayo visto', body: 'Виола Себастьянова ha visto «Сцена с письмом» (mañana a las 11:00) en Иллирия' });
    expect(inboxOf(klaus)[0]).toMatchObject({ title: 'Probe gesehen', body: 'Виола Себастьянова hat „Сцена с письмом“ (morgen um 11:00) in Иллирия gesehen' });

    await notifyMemberResponse(row, 'Иллирия', 'Мальволио Стюард', [olga, john], { now });
    expect(inboxOf(olga)[0].body).toBe('Мальволио Стюард в курсе: «Сцена с письмом» (завтра в 12:00), Иллирия');
    expect(inboxOf(john)[0]).toMatchObject({ title: 'Rehearsal seen', body: 'Мальволио Стюард has seen “Сцена с письмом” (tomorrow at 5:00 AM) in Иллирия' });
  });

  it('a role given reads right in Russian, and agrees with no reader in Spanish and German', async () => {
    for (const reader of [olga, carmen, klaus, john]) {
      await notifyRoleChanged('Hamlet', reader, 'admin');
    }
    expect(inboxOf(olga)[0].body).toBe('Теперь вы администратор проекта Hamlet');
    expect(inboxOf(carmen)[0].body).toBe('Ahora administras Hamlet');
    expect(inboxOf(klaus)[0].body).toBe('Du verwaltest jetzt Hamlet');
    expect(inboxOf(john)[0].body).toBe('You are now an administrator of Hamlet');

    for (const reader of [olga, carmen, klaus, john]) {
      await notifyRoleChanged('Hamlet', reader, 'member');
    }
    expect(inboxOf(olga)[0].body).toBe('Теперь вы участник проекта Hamlet');
    expect(inboxOf(carmen)[0].body).toBe('Ahora eres miembro de Hamlet');
    expect(inboxOf(klaus)[0].body).toBe('Du bist jetzt Mitglied in Hamlet');
    expect(inboxOf(john)[0].body).toBe('You are now a member of Hamlet');
  });

  it('someone removed from a project, in Spanish, is no participle', async () => {
    await notifyMemberRemoved('Hamlet', carmen);

    expect(inboxOf(carmen)[0]).toMatchObject({ title: 'Ya no estás en el proyecto', body: 'Ya no formas parte del proyecto Hamlet' });
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
      'Лебединое озеро: Кордебалет – verlegt auf heute, 21:00',
      'Лебединое озеро: Кордебалет — теперь сегодня в 22:00',
      'Лебединое озеро: Кордебалет — now today at 8:00 PM',
    ]);
  });

  it('moved to a date: "al", not "a el"; "auf Di.", not "auf am"', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['datetime'], { now: new Date('2026-10-01T06:00:00Z') });

    const [es, de, ru, en] = bodies();
    expect(es).toBe('Лебединое озеро: Кордебалет, pasa al mar, 6 oct a las 21:00');
    expect(de).toBe('Лебединое озеро: Кордебалет – verlegt auf Di., 6. Okt., 21:00');
    expect(ru).toMatch(/^Лебединое озеро: Кордебалет — теперь вт, 6 окт\.? в 22:00$/);
    expect(en).toBe('Лебединое озеро: Кордебалет — now on Tue, Oct 6 at 8:00 PM');
  });

  it('moved and to a new place', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['datetime', 'location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, pasa a mañana a las 21:00 en Зал 2',
      'Лебединое озеро: Кордебалет – verlegt auf morgen, 21:00, Ort: Зал 2',
      'Лебединое озеро: Кордебалет — теперь завтра в 22:00, место: Зал 2',
      'Лебединое озеро: Кордебалет — now tomorrow at 8:00 PM at Зал 2',
    ]);
  });

  it('a new place only: which', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — nuevo lugar: Зал 2',
      'Лебединое озеро: Кордебалет, morgen um 21:00 – neuer Ort: Зал 2',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — новое место: Зал 2',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — new location: Зал 2',
    ]);
  });

  it('the place taken away', async () => {
    await notifyRehearsalUpdated({ ...swan, location: '' }, 'Лебединое озеро', all(), ['location'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — ya sin lugar asignado',
      'Лебединое озеро: Кордебалет, morgen um 21:00 – kein Ort mehr',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — место больше не указано',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — no location now',
    ]);
  });

  it('renamed: the new name, and that it is one', async () => {
    await notifyRehearsalUpdated(swan, 'Лебединое озеро', all(), ['title'], { now });

    expect(bodies()).toEqual([
      'Лебединое озеро: Кордебалет, mañana a las 21:00 — nuevo nombre',
      'Лебединое озеро: Кордебалет, morgen um 21:00 – neuer Titel',
      'Лебединое озеро: Кордебалет, завтра в 22:00 — новое название',
      'Лебединое озеро: Кордебалет, tomorrow at 8:00 PM — renamed',
    ]);
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
    await notifyMemberJoined('Test Project', 'Nina Petrova', [natasha], data.projectId);

    const [row] = inboxOf(natasha);
    expect(row.type).toBe('member_joined');
    expect(Number(row.data.projectId)).toBe(Number(data.projectId));
    expect(row.related_type).toBe('project');
    expect(Number(row.related_id)).toBe(Number(data.projectId));
  });
});
