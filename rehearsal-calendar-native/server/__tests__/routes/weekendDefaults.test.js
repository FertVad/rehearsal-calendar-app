/**
 * Weekends busy by default (T-406), through the routes.
 *
 * The owner: "if a day is marked busy, by default or by the person, that is
 * enough for the planner". Each person's weekends — the days of the country
 * of their profile's zone — are real "busy all day" rows of source 'weekend',
 * laid out a year ahead by the reads of availability (their own screen, any
 * planner); the switch takes them away from today on and lays them out again.
 * services/availability/weekendDefaults.js has the rules.
 *
 * The clock is the real one, and only Date is moved forward where time passes:
 * the dates below are found from today in each person's zone.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';
import { dateIn, addDays } from '../../utils/dateIn.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let loadFacts;
let member;
let admin;

const DAY_MS = 86400000;
const realNow = Date.now();

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);
  member = Number(testData.memberId);
  admin = Number(testData.adminId);

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));
  const noop = async () => ({ sent: 0, failed: 0, errors: [] });
  jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
    getUserPushTokens: async () => [],
    sendPushNotification: noop,
    notifyRehearsalCreated: noop,
    notifyRehearsalUpdated: noop,
    notifyRehearsalDeleted: noop,
    notifyAddedToRehearsal: noop,
    notifyRemovedFromRehearsal: noop,
    notifyMemberResponse: noop,
    notifyMemberJoined: noop,
    notifyAdminAppointed: noop,
    notifyRoleChanged: noop,
    notifyMemberRemoved: noop,
    notifyMemberLeft: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  ({ loadFacts } = await import('../../services/admin/people.js'));

  app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../../routes/auth.js')).default);
  app.use('/api/native/availability', (await import('../../routes/native/availability.js')).default);
  app.use('/api/native/projects', (await import('../../routes/native/members.js')).default);
});

afterAll(() => closeIntegrationDb());

// Only Date moves; timers, ticks and the network run as they do.
const moveClockTo = (ms) => {
  jest.useFakeTimers({ now: ms, doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'] });
};

beforeEach(() => {
  jest.useRealTimers();
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_member_availability_rate_limits');
  testDb.run(`UPDATE native_users SET weekends_busy = 1, weekends_through = NULL, weekends_days = NULL`);
  testDb.run(`UPDATE native_users SET timezone = 'Asia/Jerusalem' WHERE id = ?`, [member]);
  testDb.run(`UPDATE native_users SET timezone = 'Europe/Moscow' WHERE id = ?`, [admin]);
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const ok = (res) => {
  expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
  return res;
};
const readOwn = async (userId) => ok(await request(app).get('/api/native/availability').set(...auth(userId))).body;
const saveDays = async (userId, days) => ok(await request(app).put('/api/native/availability/days').set(...auth(userId)).send({ days }));
const setSwitch = (userId, enabled) => request(app).put('/api/native/availability/weekends').set(...auth(userId)).send({ enabled });
const planner = async (startDate, endDate) => ok(await request(app)
  .get(`/api/native/projects/${testData.projectId}/members/availability`)
  .query({ startDate, endDate }).set(...auth(admin))).body.availability;

const isoWeekday = (date) => ((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7) + 1;
const todayOf = (zone, now = Date.now()) => dateIn(now, zone);
/** The first date after today (in the zone) that is this ISO weekday, `weeks` weeks on. */
const next = (zone, weekday, weeks = 0) => {
  let date = addDays(todayOf(zone), 1);
  while (isoWeekday(date) !== weekday) date = addDays(date, 1);
  return addDays(date, 7 * weeks);
};
const rows = (userId, source) => testDb.all(
  `SELECT substr(starts_at, 1, 10) AS date, starts_at, ends_at, type, is_all_day, source, external_event_id
   FROM native_user_availability WHERE user_id = ? ${source ? 'AND source = ?' : ''} ORDER BY starts_at, source`,
  source ? [userId, source] : [userId]);
const weekendDates = (userId) => rows(userId, 'weekend').map((row) => row.date);
const onDate = (userId, date) => rows(userId).filter((row) => row.date === date);
const allDay = (date, type = 'busy') => ({ startsAt: `${date}T00:00:00.000Z`, endsAt: `${date}T23:59:59.999Z`, type, isAllDay: true });

