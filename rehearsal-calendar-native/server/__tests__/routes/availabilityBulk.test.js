/**
 * POST /api/native/availability/bulk replaces a day — but only for the editor.
 *
 * The endpoint deletes the hand-entered rows on every date it is given before
 * inserting the new ones, which is right for the availability screen: saving a
 * day means that day now reads exactly as shown. The calendar importer posts
 * through the same door, and its entries carry dates too. So a dentist
 * appointment appearing in someone's phone calendar on 15 September deleted
 * everything they had marked by hand on 15 September — not just the overlapping
 * part, the whole day — and put back only the imported event. Silently, with no
 * undo and nothing kept on the server to restore from. Worst on the first sync
 * after Auto Sync is switched on, which posts up to a year of events at once.
 *
 * These go over HTTP through the real router. The older availability tests
 * drive SQL directly, which is why nothing caught this: the defect is in what
 * the handler decides, not in what the SQL does.
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
  testDb.run(`UPDATE native_users SET timezone = 'Europe/Berlin' WHERE id = ?`, [userId]);
});

const auth = () => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const post = (entries) =>
  request(app).post('/api/native/availability/bulk').set(...auth()).send({ entries });

const rows = () =>
  testDb.all(
    `SELECT starts_at, ends_at, type, source FROM native_user_availability
     WHERE user_id = ? ORDER BY starts_at, source`,
    [userId]
  );

/** What the availability screen sends: no source field at all. */
const manual = (startsAt, endsAt, type = 'busy') => ({ startsAt, endsAt, type });

/** What the calendar importer sends. */
const imported = (startsAt, endsAt, externalId) => ({
  startsAt,
  endsAt,
  type: 'busy',
  source: 'apple_calendar',
  external_event_id: externalId,
});

describe('The editor replacing a day', () => {
  it('keeps what it saves', async () => {
    const res = await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);

    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(1);
  });

  it('replaces the day rather than adding to it', async () => {
    // The behaviour the delete exists for: saving 15 September means the day
    // now reads exactly as shown, not as shown plus whatever was there before.
    await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);
    await post([manual('2026-09-15T14:00:00+02:00', '2026-09-15T16:00:00+02:00')]);

    const after = rows();
    expect(after).toHaveLength(1);
    expect(after[0].starts_at).toContain('14:00');
  });

  it('leaves the days it was not given alone', async () => {
    await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);
    await post([manual('2026-09-16T09:00:00+02:00', '2026-09-16T12:00:00+02:00')]);

    expect(rows()).toHaveLength(2);
  });
});

describe('An import arriving at the same door', () => {
  it('does not touch availability entered by hand on that date', async () => {
    // The defect. Any new imported event anywhere on the day deleted every
    // hand-entered row for that day.
    await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);

    await post([imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1')]);

    const after = rows();
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.source).sort()).toEqual(['apple_calendar', 'manual']);
  });

  it('does not wipe a whole year of it on the first sync', async () => {
    // Switching Auto Sync on posts every event from today to a year out in one
    // request. Each date in that payload used to clear the day.
    await post([
      manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00'),
      manual('2026-10-20T09:00:00+02:00', '2026-10-20T12:00:00+02:00'),
      manual('2026-11-05T09:00:00+02:00', '2026-11-05T12:00:00+02:00'),
    ]);

    await post([
      imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1'),
      imported('2026-10-20T14:00:00.000Z', '2026-10-20T15:00:00.000Z', 'evt-2'),
      imported('2026-11-05T14:00:00.000Z', '2026-11-05T15:00:00.000Z', 'evt-3'),
    ]);

    expect(rows().filter((r) => r.source === 'manual')).toHaveLength(3);
  });

  it('still refuses to import the same event twice', async () => {
    await post([imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1')]);
    await post([imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1')]);

    expect(rows()).toHaveLength(1);
  });

  it('refuses it twice in one payload too', async () => {
    const twice = imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1');

    await post([twice, twice]);

    expect(rows()).toHaveLength(1);
  });

  it('refuses it when two syncs overlap', async () => {
    // How it actually happened: a pull-to-refresh landed on a sync already in
    // flight. Both requests asked whether the event was stored, both were told
    // no, and both inserted it. A look-before-you-leap check cannot decide
    // this — only the unique index from migration 005 can.
    const event = () => imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1');

    await Promise.all([post([event()]), post([event()])]);

    expect(rows()).toHaveLength(1);
  });

  it('leaves the same event on another calendar alone', async () => {
    // Distinct sources are distinct rows: an event imported from Apple and the
    // same id arriving from Google are two events as far as this is concerned.
    await post([imported('2026-09-15T14:00:00.000Z', '2026-09-15T15:00:00.000Z', 'evt-1')]);

    await post([
      {
        startsAt: '2026-09-15T14:00:00.000Z',
        endsAt: '2026-09-15T15:00:00.000Z',
        type: 'busy',
        source: 'google_calendar',
        external_event_id: 'evt-1',
      },
    ]);

    expect(rows()).toHaveLength(2);
  });

  it('leaves a mixed payload behaving as each half should', async () => {
    // The editor's own entries still replace their day; the imported ones still
    // do not.
    await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);
    await post([imported('2026-09-15T20:00:00.000Z', '2026-09-15T21:00:00.000Z', 'evt-1')]);

    await post([
      manual('2026-09-15T17:00:00+02:00', '2026-09-15T18:00:00+02:00'),
      imported('2026-09-15T22:00:00.000Z', '2026-09-15T23:00:00.000Z', 'evt-2'),
    ]);

    const after = rows();
    expect(after.filter((r) => r.source === 'manual')).toHaveLength(1);
    expect(after.filter((r) => r.source === 'apple_calendar')).toHaveLength(2);
  });
});

describe('When it goes wrong', () => {
  it('does not hand the database driver back to the client', async () => {
    // message, code, hint and where used to be in the response, which gives out
    // column and constraint names to anyone who can provoke an error.
    const res = await post([{ startsAt: 'not a date', endsAt: 'also not', type: 'busy' }]);

    if (res.status === 500) {
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(res.body.error).toBe('Failed to save availability');
    }
  });

  it('rejects an empty request rather than deleting everything', async () => {
    await post([manual('2026-09-15T09:00:00+02:00', '2026-09-15T12:00:00+02:00')]);

    const res = await post([]);

    expect(res.status).toBe(400);
    expect(rows()).toHaveLength(1);
  });
});
