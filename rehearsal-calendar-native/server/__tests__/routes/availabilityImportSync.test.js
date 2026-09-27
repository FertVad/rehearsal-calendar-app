/**
 * POST /api/native/availability/imported/sync — calendar import, reconciled on
 * the server within the calendars a device names (R7: EI01, EI03, EI04).
 *
 * The app used to diff its phone's events against every imported row of the
 * person, from every device, and delete whatever its phone did not have: a sync
 * on the second phone deleted what the first had imported (EI01), and the move
 * of a recurring event went out as a delete and an add that could half-happen
 * (EI04). A device now names its calendars — the ones it read, the ones it
 * could not read, and all it has — and the server replaces rows only inside the
 * calendars read, in one transaction. That transaction is shown on PostgreSQL
 * (r7Import.mjs).
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let userId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);
  userId = Number(testData.memberId);

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const availabilityRouter = (await import('../../routes/native/availability.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/availability', availabilityRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run(`UPDATE native_users SET timezone = 'UTC' WHERE id = ?`, [userId]);
});

const auth = () => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const WINDOW = { from: '2026-10-01T00:00:00.000Z', to: '2027-10-01T00:00:00.000Z', firstDate: '2026-10-01', lastDate: '2027-09-30' };
const event = (key, day, hour = 10, isAllDay = false) => ({
  key,
  startsAt: `2026-10-${day}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  endsAt: `2026-10-${day}T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
  isAllDay,
});
const sync = (body) => request(app).post('/api/native/availability/imported/sync').set(...auth())
  .send({ source: 'apple_calendar', window: WINDOW, unreadable: [], ...body });
const keys = () => testDb.all(
  `SELECT external_event_id FROM native_user_availability WHERE user_id = ? ORDER BY external_event_id`, [userId],
).map((row) => row.external_event_id);
const legacy = (key, day = '05') => testDb.run(
  `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title)
   VALUES (?, ?, ?, 'busy', 'apple_calendar', ?, 'Calendar Event')`,
  [userId, `2026-10-${day}T10:00:00.000Z`, `2026-10-${day}T11:00:00.000Z`, key],
);

describe('Two devices of one person', () => {
  it('a sync on the second phone leaves what the first imported (EI01)', async () => {
    expect((await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] })).status).toBe(200);
    expect((await sync({ deviceCalendars: ['B-work'], calendars: [{ calendarId: 'B-work', events: [event('e9', '03')] }] })).status).toBe(200);

    expect(keys()).toEqual(['cal:A-work|e1', 'cal:B-work|e9']);
  });
});

describe('Within one device', () => {
  beforeEach(async () => {
    await sync({ deviceCalendars: ['A-work', 'A-home'], calendars: [
      { calendarId: 'A-work', events: [event('e1', '02'), event('e2', '03')] },
      { calendarId: 'A-home', events: [event('h1', '04')] },
    ] });
  });

  it('replaces a calendar it read with what it read', async () => {
    const res = await sync({ deviceCalendars: ['A-work', 'A-home'], calendars: [
      { calendarId: 'A-work', events: [event('e1', '02', 12), event('e3', '06')] },
      { calendarId: 'A-home', events: [event('h1', '04')] },
    ] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, updated: 1, removed: 1, unchanged: 1, held: 3 });
    expect(keys()).toEqual(['cal:A-home|h1', 'cal:A-work|e1', 'cal:A-work|e3']);
  });

  it('keeps a calendar it could not read', async () => {
    await sync({ deviceCalendars: ['A-work', 'A-home'], unreadable: ['A-home'],
      calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] });

    expect(keys()).toContain('cal:A-home|h1');
  });

  it('clears a calendar no longer chosen on this device', async () => {
    await sync({ deviceCalendars: ['A-work', 'A-home'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] });

    expect(keys()).toEqual(['cal:A-work|e1']);
  });

  it('moves a recurring occurrence in the same request: the old time goes as the new one arrives (EI04)', async () => {
    const res = await sync({ deviceCalendars: ['A-work', 'A-home'], calendars: [
      { calendarId: 'A-work', events: [event('e1', '02'), event('e2:moved', '03', 15)] },
      { calendarId: 'A-home', events: [event('h1', '04')] },
    ] });

    expect(res.status).toBe(200);
    expect(keys()).toEqual(['cal:A-home|h1', 'cal:A-work|e1', 'cal:A-work|e2:moved']);
  });

  it('leaves rows outside the window it read', async () => {
    testDb.run(`UPDATE native_user_availability SET starts_at = ?, ends_at = ? WHERE external_event_id = ?`,
      ['2026-09-01T10:00:00.000Z', '2026-09-01T11:00:00.000Z', 'cal:A-work|e2']);

    await sync({ deviceCalendars: ['A-work', 'A-home'], calendars: [
      { calendarId: 'A-work', events: [event('e1', '02')] },
      { calendarId: 'A-home', events: [event('h1', '04')] },
    ] });

    expect(keys()).toContain('cal:A-work|e2');
  });
});

describe('The edges of the window (R7-02)', () => {
  const allDay = (key, date) => testDb.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
     VALUES (?, ?, ?, 'busy', 'apple_calendar', ?, 'Calendar Event', 1)`,
    [userId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`, `cal:A-work|${key}`],
  );
  const timed = (key, startsAt, endsAt) => testDb.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
     VALUES (?, ?, ?, 'busy', 'apple_calendar', ?, 'Calendar Event', 0)`,
    [userId, startsAt, endsAt, `cal:A-work|${key}`],
  );
  const empty = (window) => sync({ window, deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] });

  it('ahead of UTC, yesterday\'s whole day is not taken for read, and today\'s is', async () => {
    // Read from midnight of 2 October in UTC+3, which is 21:00 on 1 October in UTC.
    allDay('oct-1', '2026-10-01');
    allDay('oct-2', '2026-10-02');

    const res = await empty({ from: '2026-10-02T00:00:00+03:00', to: '2027-10-02T00:00:00+03:00',
      firstDate: '2026-10-02', lastDate: '2027-10-01' });

    expect(res.status).toBe(200);
    expect(keys()).toEqual(['cal:A-work|oct-1']);
  });

  it('behind UTC, the whole day after the window is not taken for read', async () => {
    // Read to midnight of 1 October 2027 in UTC−5, which is 05:00 that day in UTC.
    allDay('last', '2027-09-30');
    allDay('after', '2027-10-01');

    const res = await empty({ from: '2026-10-01T00:00:00-05:00', to: '2027-10-01T00:00:00-05:00',
      firstDate: '2026-10-01', lastDate: '2027-09-30' });

    expect(res.status).toBe(200);
    expect(keys()).toEqual(['cal:A-work|after']);
  });

  it('keeps an event that only touches the window when the read did not return it', async () => {
    timed('touching', '2026-09-30T23:00:00.000Z', '2026-10-01T00:00:00.000Z');
    timed('crossing', '2026-09-30T23:00:00.000Z', '2026-10-01T01:00:00.000Z');

    await empty(WINDOW);

    expect(keys()).toEqual(['cal:A-work|touching']);
  });

  it('takes an event that only touches the window when the read did return it', async () => {
    const res = await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [
      { key: 'next-day', startsAt: '2027-10-01T00:00:00.000Z', endsAt: '2027-10-01T23:59:59.999Z', isAllDay: true },
      { key: 'ends-at-start', startsAt: '2026-09-30T23:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', isAllDay: false },
    ] }] });

    expect(res.status).toBe(200);
    expect(keys()).toEqual(['cal:A-work|ends-at-start', 'cal:A-work|next-day']);
  });
});

describe('Rows from before this contract', () => {
  it('are taken into the calendar that still has them, not duplicated', async () => {
    legacy('L1');
    legacy('L2', '06');

    const res = await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('L1', '05')] }] });

    expect(res.body).toMatchObject({ adopted: 1 });
    // L2 is nobody's to delete by absence: only "remove all imported" does.
    expect(keys()).toEqual(['L2', 'cal:A-work|L1']);
  });

  it('an older app cannot delete another device\'s rows through the old batch delete', async () => {
    await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] });
    legacy('L2', '06');

    const res = await request(app).delete('/api/native/availability/imported/batch').set(...auth())
      .send({ eventIds: ['cal:A-work|e1', 'L2'] });

    expect(res.status).toBe(200);
    expect(keys()).toEqual(['cal:A-work|e1']);
  });
});

describe('Removing all imported events (EI03)', () => {
  it('removes every imported row on the server, whatever the phone remembers', async () => {
    await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] });
    legacy('L2', '06');

    const res = await request(app).delete('/api/native/availability/imported/all').set(...auth());

    expect(res.body).toEqual({ success: true, deletedCount: 2 });
    expect(keys()).toEqual([]);
  });
});

describe('A request with anything wrong in it changes nothing', () => {
  beforeEach(async () => {
    await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] });
  });

  it.each([
    ['a source the app never imports', { source: 'rehearsal', deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] }],
    ['a calendar id with the separator in it', { deviceCalendars: ['A|work'], calendars: [{ calendarId: 'A|work', events: [] }] }],
    ['a calendar the device does not list', { deviceCalendars: ['A-work'], calendars: [{ calendarId: 'X', events: [] }] }],
    ['a calendar both read and unreadable', { deviceCalendars: ['A-work'], unreadable: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] }],
    ['an event ending before it starts', { deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work',
      events: [{ key: 'bad', startsAt: '2026-10-02T11:00:00.000Z', endsAt: '2026-10-02T10:00:00.000Z', isAllDay: false }] }] }],
    ['one key twice in a calendar', { deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('d', '02'), event('d', '03')] }] }],
    ['a window longer than a year and a month', { window: { from: '2026-10-01T00:00:00.000Z', to: '2028-10-01T00:00:00.000Z',
      firstDate: '2026-10-01', lastDate: '2028-09-30' }, deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] }],
    ['a window without its dates', { window: { from: WINDOW.from, to: WINDOW.to },
      deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] }],
    ['window dates that are not the dates of its instants', { window: { ...WINDOW, firstDate: '2026-10-05' },
      deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [] }] }],
    ['an event the read could not have returned', { deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work',
      events: [{ key: 'old', startsAt: '2020-10-02T10:00:00.000Z', endsAt: '2020-10-02T11:00:00.000Z', isAllDay: false }] }] }],
  ])('refuses %s', async (_label, body) => {
    const res = await sync(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IMPORT_INVALID');
    expect(keys()).toEqual(['cal:A-work|e1']);
  });
});