describe('whose weekends', () => {
  it('lays out Friday and Saturday for Israel, Saturday and Sunday for Russia, a year ahead, whole days', async () => {
    await readOwn(member);
    await readOwn(admin);
    const israel = weekendDates(member);
    const russia = weekendDates(admin);
    expect(new Set(israel.map(isoWeekday))).toEqual(new Set([5, 6]));
    expect(new Set(russia.map(isoWeekday))).toEqual(new Set([6, 7]));
    expect(israel).toContain(next('Asia/Jerusalem', 5));
    expect(russia).toContain(next('Europe/Moscow', 7));
    // From today to a year on: no past day, about 104 days.
    expect(israel[0] >= todayOf('Asia/Jerusalem')).toBe(true);
    expect(israel[israel.length - 1] <= addDays(todayOf('Asia/Jerusalem'), 365)).toBe(true);
    expect(israel.length).toBeGreaterThanOrEqual(104);
    expect(israel.length).toBeLessThanOrEqual(106);
    // The rule of the whole day (CLAUDE.md 3), busy, keyed by its date.
    const friday = rows(member, 'weekend').find((row) => row.date === next('Asia/Jerusalem', 5));
    expect(friday).toMatchObject({ starts_at: `${friday.date}T00:00:00.000Z`, ends_at: `${friday.date}T23:59:59.999Z`,
      type: 'busy', is_all_day: 1, external_event_id: `weekend:${friday.date}` });
    // The app is shown them as busy all-day rows of their own source.
    const shown = (await readOwn(member)).find((row) => row.startsAt.startsWith(friday.date));
    // (The harness keeps the flag as 1; PostgreSQL answers true.)
    expect({ ...shown, isAllDay: Boolean(shown.isAllDay) }).toMatchObject({ type: 'busy', isAllDay: true, source: 'weekend' });
  });

  it('answers the switch with the days of the profile\'s zone', async () => {
    const res = ok(await request(app).get('/api/native/availability/weekends').set(...auth(member)));
    expect(res.body).toEqual({ enabled: true, days: [5, 6] });
  });
});

describe('the person\'s own marks', () => {
  it('are never touched, and a weekend day with one gets no default', async () => {
    const friday = next('Asia/Jerusalem', 5);
    const saturday = next('Asia/Jerusalem', 6);
    const laterFriday = next('Asia/Jerusalem', 5, 1);
    await saveDays(member, [
      { date: friday, entries: [allDay(friday, 'available')] },
      { date: saturday, entries: [{ startsAt: `${saturday}T10:00:00+02:00`, endsAt: `${saturday}T12:00:00+02:00`, type: 'busy', isAllDay: false }] },
      { date: laterFriday, entries: [allDay(laterFriday, 'busy')] },
    ]);
    const before = rows(member, 'manual');
    await readOwn(member);
    expect(rows(member, 'manual')).toEqual(before);
    for (const date of [friday, saturday, laterFriday]) {
      expect(onDate(member, date).map((row) => row.source)).toEqual(['manual']);
    }
    expect(weekendDates(member)).toContain(next('Asia/Jerusalem', 6, 1));
  });

  it('replaces the default: hours on a default day leave the hours, and an emptied day stays free as time goes on', async () => {
    await readOwn(member);
    const friday = next('Asia/Jerusalem', 5, 1);
    expect(onDate(member, friday).map((row) => row.source)).toEqual(['weekend']);

    await saveDays(member, [{ date: friday, entries: [{ startsAt: `${friday}T18:00:00+02:00`, endsAt: `${friday}T20:00:00+02:00`, type: 'busy', isAllDay: false }] }]);
    expect(onDate(member, friday).map((row) => [row.source, row.is_all_day])).toEqual([['manual', 0]]);

    // The hours taken off and saved: the day is free, now and after a month of reads.
    await saveDays(member, [{ date: friday, entries: [] }]);
    expect(onDate(member, friday)).toEqual([]);
    await readOwn(member);
    expect(onDate(member, friday)).toEqual([]);
    moveClockTo(realNow + 30 * DAY_MS);
    await readOwn(member);
    await planner(friday, friday);
    expect(onDate(member, friday)).toEqual([]);
    // …while the year ahead moved on with the clock.
    expect(weekendDates(member).at(-1) > addDays(todayOf('Asia/Jerusalem', realNow), 365)).toBe(true);
  });

  it('a whole default day replaced by "busy" is the person\'s own busy day', async () => {
    await readOwn(member);
    const saturday = next('Asia/Jerusalem', 6);
    await saveDays(member, [{ date: saturday, entries: [allDay(saturday, 'busy')] }]);
    expect(onDate(member, saturday).map((row) => row.source)).toEqual(['manual']);
  });

  it('an older app\'s bulk save and day delete replace it too (1.0.0)', async () => {
    await readOwn(member);
    const friday = next('Asia/Jerusalem', 5);
    const saturday = next('Asia/Jerusalem', 6);
    ok(await request(app).post('/api/native/availability/bulk').set(...auth(member))
      .send({ entries: [allDay(friday, 'available')] }));
    expect(onDate(member, friday).map((row) => [row.source, row.type])).toEqual([['manual', 'available']]);
    ok(await request(app).delete(`/api/native/availability/${saturday}`).set(...auth(member)));
    expect(onDate(member, saturday)).toEqual([]);
  });
});

