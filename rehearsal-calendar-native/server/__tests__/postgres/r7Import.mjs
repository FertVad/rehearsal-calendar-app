import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// Calendar import reconciled on the server (R7, cause fix 4: EI01, EI03, EI04),
// on PostgreSQL through the real app: what the SQLite harness cannot show — a
// failure half-way through a sync rolling the whole sync back, and a year of a
// device's calendars arriving in one request past the default body limit.
export async function probeR7Import({ connectionString, control, allowedPorts }) {
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
    VALUES ('import@fixture.invalid', 'Import', 'UTC') RETURNING id`)).rows[0].id;
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
    req.setTimeout(20000, () => req.destroy(new Error('R7 import request timed out')));
    req.end(bytes);
  });
  const keys = async () => (await control.query(
    'SELECT external_event_id FROM r0_fixture.native_user_availability WHERE user_id = $1 ORDER BY external_event_id',
    [userId])).rows.map((row) => row.external_event_id);
  const event = (key, day, hour = 10) => ({ key, isAllDay: false,
    startsAt: `2030-10-${day}T${String(hour).padStart(2, '0')}:00:00Z`,
    endsAt: `2030-10-${day}T${String(hour + 1).padStart(2, '0')}:00:00Z` });
  const sync = (body) => call('POST', '/api/native/availability/imported/sync', { source: 'apple_calendar',
    window: { from: '2030-10-01T00:00:00Z', to: '2031-10-01T00:00:00Z', firstDate: '2030-10-01', lastDate: '2031-09-30' },
    unreadable: [], ...body });

  try {
    assert.equal((await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1', '02')] }] })).status, 200);
    assert.equal((await sync({ deviceCalendars: ['B-work'], calendars: [{ calendarId: 'B-work', events: [event('e9', '03')] }] })).status, 200);
    assert.deepEqual(await keys(), ['cal:A-work|e1', 'cal:B-work|e9'], 'EI01: the second phone must not delete the first one\'s imports');
    contracts.push('two devices of one person: each sync touches only its own calendars (EI01)');

    // Moving an occurrence is a delete and an insert. Make the insert fail: the
    // delete must not stand without it (EI04).
    await control.query(`CREATE FUNCTION r0_fixture.reject_moved() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.external_event_id = 'cal:A-work|e1:moved' THEN RAISE EXCEPTION 'R7_INJECTED_INSERT_FAILURE'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER reject_moved BEFORE INSERT ON r0_fixture.native_user_availability
      FOR EACH ROW EXECUTE FUNCTION r0_fixture.reject_moved()`);
    const failed = await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1:moved', '02', 15)] }] });
    assert.equal(failed.status, 500);
    assert.deepEqual(await keys(), ['cal:A-work|e1', 'cal:B-work|e9'], 'EI04: a failed insert must leave the old time in place');
    await control.query('DROP TRIGGER reject_moved ON r0_fixture.native_user_availability; DROP FUNCTION r0_fixture.reject_moved()');
    const moved = await sync({ deviceCalendars: ['A-work'], calendars: [{ calendarId: 'A-work', events: [event('e1:moved', '02', 15)] }] });
    assert.equal(moved.status, 200);
    assert.deepEqual(await keys(), ['cal:A-work|e1:moved', 'cal:B-work|e9']);
    contracts.push('a sync whose insert fails rolls back its delete; retried, the occurrence moves (EI04)');

    // A year of a busy calendar in one request, past the default 100kb body.
    const many = Array.from({ length: 3000 }, (_, i) => ({ key: `bulk-${i}`, isAllDay: false,
      startsAt: new Date(Date.UTC(2030, 9, 2, 0, 0) + i * 3600e3).toISOString(),
      endsAt: new Date(Date.UTC(2030, 9, 2, 0, 30) + i * 3600e3).toISOString() }));
    const big = await sync({ deviceCalendars: ['A-work', 'A-big'], calendars: [
      { calendarId: 'A-work', events: [event('e1:moved', '02', 15)] }, { calendarId: 'A-big', events: many }] });
    assert.equal(big.status, 200, `a year of events must fit one sync: ${JSON.stringify(big.body)}`);
    assert.equal(big.body.added, 3000);
    contracts.push('3000 events of one device reconciled in a single request through the real app');

    // An older app diffs against every imported row and deletes by key through
    // the old batch endpoint: another device's scoped rows are out of its reach.
    await control.query(`INSERT INTO r0_fixture.native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
      VALUES ($1, '2030-10-05T10:00:00Z', '2030-10-05T11:00:00Z', 'busy', 'apple_calendar', 'L1'),
             ($1, '2030-10-06T10:00:00Z', '2030-10-06T11:00:00Z', 'busy', 'apple_calendar', 'L2')`, [userId]);
    const old = await call('DELETE', '/api/native/availability/imported/batch', { eventIds: ['cal:B-work|e9', 'L2'] });
    assert.equal(old.status, 200);
    assert.ok((await keys()).includes('cal:B-work|e9'), 'an older app must not delete a scoped row');
    assert.ok(!(await keys()).includes('L2'));
    contracts.push('the old batch delete reaches only rows from before the scope');

    // A plain row is taken into the calendar that still has it, not duplicated.
    const adopted = await sync({ deviceCalendars: ['B-work'], calendars: [{ calendarId: 'B-work', events: [event('e9', '03'), event('L1', '05')] }] });
    assert.equal(adopted.status, 200);
    assert.equal(adopted.body.adopted, 1);
    const after = await keys();
    assert.ok(after.includes('cal:B-work|L1') && !after.includes('L1'));
    contracts.push('a row from before the scope is adopted by the calendar that still has it');

    // A whole day is a date, compared with the dates the device read, never
    // with the window's instants (R7-02). Ahead of UTC the window starts the
    // evening before in UTC; behind it, it ends the morning after.
    await control.query(`INSERT INTO r0_fixture.native_user_availability
      (user_id, starts_at, ends_at, type, source, external_event_id, is_all_day) VALUES
      ($1, '2030-10-01T00:00:00Z', '2030-10-01T23:59:59.999Z', 'busy', 'apple_calendar', 'cal:date-zone|oct-1', TRUE),
      ($1, '2030-10-02T00:00:00Z', '2030-10-02T23:59:59.999Z', 'busy', 'apple_calendar', 'cal:date-zone|oct-2', TRUE),
      ($1, '2031-10-02T00:00:00Z', '2031-10-02T23:59:59.999Z', 'busy', 'apple_calendar', 'cal:date-zone|after', TRUE)`, [userId]);
    const zoned = (window) => call('POST', '/api/native/availability/imported/sync', { source: 'apple_calendar', window,
      deviceCalendars: ['date-zone'], unreadable: [], calendars: [{ calendarId: 'date-zone', events: [] }] });
    const dated = async () => (await keys()).filter((key) => key.startsWith('cal:date-zone|'));
    const ahead = await zoned({ from: '2030-10-02T00:00:00+03:00', to: '2031-10-02T00:00:00+03:00',
      firstDate: '2030-10-02', lastDate: '2031-10-01' });
    assert.equal(ahead.status, 200);
    assert.deepEqual(await dated(), ['cal:date-zone|after', 'cal:date-zone|oct-1'],
      'R7-02: ahead of UTC, 1 October must stay and 2 October go');
    const behind = await zoned({ from: '2030-10-01T00:00:00-05:00', to: '2031-10-02T00:00:00-05:00',
      firstDate: '2030-10-01', lastDate: '2031-10-01' });
    assert.equal(behind.status, 200);
    assert.deepEqual(await dated(), ['cal:date-zone|after'],
      'R7-02: behind UTC, the day after the window must stay and 1 October go');
    contracts.push('whole days are matched to the window by their dates, on both sides of UTC (R7-02)');

    // Export mappings: one per connection, a connection per device calendar.
    // A delete names the device's calendars and reaches no further (ES02).
    const connections = (await control.query(`INSERT INTO r0_fixture.native_calendar_connections (user_id, provider, device_calendar_id)
      VALUES ($1, 'apple', 'A-cal'), ($1, 'apple', 'B-cal') RETURNING id`, [userId])).rows.map((row) => row.id);
    await control.query(`INSERT INTO r0_fixture.native_calendar_event_mappings
      (connection_id, event_type, internal_event_id, external_event_id, last_sync_at)
      VALUES ($1, 'rehearsal', 42, 'a-42', NOW()), ($1, 'rehearsal', 43, 'a-43', NOW()), ($2, 'rehearsal', 42, 'b-42', NOW())`,
    connections);
    const mappings = async () => (await control.query(`SELECT m.external_event_id FROM r0_fixture.native_calendar_event_mappings m
      JOIN r0_fixture.native_calendar_connections c ON c.id = m.connection_id WHERE c.user_id = $1 ORDER BY 1`, [userId]))
      .rows.map((row) => row.external_event_id);
    const unsync = await call('DELETE', '/api/native/calendar-sync/mappings/by-event/rehearsal/42', { deviceCalendarIds: ['A-cal'] });
    assert.equal(unsync.status, 200);
    assert.deepEqual(await mappings(), ['a-43', 'b-42'], 'ES02: unsyncing on phone A must leave phone B\'s mapping');
    const clear = await call('DELETE', '/api/native/calendar-sync/mappings', { eventType: 'rehearsal', deviceCalendarIds: ['A-cal'] });
    assert.equal(clear.status, 200);
    assert.deepEqual(await mappings(), ['b-42'], 'ES02: removing all exported on phone A must leave phone B\'s mappings');
    contracts.push('export mapping deletes reach only the calendars the device names (ES02)');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
