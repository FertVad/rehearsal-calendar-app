/**
 * How busy time is cut into days for the Smart Planner.
 *
 * The wire format is (date → list of HH:mm–HH:mm), which cannot express a span,
 * so a stored instant range has to be cut into one range per day it covers.
 * Nothing did that: a record was bucketed on its start date alone, and the
 * query filtered on starts_at alone.
 *
 * Both failures point the same dangerous way — the planner reads the person as
 * FREE when they are not:
 *
 *  - a tour Monday 10:00 → Wednesday 18:00 arrived as "Monday 10:00–18:00",
 *    leaving Tuesday and Wednesday Perfect;
 *  - a span crossing local midnight came back as 22:00–02:00, which the client
 *    drops entirely because the end is not after the start, so the whole
 *    evening read free;
 *  - a span that began before the window and ran into it was never fetched.
 *
 * The midnight case needs no exotic input: the availability editor supports an
 * overnight slot on purpose, and an ordinary 21:00–23:00 rehearsal becomes one
 * for a teammate a couple of timezones east.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

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
    notifyMemberResponse: noop,
    notifyMemberJoined: noop,
    notifyAdminAppointed: noop,
    notifyRoleChanged: noop,
    notifyMemberRemoved: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  const membersRouter = (await import('../../routes/native/members.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', membersRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  setRequesterTimezone('UTC');
});

const setRequesterTimezone = (tz) =>
  testDb.run('UPDATE native_users SET timezone = ? WHERE id = ?', [tz, testData.adminId]);

const busy = (startsAt, endsAt, { allDay = false, source = 'manual' } = {}) =>
  testDb.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, is_all_day)
     VALUES (?, ?, ?, 'busy', ?, ?)`,
    [testData.memberId, startsAt, endsAt, source, allDay ? 1 : 0]
  );

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const fetchRange = async (startDate, endDate) => {
  const res = await request(app)
    .get(`/api/native/projects/${testData.projectId}/members/availability`)
    .query({ startDate, endDate })
    .set(...auth(testData.adminId));
  expect(res.status).toBe(200);
  const forMember = res.body.availability.find((a) => Number(a.userId) === Number(testData.memberId));
  return forMember?.dates ?? [];
};

const on = (dates, date) => dates.find((d) => d.date === date)?.timeRanges ?? [];
const spans = (ranges) => ranges.map((r) => `${r.start}-${r.end}`);

describe('members availability range — cutting spans into days', () => {
  it('leaves a range inside one day alone', async () => {
    busy('2026-12-01T10:00:00.000Z', '2026-12-01T12:00:00.000Z');

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['10:00-12:00']);
    expect(on(dates, '2026-12-02')).toEqual([]);
  });

  it('splits a span crossing midnight across both days instead of dropping it', async () => {
    busy('2026-12-01T22:00:00.000Z', '2026-12-02T02:00:00.000Z');

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['22:00-23:59']);
    expect(spans(on(dates, '2026-12-02'))).toEqual(['00:00-02:00']);
  });

  it('covers every day of a multi-day span, not just the first', async () => {
    busy('2026-12-01T10:00:00.000Z', '2026-12-03T18:00:00.000Z');

    const dates = await fetchRange('2026-12-01', '2026-12-04');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['10:00-23:59']);
    expect(spans(on(dates, '2026-12-02'))).toEqual(['00:00-23:59']);
    expect(spans(on(dates, '2026-12-03'))).toEqual(['00:00-18:00']);
    expect(on(dates, '2026-12-04')).toEqual([]);
  });

  it('finds a span that began before the window and runs into it', async () => {
    busy('2026-11-20T09:00:00.000Z', '2026-12-02T17:00:00.000Z');

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['00:00-23:59']);
    expect(spans(on(dates, '2026-12-02'))).toEqual(['00:00-17:00']);
  });

  it('does not leave an empty range when a span ends exactly at midnight', async () => {
    busy('2026-12-01T22:00:00.000Z', '2026-12-02T00:00:00.000Z');

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['22:00-23:59']);
    expect(on(dates, '2026-12-02')).toEqual([]);
  });

  it('covers every day of a multi-day all-day entry', async () => {
    busy('2026-12-01T00:00:00.000Z', '2026-12-03T23:59:59.999Z', { allDay: true });

    const dates = await fetchRange('2026-12-01', '2026-12-04');

    for (const day of ['2026-12-01', '2026-12-02', '2026-12-03']) {
      expect(spans(on(dates, day))).toEqual(['00:00-23:59']);
    }
    expect(on(dates, '2026-12-04')).toEqual([]);
  });

  it('splits by the requester’s clock, so an evening rehearsal spills east', async () => {
    setRequesterTimezone('Asia/Tokyo'); // UTC+9

    // 21:00–23:00 in London on the 1st is 06:00–08:00 on the 2nd in Tokyo.
    busy('2026-12-01T21:00:00.000Z', '2026-12-01T23:00:00.000Z', { source: 'rehearsal' });

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(on(dates, '2026-12-01')).toEqual([]);
    expect(spans(on(dates, '2026-12-02'))).toEqual(['06:00-08:00']);
  });

  it('keeps a Tokyo requester’s evening rehearsal whole across their midnight', async () => {
    setRequesterTimezone('Asia/Tokyo');

    // 22:00 Tokyo on the 1st → 01:00 Tokyo on the 2nd.
    busy('2026-12-01T13:00:00.000Z', '2026-12-01T16:00:00.000Z', { source: 'rehearsal' });

    const dates = await fetchRange('2026-12-01', '2026-12-03');

    expect(spans(on(dates, '2026-12-01'))).toEqual(['22:00-23:59']);
    expect(spans(on(dates, '2026-12-02'))).toEqual(['00:00-01:00']);
  });
});