describe('the switch', () => {
  it('off takes only the defaults away, and only from today on; on brings them back where nothing of the person\'s is', async () => {
    await readOwn(member);
    const today = todayOf('Asia/Jerusalem');
    // A default of a past weekend and the person's own marks, which stay.
    const pastFriday = addDays(next('Asia/Jerusalem', 5), -14);
    testDb.run(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source, external_event_id)
      VALUES (?, ?, ?, 'busy', 1, 'weekend', ?)`, [member, `${pastFriday}T00:00:00.000Z`, `${pastFriday}T23:59:59.999Z`, `weekend:${pastFriday}`]);
    const saturday = next('Asia/Jerusalem', 6, 2);
    await saveDays(member, [{ date: saturday, entries: [allDay(saturday, 'busy')] }]);
    const own = rows(member, 'manual');

    const off = ok(await setSwitch(member, false));
    expect(off.body).toEqual({ enabled: false, days: [5, 6] });
    expect(weekendDates(member)).toEqual([pastFriday]);
    expect(rows(member, 'manual')).toEqual(own);
    // Reads do not bring them back while it is off; the planner sees the days free.
    await readOwn(member);
    expect(weekendDates(member)).toEqual([pastFriday]);
    const friday = next('Asia/Jerusalem', 5);
    const memberRow = (await planner(friday, friday)).find((a) => Number(a.userId) === member);
    expect(memberRow.dates).toEqual([]);
    expect(weekendDates(member).filter((date) => date >= today)).toEqual([]);

    ok(await setSwitch(member, true));
    const back = weekendDates(member);
    expect(back).toContain(friday);
    expect(back).toContain(pastFriday);
    expect(back).not.toContain(saturday);
    expect(rows(member, 'manual')).toEqual(own);
  });

  it('on lays out again a weekend day the person had emptied', async () => {
    await readOwn(member);
    const friday = next('Asia/Jerusalem', 5);
    await saveDays(member, [{ date: friday, entries: [] }]);
    ok(await setSwitch(member, false));
    ok(await setSwitch(member, true));
    expect(onDate(member, friday).map((row) => row.source)).toEqual(['weekend']);
  });

  it('takes only true or false', async () => {
    for (const enabled of ['false', 0, null, undefined]) {
      expect((await setSwitch(member, enabled)).status).toBe(400);
    }
  });
});

describe('a change of zone to another country', () => {
  it('moves the defaults from today on; a Saturday the person emptied stays empty', async () => {
    await readOwn(member);
    const emptied = next('Asia/Jerusalem', 6, 1);
    await saveDays(member, [{ date: emptied, entries: [] }]);
    const today = todayOf('Asia/Jerusalem');

    ok(await request(app).put('/api/auth/me').set(...auth(member)).send({ timezone: 'Europe/Moscow' }));
    await readOwn(member);

    const after = weekendDates(member).filter((date) => date >= addDays(today, 1));
    expect(new Set(after.map(isoWeekday))).toEqual(new Set([6, 7]));
    expect(after).toContain(next('Europe/Moscow', 7));
    expect(after).toContain(next('Europe/Moscow', 6));
    expect(after).not.toContain(emptied);
    expect(ok(await request(app).get('/api/native/availability/weekends').set(...auth(member))).body.days).toEqual([6, 7]);
  });
});

describe('calendar import and rehearsals', () => {
  const window = (first, last) => ({ from: `${first}T00:00:00.000Z`, to: `${addDays(last, 1)}T00:00:00.000Z`, firstDate: first, lastDate: last });

  it('a sync and "Delete imported" leave the defaults, and imported events do not stop them', async () => {
    const friday = next('Asia/Jerusalem', 5);
    const saturday = next('Asia/Jerusalem', 6);
    // Imported before any default was laid out.
    ok(await request(app).post('/api/native/availability/imported/sync').set(...auth(member)).send({
      source: 'apple_calendar', window: window(friday, saturday), deviceCalendars: ['cal-1'], unreadable: [],
      calendars: [{ calendarId: 'cal-1', events: [
        { key: 'e1', ...allDay(friday) },
        { key: 'e2', startsAt: `${saturday}T08:00:00.000Z`, endsAt: `${saturday}T09:00:00.000Z`, isAllDay: false },
      ] }],
    }));
    await readOwn(member);
    const laid = rows(member, 'weekend');
    expect(laid.map((row) => row.date)).toEqual(expect.arrayContaining([friday, saturday]));

    // A sync that drops the events, then "Delete imported".
    ok(await request(app).post('/api/native/availability/imported/sync').set(...auth(member)).send({
      source: 'apple_calendar', window: window(friday, saturday), deviceCalendars: ['cal-1'], unreadable: [],
      calendars: [{ calendarId: 'cal-1', events: [] }],
    }));
    ok(await request(app).delete('/api/native/availability/imported/all').set(...auth(member)));
    expect(rows(member, 'weekend')).toEqual(laid);
  });

  it('a rehearsal on a weekend day neither stops the default nor is replaced by it', async () => {
    const friday = next('Asia/Jerusalem', 5);
    testDb.run(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
      VALUES (?, ?, ?, 'busy', 'rehearsal', '77')`, [member, `${friday}T16:00:00.000Z`, `${friday}T18:00:00.000Z`]);
    await readOwn(member);
    expect(onDate(member, friday).map((row) => row.source).sort()).toEqual(['rehearsal', 'weekend']);
  });
});

