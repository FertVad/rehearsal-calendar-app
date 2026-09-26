import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await check()) return; await sleep(10); }
  throw new Error('Synthetic barrier deadline exceeded');
}

// The editor's save on PostgreSQL (R6, cause fix 2: CC05, C02, C03): what the
// SQLite harness cannot show — two saves of one still-empty day by the same
// person at the same moment. Without the per-person lock both deleted nothing
// and both inserted, and the day held both versions. The barrier holds the
// availability table from the control connection until both saves are seen
// waiting, so the two are made to meet rather than hoped to.
export async function probeR6Availability({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];
  let forwardedFor = 10;
  const userId = (await control.query(`INSERT INTO r0_fixture.native_users (email, first_name, timezone)
    VALUES ('days@fixture.invalid', 'Days', 'UTC') RETURNING id`)).rows[0].id;
  const token = generateTokens(userId, 1).accessToken;
  const call = (method, route, body) => new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method,
      headers: { Connection: 'close', 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${forwardedFor++}`,
        Authorization: `Bearer ${token}`, ...(bytes ? { 'Content-Length': bytes.length } : {}) } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (error) { reject(error); }
      });
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('R6 availability request timed out')));
    req.end(bytes);
  });
  const manualOn = async (date) => (await control.query(
    `SELECT starts_at, ends_at, type FROM r0_fixture.native_user_availability
     WHERE user_id = $1 AND source = 'manual' AND DATE(starts_at AT TIME ZONE 'UTC') = $2 ORDER BY starts_at`,
    [userId, date])).rows.map((row) => ({ from: row.starts_at.toISOString(), to: row.ends_at.toISOString(), type: row.type }));
  const busy = (date, from, to) => ({ startsAt: `${date}T${from}:00+00:00`, endsAt: `${date}T${to}:00+00:00`, type: 'busy', isAllDay: false });
  // pg_stat_activity is a snapshot taken once; it is cleared before each look.
  const waitingOnLocks = async () => {
    await control.query('SELECT pg_catalog.pg_stat_clear_snapshot()');
    return Number((await control.query(`SELECT count(*) FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`)).rows[0].count);
  };

  try {
    // The days named, and only they; an imported event on the day stays.
    await control.query(`INSERT INTO r0_fixture.native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
      VALUES ($1, '2030-05-01T06:00:00Z', '2030-05-01T07:00:00Z', 'busy', 'apple_calendar', 'ev-1'),
             ($1, '2030-05-02T06:00:00Z', '2030-05-02T07:00:00Z', 'busy', 'manual', NULL)`, [userId]);
    const saved = await call('PUT', '/api/native/availability/days',
      { days: [{ date: '2030-05-01', entries: [busy('2030-05-01', '10:00', '12:00')] }] });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, { success: true, days: ['2030-05-01'] });
    assert.deepEqual(await manualOn('2030-05-01'),
      [{ from: '2030-05-01T10:00:00.000Z', to: '2030-05-01T12:00:00.000Z', type: 'busy' }]);
    assert.equal((await manualOn('2030-05-02')).length, 1, 'a day not named must be left alone');
    assert.equal(Number((await control.query(`SELECT count(*) FROM r0_fixture.native_user_availability
      WHERE user_id = $1 AND source = 'apple_calendar'`, [userId])).rows[0].count), 1);
    contracts.push('named days replaced on PostgreSQL, others and imported rows left alone');

    // Refused whole: the good day in the same request is not written either.
    const refused = await call('PUT', '/api/native/availability/days', { days: [
      { date: '2030-05-02', entries: [] },
      { date: '2030-05-03', entries: [{ startsAt: '2030-05-03T10:00:00+00:00', type: 'busy' }] },
    ] });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, 'AVAILABILITY_INVALID');
    assert.equal((await manualOn('2030-05-02')).length, 1, 'C02: nothing may be written before the refusal');
    contracts.push('a request with one bad slot refused whole: nothing deleted (C02)');

    // Two saves of one still-empty day, both seen waiting, then let go together.
    await control.query('BEGIN');
    await control.query('LOCK TABLE r0_fixture.native_user_availability IN SHARE MODE');
    const settled = Promise.allSettled([
      call('PUT', '/api/native/availability/days', { days: [{ date: '2030-05-04', entries: [busy('2030-05-04', '10:00', '11:00')] }] }),
      call('PUT', '/api/native/availability/days', { days: [{ date: '2030-05-04', entries: [busy('2030-05-04', '14:00', '15:00')] }] }),
    ]);
    try { await eventually(async () => (await waitingOnLocks()) === 2); }
    catch (error) { await control.query('ROLLBACK'); await settled; throw error; }
    await control.query('COMMIT');
    const outcomes = await settled;
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') throw outcome.reason;
      assert.equal(outcome.value.status, 200);
    }
    const day = await manualOn('2030-05-04');
    assert.equal(day.length, 1, 'C03: two concurrent saves of one day must leave one of them, not both');
    assert.ok(['2030-05-04T10:00:00.000Z', '2030-05-04T14:00:00.000Z'].includes(day[0].from));
    contracts.push('two concurrent saves of one empty day, both seen waiting: the day holds one of them (C03)');

    // Older apps: the bulk save and the day delete take the same lock and work.
    const bulk = await call('POST', '/api/native/availability/bulk',
      { entries: [{ startsAt: '2030-05-05T09:00:00+00:00', endsAt: '2030-05-05T10:00:00+00:00', type: 'busy' }] });
    assert.equal(bulk.status, 200);
    assert.equal((await manualOn('2030-05-05')).length, 1);
    assert.equal((await call('DELETE', '/api/native/availability/2030-05-05')).status, 200);
    assert.deepEqual(await manualOn('2030-05-05'), []);
    contracts.push('the bulk save and the day delete of older apps work behind the same lock');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
