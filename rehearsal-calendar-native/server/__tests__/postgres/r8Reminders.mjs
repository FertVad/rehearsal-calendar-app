import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// Rehearsal reminders on PostgreSQL (R8, cause fix 5: GR01, GR02, GR03, GR05,
// G02): what the SQLite harness cannot show — a failed statement rolling a
// whole reminder back, a move of the rehearsal waiting on the send, two
// schedulers queueing on the same claim, and the cron answering 500 through
// the real app. Expo is a stand-in handed to the scheduler; nothing leaves the
// machine.
export async function probeR8Reminders({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  const { checkUpcomingRehearsals } = await import('../../services/notifications/reminderScheduler.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];
  const HOUR = 3600e3;

  const q = (sql, params) => control.query(sql, params);
  const projectId = (await q(`INSERT INTO r0_fixture.native_projects (name) VALUES ('Reminders') RETURNING id`)).rows[0].id;
  const person = async (label) => {
    const id = (await q(`INSERT INTO r0_fixture.native_users (email, first_name, timezone) VALUES ($1, $2, 'UTC') RETURNING id`,
      [`${label}@fixture.invalid`, label])).rows[0].id;
    await q(`INSERT INTO r0_fixture.native_project_members (project_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')`,
      [projectId, id]);
    await q(`INSERT INTO r0_fixture.native_push_tokens (user_id, device_token, device_type, last_active_at)
      VALUES ($1, $2, 'ios', NOW() - INTERVAL '1 hour')`, [id, `ExponentPushToken[${label}]`]);
    return id;
  };
  const rehearsal = async (startsAt, roster) => {
    const id = (await q(`INSERT INTO r0_fixture.native_rehearsals (project_id, title, starts_at, ends_at, is_all_day)
      VALUES ($1, 'Run', $2, $2::timestamptz + INTERVAL '2 hours', FALSE) RETURNING id`, [projectId, startsAt])).rows[0].id;
    for (const userId of roster) {
      await q(`INSERT INTO r0_fixture.native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, 'no')`, [id, userId]);
    }
    return id;
  };
  const claims = async (rehearsalId) => (await q(
    `SELECT user_id FROM r0_fixture.native_push_reminders WHERE rehearsal_id = $1 ORDER BY user_id`, [rehearsalId]))
    .rows.map((row) => row.user_id);
  const inbox = async (userId) => Number((await q(
    `SELECT count(*) FROM r0_fixture.native_notifications WHERE user_id = $1`, [userId])).rows[0].count);
  const expo = ({ delay = 0 } = {}) => {
    let n = 0;
    return {
      messages: [],
      async sendPushNotificationsAsync(messages) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        this.messages.push(...messages);
        return messages.map(() => ({ status: 'ok', id: `pg-ticket-${Date.now()}-${++n}` }));
      },
      async getPushNotificationReceiptsAsync() { return {}; },
    };
  };
  const waitingOnLocks = async () => {
    await q('SELECT pg_catalog.pg_stat_clear_snapshot()');
    return Number((await q(`SELECT count(*) FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`)).rows[0].count);
  };
  const until = async (condition, what) => {
    for (let i = 0; i < 200; i += 1) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const cron = () => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/cron/reminders',
      method: 'GET', headers: { Connection: 'close', Authorization: `Bearer ${process.env.CRON_SECRET}` } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (error) { reject(error); }
      });
    });
    req.once('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('R8 cron request timed out')));
    req.end();
  });

  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'r8-fixture-secret';
  try {
    const now = new Date();
    const inADay = new Date(now.getTime() + 20 * HOUR).toISOString();
    const ann = await person('ann');
    const ben = await person('ben');

    // GR02: a statement failing after the claims leaves no claim behind.
    const failing = await rehearsal(inADay, [ann]);
    await q(`CREATE FUNCTION r0_fixture.reject_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'R8_INJECTED_INBOX_FAILURE'; END $$;
      CREATE TRIGGER reject_inbox BEFORE INSERT ON r0_fixture.native_notifications
      FOR EACH ROW EXECUTE FUNCTION r0_fixture.reject_inbox()`);
    const stopped = expo();
    const failed = await checkUpcomingRehearsals({ now, expo: stopped });
    await q('DROP TRIGGER reject_inbox ON r0_fixture.native_notifications; DROP FUNCTION r0_fixture.reject_inbox()');
    assert.equal(failed.ok, false);
    assert.deepEqual(await claims(failing), [], 'GR02: a reminder that failed half-way must leave nobody claimed');
    assert.equal(stopped.messages.length, 0);
    const again = expo();
    const retried = await checkUpcomingRehearsals({ now, expo: again });
    assert.equal(retried.ok, true, `the retry must succeed: ${JSON.stringify(retried.errors)}`);
    assert.deepEqual(await claims(failing), [ann]);
    assert.equal(await inbox(ann), 1);
    contracts.push('a reminder whose inbox write fails is rolled back whole, claims included, and the next run sends it (GR02)');

    // GR05: the rehearsal is moved while the run is about to claim it. The
    // run waits on the move, sees the new time, and claims nothing.
    const moving = await rehearsal(inADay, [ben]);
    await q('BEGIN');
    let moved;
    const mover = expo();
    try {
      await q(`UPDATE r0_fixture.native_rehearsals SET starts_at = starts_at + INTERVAL '3 days',
        ends_at = ends_at + INTERVAL '3 days' WHERE id = $1`, [moving]);
      moved = checkUpcomingRehearsals({ now, expo: mover });
      await until(async () => (await waitingOnLocks()) > 0, 'the reminder to wait on the moved rehearsal');
      await q('DELETE FROM r0_fixture.native_push_reminders WHERE rehearsal_id = $1', [moving]);
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK');
      throw error;
    }
    const afterMove = await moved;
    assert.deepEqual(await claims(moving), [], 'GR05: a rehearsal moved during the run must not be claimed at its old time');
    assert.equal(mover.messages.length, 0, 'GR05: nor reminded at it');
    assert.equal(afterMove.ok, true);
    contracts.push('a move committed while the run waits on the rehearsal leaves it unclaimed and unreminded (GR05)');

    // Two schedulers at once, the first slow to hear back from Expo: the
    // second waits on the first one's claim and sends nothing.
    const cara = await person('cara');
    const shared = await rehearsal(inADay, [cara]);
    const first = expo({ delay: 1500 });
    const second = expo();
    const inTransaction = async () => {
      await q('SELECT pg_catalog.pg_stat_clear_snapshot()');
      return Number((await q(`SELECT count(*) FROM pg_catalog.pg_stat_activity
        WHERE datname = current_database() AND state = 'idle in transaction' AND pid <> pg_backend_pid()`)).rows[0].count);
    };
    const firstRun = checkUpcomingRehearsals({ now, expo: first });
    // The first run holds its claim while Expo is slow to answer.
    await until(async () => (await inTransaction()) > 0, 'the first run to hold its claim');
    const secondRun = checkUpcomingRehearsals({ now, expo: second });
    // The second queues on that claim rather than send.
    await until(async () => (await waitingOnLocks()) > 0, 'the second run to wait on the first one\'s claim');
    assert.equal(first.messages.length, 0, 'the second run must be seen waiting while the first is still sending');
    const [one, two] = await Promise.all([firstRun, secondRun]);
    const toCara = [...first.messages, ...second.messages].filter((message) => message.to === 'ExponentPushToken[cara]');
    assert.equal(toCara.length, 1, 'two overlapping runs must remind a person once');
    assert.deepEqual(await claims(shared), [cara]);
    assert.equal(await inbox(cara), 1);
    assert.equal(one.ok && two.ok, true);
    contracts.push('two overlapping runs remind each person once');

    // GR03 through the real app: a run that cannot read what is due answers
    // 500; a working one 200. Nothing is due for these calls.
    await q('ALTER TABLE r0_fixture.native_push_reminders RENAME TO native_push_reminders_away');
    let broken;
    try { broken = await cron(); }
    finally { await q('ALTER TABLE r0_fixture.native_push_reminders_away RENAME TO native_push_reminders'); }
    assert.equal(broken.status, 500, `GR03: a broken run must not answer 200: ${JSON.stringify(broken.body)}`);
    assert.equal(broken.body.success, false);
    contracts.push('the cron answers 500 when the due rehearsals cannot be read (GR03)');

    // G02: a receipt saying the device is gone removes a token not registered
    // again since — compared as instants on the real engine.
    const dana = await person('dana');
    const eve = await person('eve');
    await q(`INSERT INTO r0_fixture.native_push_tickets (ticket_id, user_id, device_token, created_at) VALUES
      ('gone-1', $1, 'ExponentPushToken[dana]', NOW() - INTERVAL '20 minutes'),
      ('gone-2', $2, 'ExponentPushToken[eve]', NOW() - INTERVAL '20 minutes')`, [dana, eve]);
    await q(`UPDATE r0_fixture.native_push_tokens SET last_active_at = NOW() - INTERVAL '5 minutes' WHERE user_id = $1`, [eve]);
    const receipts = {
      async sendPushNotificationsAsync() { throw new Error('nothing is due'); },
      async getPushNotificationReceiptsAsync(ids) {
        return Object.fromEntries(ids.map((id) => [id, { status: 'error', details: { error: 'DeviceNotRegistered' } }]));
      },
    };
    const read = await checkUpcomingRehearsals({ now: new Date(), expo: receipts });
    assert.equal(read.receipts.tokensRemoved, 1);
    const tokens = (await q(`SELECT user_id FROM r0_fixture.native_push_tokens WHERE user_id IN ($1, $2) ORDER BY user_id`, [dana, eve]))
      .rows.map((row) => row.user_id);
    assert.deepEqual(tokens, [eve], 'G02: only the token not registered again since the send goes');
    assert.equal(Number((await q(`SELECT count(*) FROM r0_fixture.native_push_tickets WHERE ticket_id LIKE 'gone-%'`)).rows[0].count), 0);
    contracts.push('a DeviceNotRegistered receipt removes the token unless it was registered again after the send (G02)');
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousSecret;
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