describe('requests at once', () => {
  it('write each day once', async () => {
    await Promise.all([
      readOwn(member), readOwn(member), planner(next('Asia/Jerusalem', 5), next('Asia/Jerusalem', 6)),
      setSwitch(member, true), readOwn(member),
    ]);
    const dates = weekendDates(member);
    expect(new Set(dates).size).toBe(dates.length);
    // The key does it, not a lookup: a second row of a day is refused by the database.
    const [day] = dates;
    expect(() => testDb.run(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source, external_event_id)
      VALUES (?, ?, ?, 'busy', 1, 'weekend', ?)`, [member, `${day}T00:00:00.000Z`, `${day}T23:59:59.999Z`, `weekend:${day}`]))
      .toThrow(/UNIQUE/);
  });
});

describe('the planner', () => {
  it('shows Israel busy on Friday and Russia on Sunday, for people who never opened the app since', async () => {
    // Nobody read their own availability: the planner lays the weekends out.
    const friday = next('Asia/Jerusalem', 5);
    const sunday = next('Europe/Moscow', 7);
    const first = friday < sunday ? friday : sunday;
    const last = friday < sunday ? sunday : friday;
    const shown = await planner(first, last);
    const of = (userId, date) => shown.find((a) => Number(a.userId) === userId).dates.find((d) => d.date === date)?.timeRanges;
    expect(of(member, friday)).toEqual([{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }]);
    expect(of(admin, sunday)).toEqual([{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }]);
    expect(of(member, sunday)).toBeUndefined();
    expect(of(admin, friday)).toBeUndefined();
  });

  it('still says who has entered nothing themselves', async () => {
    const shown = await planner(next('Asia/Jerusalem', 5), next('Asia/Jerusalem', 6));
    expect(shown.find((a) => Number(a.userId) === member).hasData).toBe(false);
    expect(weekendDates(member).length).toBeGreaterThan(0);
  });
});

describe('the admin', () => {
  it('does not count the defaults as the person\'s marks', async () => {
    await readOwn(member);
    expect(weekendDates(member).length).toBeGreaterThan(100);
    expect((await loadFacts(testDb, [member])).get(member)?.marks ?? 0).toBe(0);
    const friday = next('Asia/Jerusalem', 5);
    await saveDays(member, [{ date: friday, entries: [allDay(friday, 'busy')] }]);
    expect((await loadFacts(testDb, [member])).get(member).marks).toBe(1);
  });
});
