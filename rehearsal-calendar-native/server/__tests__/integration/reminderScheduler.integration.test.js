/**
 * Rehearsal reminders.
 *
 * This logic had never been covered, which is part of why it went unnoticed
 * that it was not running at all. The tests that matter here are about a
 * scheduler that cannot be trusted to be punctual: a late run must still send,
 * a repeated run must not send twice, and a failed send must not leave the
 * rehearsal marked as reminded.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from './setup.js';

let testDb;

const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { run: mockDbRun, get: mockDbGet, all: mockDbAll },
  isPostgres: false,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const notify24h = jest.fn();
const notify1h = jest.fn();

jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
  notifyRehearsal24h: notify24h,
  notifyRehearsal1h: notify1h,
}));

// node-cron would install a real timer at import time.
jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: jest.fn() },
}));

const { checkUpcomingRehearsals } = await import(
  '../../services/notifications/reminderScheduler.js'
);

const HOUR = 60 * 60 * 1000;

describe('Rehearsal reminders', () => {
  let projectId;

  const addRehearsal = (startsInMs, { allDay = false } = {}) => {
    const startsAt = new Date(Date.now() + startsInMs);
    const endsAt = new Date(startsAt.getTime() + 2 * HOUR);
    return Number(
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, is_all_day)
         VALUES (?, ?, ?, ?, ?)`,
        [projectId, 'Прогон', startsAt.toISOString(), endsAt.toISOString(), allDay ? 1 : 0]
      ).lastInsertId
    );
  };

  const remindersFor = (rehearsalId) =>
    testDb.all('SELECT reminder_type FROM native_push_reminders WHERE rehearsal_id = ?', [
      rehearsalId,
    ]).map((r) => r.reminder_type);

  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    mockDbRun.mockImplementation((sql, params) => testDb.run(sql, params));
    mockDbGet.mockImplementation((sql, params) => testDb.get(sql, params));
    mockDbAll.mockImplementation((sql, params) => testDb.all(sql, params));

    const seeded = await seedTestData(testDb);
    projectId = Number(seeded.projectId);
  });

  beforeEach(() => {
    testDb.run('DELETE FROM native_push_reminders', []);
    testDb.run('DELETE FROM native_rehearsals', []);
    notify24h.mockReset();
    notify1h.mockReset();
  });

  afterAll(() => closeIntegrationDb());

  describe('the day-before reminder', () => {
    it('goes out for a rehearsal roughly a day away', async () => {
      const id = addRehearsal(23 * HOUR);

      const result = await checkUpcomingRehearsals();

      expect(notify24h).toHaveBeenCalledTimes(1);
      expect(result.sent['24h']).toBe(1);
      expect(remindersFor(id)).toEqual(['24h']);
    });

    it('still goes out when the run is hours late', async () => {
      // The old window was 23–24h wide, so a run this late found nothing and
      // the rehearsal silently lost its reminder.
      addRehearsal(14 * HOUR);

      await checkUpcomingRehearsals();

      expect(notify24h).toHaveBeenCalledTimes(1);
    });

    it('does not call something starting this afternoon "tomorrow"', async () => {
      addRehearsal(5 * HOUR);

      await checkUpcomingRehearsals();

      expect(notify24h).not.toHaveBeenCalled();
    });

    it('leaves rehearsals further out than a day alone', async () => {
      addRehearsal(30 * HOUR);

      await checkUpcomingRehearsals();

      expect(notify24h).not.toHaveBeenCalled();
    });
  });

  describe('the hour-before reminder', () => {
    it('goes out for a rehearsal within the hour', async () => {
      const id = addRehearsal(40 * 60 * 1000);

      const result = await checkUpcomingRehearsals();

      expect(notify1h).toHaveBeenCalledTimes(1);
      expect(result.sent['1h']).toBe(1);
      expect(remindersFor(id)).toEqual(['1h']);
    });

    it('still goes out when the run is late enough to have missed the old band', async () => {
      // The old band was 50–70 minutes. Ten minutes before the start fell
      // outside it, so nobody was told.
      addRehearsal(10 * 60 * 1000);

      await checkUpcomingRehearsals();

      expect(notify1h).toHaveBeenCalledTimes(1);
    });

    it('does not chase a rehearsal that has already started', async () => {
      addRehearsal(-10 * 60 * 1000);

      await checkUpcomingRehearsals();

      expect(notify1h).not.toHaveBeenCalled();
    });
  });

  it('ignores all-day entries', async () => {
    addRehearsal(20 * HOUR, { allDay: true });

    await checkUpcomingRehearsals();

    expect(notify24h).not.toHaveBeenCalled();
  });

  it('sends nothing twice, however often it runs', async () => {
    const id = addRehearsal(20 * HOUR);

    await checkUpcomingRehearsals();
    await checkUpcomingRehearsals();
    await checkUpcomingRehearsals();

    expect(notify24h).toHaveBeenCalledTimes(1);
    expect(remindersFor(id)).toEqual(['24h']);
  });

  it('sends both kinds as a rehearsal approaches, not one instead of the other', async () => {
    const dayAway = addRehearsal(20 * HOUR);
    const soon = addRehearsal(30 * 60 * 1000);

    const result = await checkUpcomingRehearsals();

    expect(result.sent).toEqual({ '24h': 1, '1h': 1 });
    expect(remindersFor(dayAway)).toEqual(['24h']);
    expect(remindersFor(soon)).toEqual(['1h']);
  });

  it('releases the claim when the push fails, so the next run retries', async () => {
    const id = addRehearsal(20 * HOUR);
    notify24h.mockRejectedValueOnce(new Error('Expo is down'));

    const failed = await checkUpcomingRehearsals();

    expect(failed.sent['24h']).toBe(0);
    expect(remindersFor(id)).toEqual([]);

    const retried = await checkUpcomingRehearsals();

    expect(retried.sent['24h']).toBe(1);
    expect(remindersFor(id)).toEqual(['24h']);
  });

  it('reports what it did, so a scheduler log can tell quiet from broken', async () => {
    addRehearsal(20 * HOUR);

    const result = await checkUpcomingRehearsals();

    expect(result).toEqual({
      found: { '24h': 1, '1h': 0 },
      sent: { '24h': 1, '1h': 0 },
    });
  });
});
