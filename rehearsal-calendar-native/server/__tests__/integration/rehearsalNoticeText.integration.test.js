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

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Full dress назначена завтра в 22:00');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled tomorrow at 3:00 PM');
  });

  it('a changed rehearsal, with what changed', async () => {
    await notifyRehearsalUpdated(rehearsal, 'Hamlet', readers(), ['datetime'], { now });

    expect(inboxOf(natasha)[0].body).toBe('Hamlet: Full dress, завтра в 22:00 — дата/время');
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress, tomorrow at 3:00 PM — date/time');
  });

  it('a response names the rehearsal and when it is', async () => {
    // The response route hands over the row itself: starts_at.
    const row = { id: rehearsal.id, project_id: data.projectId, title: 'Full dress', starts_at: '2026-10-06T19:00:00.000Z' };
    await notifyMemberResponse(row, 'Hamlet', 'Ophelia Bright', [natasha, john], { now });

    expect(inboxOf(natasha)[0].body).toBe('Ophelia Bright откликнулся на «Full dress» (завтра в 22:00) в проекте Hamlet');
    expect(inboxOf(john)[0].body).toBe('Ophelia Bright responded to “Full dress” (tomorrow at 3:00 PM) in Hamlet');
  });

  it('further out, the date', async () => {
    await notifyRehearsalCreated(rehearsal, 'Hamlet', readers(), { now: new Date('2026-10-01T06:00:00Z') });

    expect(inboxOf(natasha)[0].body).toMatch(/^Hamlet: Full dress назначена вт, 6 окт\.? в 22:00$/);
    expect(inboxOf(john)[0].body).toBe('Hamlet: Full dress scheduled on Tue, Oct 6 at 3:00 PM');
  });
});

describe('Put on or taken off a rehearsal (T-233)', () => {
  it('whoever is added is told which one, when and where, and a tap opens it', async () => {
    await notifyAddedToRehearsal({ ...rehearsal, location: 'Main stage' }, 'Hamlet', readers(), { now });

    const [ru] = inboxOf(natasha);
    const [en] = inboxOf(john);
    expect(ru.title).toBe('Вас добавили в репетицию');
    expect(ru.body).toBe('Hamlet: Full dress назначена завтра в 22:00, место: Main stage');
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
