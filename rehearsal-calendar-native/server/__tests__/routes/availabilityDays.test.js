/**
 * PUT /api/native/availability/days — the editor's save (R6: CC05, C02, C03).
 *
 * The editor used to post its whole snapshot to /bulk, which replaced every
 * day the snapshot named: a day loaded an hour ago overwrote whatever had been
 * saved to it since, from another device. The days a save replaces are now
 * named by the client — the ones the person changed — and each is replaced by
 * exactly what is sent, [] clearing it. The whole request is checked before
 * the first row goes (C02: a slot without an end used to empty the day and
 * answer success). Concurrent saves of one person are serialised on their user
 * row (C03); that half is shown on PostgreSQL (r6Availability.mjs).
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let userId;
let otherId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);
  userId = Number(testData.memberId);
  otherId = Number(testData.adminId);

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

const insert = (owner, startsAt, endsAt, { type = 'busy', source = 'manual', allDay = false, externalId = null } = {}) =>
  testDb.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, is_all_day, external_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [owner, startsAt, endsAt, type, source, allDay ? 1 : 0, externalId]
  );

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run(`UPDATE native_users SET timezone = 'Europe/Berlin' WHERE id IN (?, ?)`, [userId, otherId]);
  // 1 October: busy 10–12 by hand, plus a rehearsal and an imported event.
  insert(userId, '2026-10-01T08:00:00.000Z', '2026-10-01T10:00:00.000Z');
  insert(userId, '2026-10-01T15:00:00.000Z', '2026-10-01T17:00:00.000Z', { source: 'rehearsal', externalId: '77' });
  insert(userId, '2026-10-01T05:00:00.000Z', '2026-10-01T06:00:00.000Z', { source: 'apple_calendar', externalId: 'ev-1' });
  // 2 October: free all day. 3 October: busy 14–16.
  insert(userId, '2026-10-02T00:00:00.000Z', '2026-10-02T23:59:59.999Z', { type: 'available', allDay: true });
  insert(userId, '2026-10-03T12:00:00.000Z', '2026-10-03T14:00:00.000Z');
  // Someone else's hand-entered 1 October.
  insert(otherId, '2026-10-01T08:00:00.000Z', '2026-10-01T10:00:00.000Z');
});

const auth = () => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const save = (days) => request(app).put('/api/native/availability/days').set(...auth()).send({ days });
// Instants, not strings: the harness keeps what was written, PostgreSQL keeps UTC.
const rowsOn = (owner, day) => testDb.all(
  `SELECT starts_at, ends_at, type, source FROM native_user_availability
   WHERE user_id = ? AND substr(starts_at, 1, 10) = ? ORDER BY starts_at, source`, [owner, day])
  .map((row) => ({ ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() }));
const timed = (startsAt, endsAt, type = 'busy') => ({ startsAt, endsAt, type, isAllDay: false });
const allDay = (date, type = 'busy') => ({ startsAt: `${date}T00:00:00.000Z`, endsAt: `${date}T23:59:59.999Z`, type, isAllDay: true });

describe('Saving the days the person changed', () => {
  it('replaces each named day with exactly what is sent, and clears one sent empty', async () => {
    const res = await save([
      { date: '2026-10-01', entries: [timed('2026-10-01T13:00:00+02:00', '2026-10-01T15:00:00+02:00')] },
      { date: '2026-10-02', entries: [] },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, days: ['2026-10-01', '2026-10-02'] });
    expect(rowsOn(userId, '2026-10-01').filter((row) => row.source === 'manual')).toEqual([
      { starts_at: '2026-10-01T11:00:00.000Z', ends_at: '2026-10-01T13:00:00.000Z', type: 'busy', source: 'manual' },
    ]);
    expect(rowsOn(userId, '2026-10-02')).toEqual([]);
  });

  it('leaves the days it does not name as they are', async () => {
    expect((await save([{ date: '2026-10-01', entries: [allDay('2026-10-01')] }])).status).toBe(200);
    expect(rowsOn(userId, '2026-10-02')).toHaveLength(1);
    expect(rowsOn(userId, '2026-10-03')).toHaveLength(1);
  });

  it('leaves the rehearsal and the imported event on a replaced day alone', async () => {
    expect((await save([{ date: '2026-10-01', entries: [] }])).status).toBe(200);
    expect(rowsOn(userId, '2026-10-01').map((row) => row.source).sort()).toEqual(['apple_calendar', 'rehearsal']);
  });

  it('touches nobody else\'s rows', async () => {
    expect((await save([{ date: '2026-10-01', entries: [] }])).status).toBe(200);
    expect(rowsOn(otherId, '2026-10-01')).toHaveLength(1);
  });
});

describe('A request with anything wrong in it changes nothing (C02)', () => {
  const valid = { date: '2026-10-02', entries: [allDay('2026-10-02', 'busy')] };
  it.each([
    ['a slot without an end', { date: '2026-10-01', entries: [{ startsAt: '2026-10-01T13:00:00+02:00', type: 'busy' }] }],
    ['an end before the start', { date: '2026-10-01', entries: [timed('2026-10-01T15:00:00+02:00', '2026-10-01T13:00:00+02:00')] }],
    ['a slot longer than a day', { date: '2026-10-01', entries: [timed('2026-10-01T13:00:00+02:00', '2026-10-02T14:00:00+02:00')] }],
    ['an unknown type', { date: '2026-10-01', entries: [timed('2026-10-01T13:00:00+02:00', '2026-10-01T15:00:00+02:00', 'tentative')] }],
    ['a time without a zone', { date: '2026-10-01', entries: [timed('2026-10-01T13:00:00', '2026-10-01T15:00:00')] }],
    ['a slot starting on another day', { date: '2026-10-01', entries: [timed('2026-10-04T13:00:00+02:00', '2026-10-04T15:00:00+02:00')] }],
    ['a whole day that is not that whole day', { date: '2026-10-01', entries: [allDay('2026-10-04')] }],
    ['a date that does not exist', { date: '2026-02-30', entries: [] }],
    ['a date that is not a date', { date: 'tomorrow', entries: [] }],
    ['entries that are not a list', { date: '2026-10-01', entries: 'none' }],
  ])('refuses %s, and keeps the other day in the request unwritten', async (_label, bad) => {
    const res = await save([valid, bad]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AVAILABILITY_INVALID');
    expect(rowsOn(userId, '2026-10-01').filter((row) => row.source === 'manual')).toHaveLength(1);
    expect(rowsOn(userId, '2026-10-02')).toEqual([
      { starts_at: '2026-10-02T00:00:00.000Z', ends_at: '2026-10-02T23:59:59.999Z', type: 'available', source: 'manual' },
    ]);
  });

  it('refuses a day named twice, no days, or no list at all', async () => {
    for (const days of [[valid, valid], [], undefined, 'all']) {
      const res = await save(days);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AVAILABILITY_INVALID');
    }
    expect(rowsOn(userId, '2026-10-02')).toHaveLength(1);
  });
});
