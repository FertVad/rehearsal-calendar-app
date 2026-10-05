/**
 * Rehearsal reminders.
 *
 * The tests that matter here are about a scheduler that cannot be trusted to
 * be punctual, and a delivery that cannot be trusted to succeed: a late run
 * must still send, a repeated run must not send twice, and a send that failed
 * — or a run that stopped half-way — must not leave anyone marked as told.
 *
 * Everything below the Expo client is real: the scheduler, the push service,
 * the inbox and the database. The previous version replaced the whole push
 * service with a function that could be made to throw, which the real one
 * never did — it swallowed the failure and resolved — so the retry it proved
 * did not exist (R8: GR01).
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

const { checkUpcomingRehearsals, remindRehearsal } = await import(
  '../../services/notifications/reminderScheduler.js'
);
const { notifyRehearsal24h } = await import('../../services/notifications/pushNotificationService.js');

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const tokenOf = (userId) => `ExponentPushToken[user-${userId}]`;

/**
 * Stands in for Expo. Every message is accepted unless `refuse` names its
 * token; `down` makes the whole request fail. Receipts are whatever the test
 * puts in `receipts`.
 */
function fakeExpo() {
  let tickets = 0;
  return {
    messages: [],
    refuse: new Map(),
    down: false,
    receipts: {},
    receiptsDown: false,
    async sendPushNotificationsAsync(messages) {
      if (this.down) throw new Error('Expo is down');
      this.messages.push(...messages);
      return messages.map((message) => (this.refuse.has(message.to)
        ? { status: 'error', message: 'refused', details: { error: this.refuse.get(message.to) } }
        : { status: 'ok', id: `ticket-${++tickets}` }));
    },
    async getPushNotificationReceiptsAsync(ids) {
      if (this.receiptsDown) throw new Error('Expo receipts are down');
      return Object.fromEntries(ids.filter((id) => this.receipts[id]).map((id) => [id, this.receipts[id]]));
    },
  };
}

