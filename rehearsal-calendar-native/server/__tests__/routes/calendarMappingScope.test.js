/**
 * Export mapping deletes, within the calendars a device names (R7: ES02).
 *
 * The server keeps one mapping per connection, and a connection is one
 * calendar of one device. Deletes reached every connection of the person:
 * unsyncing on one phone took the other's mapping of the same rehearsal, and
 * "remove all exported" took every one of them, so the other phone's events
 * stayed in its calendar with nothing left pointing at them. A delete now names
 * the device's calendars, and only mappings recorded under them go.
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
  const calendarSyncRouter = (await import('../../routes/native/calendarSync.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/calendar-sync', calendarSyncRouter);
});

afterAll(() => closeIntegrationDb());

// Phone A exported rehearsals 42 and 43 into its calendar, phone B exported 42
// into its own; someone else's phone has a calendar of the same id as A's.
beforeEach(() => {
  testDb.run('DELETE FROM native_calendar_event_mappings');
  testDb.run('DELETE FROM native_calendar_connections');
  const connection = (owner, calendar) => testDb.run(
    `INSERT INTO native_calendar_connections (user_id, provider, device_calendar_id) VALUES (?, 'apple', ?)`,
    [owner, calendar],
  ).lastInsertId;
  const map = (connectionId, rehearsal, event) => testDb.run(
    `INSERT INTO native_calendar_event_mappings (connection_id, event_type, internal_event_id, external_event_id, last_sync_at)
     VALUES (?, 'rehearsal', ?, ?, '2026-09-20T10:00:00.000Z')`,
    [connectionId, rehearsal, event],
  );
  const a = connection(userId, 'A-cal');
  const b = connection(userId, 'B-cal');
  const stranger = connection(otherId, 'A-cal');
  map(a, '42', 'a-event-42');
  map(a, '43', 'a-event-43');
  map(b, '42', 'b-event-42');
  map(stranger, '42', 'x-event-42');
});

const auth = () => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];
const events = () => testDb.all(
  'SELECT external_event_id FROM native_calendar_event_mappings ORDER BY external_event_id',
).map((row) => row.external_event_id);

describe('Unsyncing one rehearsal on one phone', () => {
  it('removes that phone\'s mapping and leaves the other phone\'s (ES02)', async () => {
    const res = await request(app).delete('/api/native/calendar-sync/mappings/by-event/rehearsal/42').set(...auth())
      .send({ deviceCalendarIds: ['A-cal'] });

    expect(res.status).toBe(200);
    expect(events()).toEqual(['a-event-43', 'b-event-42', 'x-event-42']);
  });

  it('from an app that names no calendars, still removes it everywhere, as it always did', async () => {
    const res = await request(app).delete('/api/native/calendar-sync/mappings/by-event/rehearsal/42').set(...auth());

    expect(res.status).toBe(200);
    expect(events()).toEqual(['a-event-43', 'x-event-42']);
  });
});

describe('Removing everything exported from one phone', () => {
  it('removes that phone\'s mappings only (ES02)', async () => {
    const res = await request(app).delete('/api/native/calendar-sync/mappings').set(...auth())
      .send({ eventType: 'rehearsal', deviceCalendarIds: ['A-cal'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deletedCount: 2 });
    expect(events()).toEqual(['b-event-42', 'x-event-42']);
  });

  it('refuses a request that does not say which calendars are the phone\'s', async () => {
    const res = await request(app).delete('/api/native/calendar-sync/mappings').set(...auth())
      .send({ eventType: 'rehearsal' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEVICE_CALENDARS_INVALID');
    expect(events()).toHaveLength(4);
  });
});

describe('A scope that is not a list of calendars changes nothing', () => {
  it.each([
    ['an empty list', []],
    ['a string', 'A-cal'],
    ['a list with an empty id', ['A-cal', '']],
    ['a list with a number', ['A-cal', 7]],
    ['more calendars than a device has', Array.from({ length: 101 }, (_, i) => `cal-${i}`)],
  ])('refuses %s', async (_label, deviceCalendarIds) => {
    const one = await request(app).delete('/api/native/calendar-sync/mappings/by-event/rehearsal/42').set(...auth())
      .send({ deviceCalendarIds });
    const all = await request(app).delete('/api/native/calendar-sync/mappings').set(...auth())
      .send({ eventType: 'rehearsal', deviceCalendarIds });

    expect([one.status, all.status]).toEqual([400, 400]);
    expect(events()).toHaveLength(4);
  });
});