describe('Rehearsal reminders', () => {
  let projectId;
  let memberId;
  let bystanderId;
  let expo;

  /** Adds a rehearsal and puts `roster` on it — an empty roster means nobody. */
  const addRehearsal = (startsInMs, { allDay = false, roster = null } = {}) => {
    const startsAt = new Date(Date.now() + startsInMs);
    const endsAt = new Date(startsAt.getTime() + 2 * HOUR);
    const id = Number(
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, is_all_day)
         VALUES (?, ?, ?, ?, ?)`,
        [projectId, 'Прогон', startsAt.toISOString(), endsAt.toISOString(), allDay ? 1 : 0]
      ).lastInsertId
    );
    for (const userId of roster ?? [memberId]) {
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
        [id, userId]
      );
    }
    return id;
  };

  const addUser = (label, { device = true } = {}) => {
    const id = Number(testDb.run(
      `INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`,
      [`${label}-${Date.now()}-${Math.random()}@test.com`, 'hash', label]
    ).lastInsertId);
    testDb.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'member', 'active')`,
      [projectId, id]
    );
    if (device) addDevice(id);
    return id;
  };

  const addDevice = (userId, lastActiveAt = new Date(Date.now() - HOUR).toISOString()) => testDb.run(
    `INSERT INTO native_push_tokens (user_id, device_token, device_type, last_active_at) VALUES (?, ?, 'ios', ?)`,
    [userId, tokenOf(userId), lastActiveAt]
  );

  const run = (options = {}) => checkUpcomingRehearsals({ expo, ...options });
  const remindersFor = (rehearsalId) =>
    testDb.all('SELECT reminder_type FROM native_push_reminders WHERE rehearsal_id = ?', [rehearsalId])
      .map((r) => r.reminder_type);
  const claimedFor = (rehearsalId, type = '24h') =>
    testDb.all('SELECT user_id FROM native_push_reminders WHERE rehearsal_id = ? AND reminder_type = ? ORDER BY user_id',
      [rehearsalId, type]).map((r) => Number(r.user_id));
  /** Who got a push of this kind, by the token it went to. */
  const pushedTo = (type) => expo.messages.filter((m) => m.data.type === `rehearsal_reminder_${type}`)
    .map((m) => Number(/user-(\d+)/.exec(m.to)[1]));
  const inboxOf = (userId) => testDb.all(
    `SELECT id FROM native_notifications WHERE user_id = ? AND type LIKE 'rehearsal_reminder_%'`, [userId]
  );

  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    const seeded = await seedTestData(testDb);
    projectId = Number(seeded.projectId);
    memberId = Number(seeded.memberId);
    addDevice(memberId);

    // In the project, never on a rehearsal. Reminding this person would push
    // them about something their calendar does not show.
    bystanderId = addUser('By');
  });

  beforeEach(() => {
    testDb.run('DELETE FROM native_push_reminders', []);
    testDb.run('DELETE FROM native_notifications', []);
    testDb.run('DELETE FROM native_push_tickets', []);
    testDb.run('DELETE FROM native_rehearsal_responses', []);
    testDb.run('DELETE FROM native_rehearsals', []);
    expo = fakeExpo();
  });

  afterAll(() => closeIntegrationDb());

  describe('the day-before reminder', () => {
    it('goes out for a rehearsal roughly a day away', async () => {
      const id = addRehearsal(23 * HOUR);

      const result = await run();

      expect(pushedTo('24h')).toEqual([memberId]);
      expect(result.sent['24h']).toBe(1);
      expect(remindersFor(id)).toEqual(['24h']);
    });

    it('still goes out when the run is hours late', async () => {
      // The old window was 23–24h wide, so a run this late found nothing and
      // the rehearsal silently lost its reminder.
      addRehearsal(14 * HOUR);

      await run();

      expect(pushedTo('24h')).toEqual([memberId]);
    });

    it('does not call something starting this afternoon "tomorrow"', async () => {
      addRehearsal(5 * HOUR);

      await run();

      expect(pushedTo('24h')).toEqual([]);
    });

    it('leaves rehearsals further out than a day alone', async () => {
      addRehearsal(30 * HOUR);

      await run();

      expect(pushedTo('24h')).toEqual([]);
    });
  });

  describe('the hour-before reminder', () => {
    it('goes out for a rehearsal within the hour', async () => {
      const id = addRehearsal(40 * MINUTE);

      const result = await run();

      expect(pushedTo('1h')).toEqual([memberId]);
      expect(result.sent['1h']).toBe(1);
      expect(remindersFor(id)).toEqual(['1h']);
    });

    it('still goes out when the run is late enough to have missed the old band', async () => {
      // The old band was 50–70 minutes. Ten minutes before the start fell
      // outside it, so nobody was told.
      addRehearsal(10 * MINUTE);

      await run();

      expect(pushedTo('1h')).toEqual([memberId]);
    });

    it('does not chase a rehearsal that has already started', async () => {
      addRehearsal(-10 * MINUTE);

      await run();

      expect(pushedTo('1h')).toEqual([]);
    });
  });

  it('ignores all-day entries', async () => {
    addRehearsal(20 * HOUR, { allDay: true });

    await run();

    expect(expo.messages).toEqual([]);
  });

  it('sends nothing twice, however often it runs', async () => {
    const id = addRehearsal(20 * HOUR);

    await run();
    await run();
    await run();

    expect(pushedTo('24h')).toEqual([memberId]);
    expect(remindersFor(id)).toEqual(['24h']);
    expect(inboxOf(memberId)).toHaveLength(1);
  });

  it('sends both kinds as a rehearsal approaches, not one instead of the other', async () => {
    const dayAway = addRehearsal(20 * HOUR);
    const soon = addRehearsal(30 * MINUTE);

    const result = await run();

    expect(result.sent).toEqual({ '24h': 1, '1h': 1 });
    expect(remindersFor(dayAway)).toEqual(['24h']);
    expect(remindersFor(soon)).toEqual(['1h']);
  });

  describe('who gets told', () => {
    it('tells the people on the rehearsal, and not project members who are not on it', async () => {
      addRehearsal(20 * HOUR, { roster: [memberId] });

      await run();

      expect(pushedTo('24h')).toEqual([memberId]);
      expect(inboxOf(bystanderId)).toEqual([]);
    });

    // A row left behind by someone no longer in the project is not being on the
    // rehearsal (roster.js); it used to keep the reminders coming.
    it('leaves out someone who has left the project, whatever row they left behind', async () => {
      const leftId = addUser('Left');
      testDb.run(`UPDATE native_project_members SET status = 'left' WHERE user_id = ?`, [leftId]);
      addRehearsal(20 * HOUR, { roster: [memberId, leftId] });

      await run();

      expect(pushedTo('24h')).toEqual([memberId]);
    });

    it('does not count a rehearsal whose only row is someone who has left', async () => {
      const goneId = addUser('Gone');
      testDb.run(`UPDATE native_project_members SET status = 'left' WHERE user_id = ?`, [goneId]);
      addRehearsal(20 * HOUR, { roster: [goneId] });

      const result = await run();

      expect(expo.messages).toEqual([]);
      expect(result.found['24h']).toBe(0);
    });

    it('sends nothing for a rehearsal with nobody on it', async () => {
      addRehearsal(20 * HOUR, { roster: [] });

      const result = await run();

      expect(expo.messages).toEqual([]);
      expect(result.sent['24h']).toBe(0);
    });

    it('counts someone with no device as told: their inbox row is the delivery', async () => {
      const offline = addUser('Offline', { device: false });
      const id = addRehearsal(20 * HOUR, { roster: [offline] });

      const result = await run();

      expect(result.ok).toBe(true);
      expect(claimedFor(id)).toEqual([offline]);
      expect(inboxOf(offline)).toHaveLength(1);
    });
  });

  it('reports what it did, so a scheduler log can tell quiet from broken', async () => {
    addRehearsal(20 * HOUR);

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      found: { '24h': 1, '1h': 0 },
      sent: { '24h': 1, '1h': 0 },
      told: { '24h': 1, '1h': 0 },
      retry: { '24h': 0, '1h': 0 },
      errors: [],
    });
  });

  describe('somebody added after the reminder has gone out', () => {
    it('is reminded on the next run, and nobody else is again', async () => {
      // The claim used to retire the whole rehearsal on the first send, so a
      // person added afterwards was never reminded at all.
      const id = addRehearsal(20 * HOUR);
      await run();
      expo.messages.length = 0;

      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
        [id, bystanderId]
      );

      await run();

      expect(pushedTo('24h')).toEqual([bystanderId]);
      expect(claimedFor(id).sort()).toEqual([memberId, bystanderId].sort());
    });
  });

  describe('a push that did not go out (GR01)', () => {
    it('Expo down: the claim and the inbox row are released, the run fails, and the next run sends once', async () => {
      const id = addRehearsal(20 * HOUR);
      expo.down = true;

      const failed = await run();

      expect(failed.ok).toBe(false);
      expect(failed.retry['24h']).toBe(1);
      expect(claimedFor(id)).toEqual([]);
      expect(inboxOf(memberId)).toEqual([]);

      expo.down = false;
      const retried = await run();

      expect(retried.ok).toBe(true);
      expect(claimedFor(id)).toEqual([memberId]);
      expect(inboxOf(memberId)).toHaveLength(1);
    });

    it('a device that refuses: only that person is released, whoever was told keeps the claim', async () => {
      const refusing = addUser('Refusing');
      const id = addRehearsal(20 * HOUR, { roster: [memberId, refusing] });
      expo.refuse.set(tokenOf(refusing), 'MessageRateExceeded');

      const result = await run();

      expect(result.ok).toBe(false);
      expect(result.told['24h']).toBe(1);
      expect(claimedFor(id)).toEqual([memberId]);
      expect(inboxOf(refusing)).toEqual([]);
      expect(inboxOf(memberId)).toHaveLength(1);
    });

    it('the service says who it failed, rather than resolving with nothing', async () => {
      expo.down = true;

      const delivery = await notifyRehearsal24h({ id: 1, title: 'Прогон', project_id: projectId }, 'P', [memberId], { expo });

      expect(delivery.undelivered).toEqual([memberId]);
      expect(delivery.delivered).toEqual([]);
    });
  });

  describe('a run that stops between the claim and the push (GR02)', () => {
    it('leaves nobody claimed, and the next run tells them', async () => {
      const id = addRehearsal(20 * HOUR);
      testDb.run(`CREATE TRIGGER inbox_down BEFORE INSERT ON native_notifications
        BEGIN SELECT RAISE(ABORT, 'inbox is down'); END`);

      let failed;
      try {
        failed = await run();
      } finally {
        testDb.run('DROP TRIGGER inbox_down');
      }

      expect(failed.ok).toBe(false);
      expect(expo.messages).toEqual([]);
      expect(claimedFor(id)).toEqual([]);

      await run();

      expect(pushedTo('24h')).toEqual([memberId]);
      expect(claimedFor(id)).toEqual([memberId]);
    });
  });

  describe('a rehearsal moved after the run read it (GR05)', () => {
    it('is not claimed or reminded at the time it no longer has', async () => {
      const id = addRehearsal(20 * HOUR);
      const snapshot = testDb.get(
        `SELECT r.*, p.name AS project_name FROM native_rehearsals r JOIN native_projects p ON p.id = r.project_id WHERE r.id = ?`,
        [id]
      );
      const later = new Date(Date.now() + 72 * HOUR);
      testDb.run('UPDATE native_rehearsals SET starts_at = ?, ends_at = ? WHERE id = ?',
        [later.toISOString(), new Date(later.getTime() + 2 * HOUR).toISOString(), id]);

      const outcome = await testDb.transaction((tx) => remindRehearsal(tx, {
        rehearsal: snapshot, type: '24h', notify: notifyRehearsal24h, now: new Date(), expo,
      }));

      expect(outcome).toMatchObject({ told: 0, moved: true });
      expect(claimedFor(id)).toEqual([]);
      expect(expo.messages).toEqual([]);
    });
  });

  describe('receipts (G02)', () => {
    const tickets = () => testDb.all('SELECT ticket_id FROM native_push_tickets ORDER BY ticket_id').map((r) => r.ticket_id);
    const hasToken = (userId) => testDb.get('SELECT 1 AS yes FROM native_push_tokens WHERE user_id = ?', [userId]) != null;
    const later = (ms) => new Date(Date.now() + ms);

    it('every accepted push leaves its ticket to be checked', async () => {
      addRehearsal(20 * HOUR);

      await run();

      expect(tickets()).toEqual(['ticket-1']);
    });

    it('a receipt saying the device is gone removes the token and the ticket', async () => {
      const leaving = addUser('Leaving');
      addRehearsal(20 * HOUR, { roster: [leaving] });
      await run();
      expo.receipts['ticket-1'] = { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } };

      const result = await run({ now: later(16 * MINUTE) });

      expect(result.receipts).toMatchObject({ checked: 1, failed: 1, tokensRemoved: 1 });
      expect(hasToken(leaving)).toBe(false);
      expect(tickets()).toEqual([]);
    });

    it('keeps a token registered again since the send', async () => {
      const back = addUser('Back');
      addRehearsal(20 * HOUR, { roster: [back] });
      await run();
      testDb.run('UPDATE native_push_tokens SET last_active_at = ? WHERE user_id = ?', [later(MINUTE).toISOString(), back]);
      expo.receipts['ticket-1'] = { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } };

      await run({ now: later(16 * MINUTE) });

      expect(hasToken(back)).toBe(true);
      expect(tickets()).toEqual([]);
    });

    it('waits for a receipt not ready yet, and not before fifteen minutes', async () => {
      addRehearsal(20 * HOUR);
      await run();

      const early = await run({ now: later(5 * MINUTE) });
      const notReady = await run({ now: later(16 * MINUTE) });

      expect(early.receipts.checked).toBe(0);
      expect(notReady.receipts).toMatchObject({ checked: 1, waiting: 1 });
      expect(tickets()).toEqual(['ticket-1']);
    });

    it('retires an ok receipt, and a ticket whose receipt Expo no longer keeps', async () => {
      addRehearsal(20 * HOUR);
      addRehearsal(30 * MINUTE);
      await run();
      expo.receipts['ticket-1'] = { status: 'ok' };

      const result = await run({ now: later(25 * HOUR) });

      expect(result.receipts).toMatchObject({ checked: 2, ok: 1, expired: 1 });
      expect(tickets()).toEqual([]);
    });

    it('Expo not answering for receipts fails the run and keeps the tickets', async () => {
      addRehearsal(20 * HOUR);
      await run();
      expo.receiptsDown = true;

      const result = await run({ now: later(16 * MINUTE) });

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual([expect.objectContaining({ step: 'receipts' })]);
      expect(tickets()).toEqual(['ticket-1']);
    });
  });

  it('a run that cannot read what is due fails, instead of reporting a quiet night (GR03)', async () => {
    addRehearsal(20 * HOUR);
    testDb.run('ALTER TABLE native_push_reminders RENAME TO native_push_reminders_away');

    let result;
    try {
      result = await run();
    } finally {
      testDb.run('ALTER TABLE native_push_reminders_away RENAME TO native_push_reminders');
    }

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.step)).toEqual(['24h', '1h']);
    expect(expo.messages).toEqual([]);
  });
});
