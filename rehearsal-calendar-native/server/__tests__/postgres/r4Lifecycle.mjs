import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// Lifecycle operations on PostgreSQL (R4, cause fix 10: B01, B02, D03): each
// commits whole or not at all through the real adapter and the real app. The
// last write of each operation is made to fail with a trigger, so everything
// before it has already run on the same connection; an independent connection
// then checks that none of it is left, and the same request succeeds once the
// fault is gone. Replaces the R0 baseline that reproduced B02.
export async function probeR4Lifecycle({ connectionString, control, allowedPorts }) {
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

  const q = (sql, params) => control.query(sql, params);
  const count = async (from, params = []) => Number((await q(`SELECT count(*) FROM r0_fixture.${from}`, params)).rows[0].count);
  const person = async (label) => (await q(`INSERT INTO r0_fixture.native_users (email, first_name, timezone)
    VALUES ($1, $2, 'UTC') RETURNING id`, [`${label}@fixture.invalid`, label])).rows[0].id;
  const owner = await person('owner');
  const member = await person('member');
  const token = generateTokens(owner, 1).accessToken;
  const call = (method, path, body, key, as = token) => new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method, path,
      headers: { Connection: 'close', Authorization: `Bearer ${as}`, ...(key ? { 'Idempotency-Key': key } : {}),
        ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}) } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
      });
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('R4 lifecycle request timed out')));
    req.end(bytes);
  });

  // Every table these operations write, as an independent connection sees it.
  const snapshot = async () => {
    const rows = {};
    for (const table of ['native_projects', 'native_project_members', 'native_rehearsals',
      'native_rehearsal_responses', 'native_user_availability', 'native_push_reminders']) {
      rows[table] = (await q(`SELECT * FROM r0_fixture.${table} ORDER BY id`)).rows;
    }
    return rows;
  };
  await q(`CREATE FUNCTION r0_fixture.injected_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'R4_INJECTED_FAILURE'; END $$`);
  // Fails `event` on `table` for the length of `body`, and checks that the
  // request answered 500 and left every row as it was.
  const failing = async (event, table, request) => {
    const before = await snapshot();
    await q(`CREATE TRIGGER injected_failure BEFORE ${event} ON r0_fixture.${table}
      FOR EACH ROW EXECUTE FUNCTION r0_fixture.injected_failure()`);
    let response;
    try { response = await request(); }
    finally { await q(`DROP TRIGGER injected_failure ON r0_fixture.${table}`); }
    assert.equal(response.status, 500, `the injected failure must surface: ${JSON.stringify(response.body)}`);
    assert.deepEqual(await snapshot(), before, `a failure on ${event} ${table} must leave nothing behind`);
  };

  const START = '2031-05-20T17:00:00.000Z';
  const END = '2031-05-20T19:00:00.000Z';
  try {
    // B02: a project and its owner.
    await failing('INSERT', 'native_project_members', () => call('POST', '/api/native/projects', { name: 'Lifecycle' }));
    const created = await call('POST', '/api/native/projects', { name: 'Lifecycle' });
    assert.equal(created.status, 201);
    const projectId = Number(created.body.project.id);
    assert.equal(await count(`native_projects WHERE name = 'Lifecycle'`), 1, 'B02: the retry makes one project');
    assert.equal(await count(`native_project_members WHERE project_id = $1 AND user_id = $2 AND role = 'owner'`,
      [projectId, owner]), 1);
    contracts.push('a project whose owner cannot be written is not created; the retry creates one, owned (B02)');
    await q(`INSERT INTO r0_fixture.native_project_members (project_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')`,
      [projectId, member]);

    // D03: creating a rehearsal.
    const rehearsal = { title: 'Run', startsAt: START, endsAt: END, participant_ids: [owner, member] };
    await failing('INSERT', 'native_user_availability',
      () => call('POST', `/api/native/projects/${projectId}/rehearsals`, rehearsal));
    const made = await call('POST', `/api/native/projects/${projectId}/rehearsals`, rehearsal);
    assert.equal(made.status, 201);
    const rehearsalId = Number(made.body.rehearsal.id);
    assert.equal(await count('native_rehearsals'), 1, 'D03: the retry makes one rehearsal');
    assert.equal(await count(`native_user_availability WHERE external_event_id = $1`, [String(rehearsalId)]), 2);
    contracts.push('a rehearsal whose busy slots cannot be written is not created; the retry creates one (D03)');

    // D03: editing it — moved, recast, its claims released, all or nothing.
    await q(`INSERT INTO r0_fixture.native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at) VALUES ($1, $2, '24h', NOW())`,
      [rehearsalId, member]);
    const moved = { title: 'Moved', startsAt: '2031-05-22T17:00:00.000Z', endsAt: '2031-05-22T19:00:00.000Z', participant_ids: [owner] };
    await failing('INSERT', 'native_user_availability',
      () => call('PUT', `/api/native/projects/${projectId}/rehearsals/${rehearsalId}`, moved));
    assert.equal((await call('PUT', `/api/native/projects/${projectId}/rehearsals/${rehearsalId}`, moved)).status, 200);
    assert.deepEqual((await q(`SELECT user_id, starts_at FROM r0_fixture.native_user_availability WHERE external_event_id = $1`,
      [String(rehearsalId)])).rows.map((row) => [row.user_id, row.starts_at.toISOString()]), [[owner, moved.startsAt]]);
    assert.equal(await count('native_push_reminders WHERE rehearsal_id = $1', [rehearsalId]), 0);
    contracts.push('an edit whose busy slots cannot be rebuilt keeps the old time, cast, slots and claims (D03)');

    // B01: removing a member.
    await q(`INSERT INTO r0_fixture.native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, 'no')`, [rehearsalId, member]);
    await q(`INSERT INTO r0_fixture.native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, is_all_day)
      VALUES ($1, $2, $3, 'busy', 'rehearsal', $4, FALSE)`, [member, START, END, String(rehearsalId)]);
    const removal = () => call('DELETE', `/api/native/projects/${projectId}/members/${member}`);
    await failing('DELETE', 'native_user_availability', removal);
    assert.equal((await removal()).status, 200, 'B01: the retry still finds the member');
    assert.equal(await count('native_project_members WHERE user_id = $1', [member]), 0);
    assert.equal(await count('native_rehearsal_responses WHERE user_id = $1', [member]), 0);
    assert.equal(await count('native_user_availability WHERE user_id = $1', [member]), 0);
    contracts.push('a removal that fails half-way keeps the member whole, and the retry removes everything (B01)');

    // D03: deleting the rehearsal.
    const remove = () => call('DELETE', `/api/native/projects/${projectId}/rehearsals/${rehearsalId}`);
    await failing('DELETE', 'native_rehearsals', remove);
    assert.equal((await remove()).status, 200);
    assert.equal(await count('native_rehearsals WHERE id = $1', [rehearsalId]), 0);
    assert.equal(await count('native_user_availability WHERE external_event_id = $1', [String(rehearsalId)]), 0);
    contracts.push('a rehearsal that cannot be deleted keeps its cast and busy slots (D03)');

    // The same create twice at once with one Idempotency-Key, as a tap
    // repeated while the first answer is still on its way: the second waits
    // on the first one's key and answers with its rehearsal (migration 012).
    const sessions = async (where) => {
      await q('SELECT pg_catalog.pg_stat_clear_snapshot()');
      return Number((await q(`SELECT count(*) FROM pg_catalog.pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid() AND ${where}`)).rows[0].count);
    };
    const until = async (condition, what) => {
      for (let i = 0; i < 200; i += 1) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`timed out waiting for ${what}`);
    };
    // Every busy slot written takes a second: a create is caught after it has
    // read its roster and while it books, its transaction still open.
    await q(`CREATE FUNCTION r0_fixture.slow_slot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(1); RETURN NEW; END $$`);
    const slowSlots = async (body) => {
      await q(`CREATE TRIGGER slow_slot BEFORE INSERT ON r0_fixture.native_user_availability
        FOR EACH ROW EXECUTE FUNCTION r0_fixture.slow_slot()`);
      try { return await body(); }
      finally { await q('DROP TRIGGER slow_slot ON r0_fixture.native_user_availability'); }
    };
    const booking = () => until(async () => (await sessions(`wait_event = 'PgSleep'`)) > 0, 'a create to be booking its slots');
    const KEY = 'r4-lifecycle-pg-key-0001';
    const keyed = { title: 'Keyed', startsAt: START, endsAt: END, participant_ids: [owner] };
    const path = `/api/native/projects/${projectId}/rehearsals`;
    const [first, second] = await slowSlots(async () => {
      const firstCall = call('POST', path, keyed, KEY);
      await booking();
      const secondCall = call('POST', path, keyed, KEY);
      await until(async () => (await sessions(`wait_event_type = 'Lock'`)) > 0, 'the second create to wait on the first one\'s key');
      return Promise.all([firstCall, secondCall]);
    });
    assert.deepEqual([first.status, second.status], [201, 201]);
    assert.deepEqual(second.body, first.body, 'the repeat answers with the first create');
    assert.equal(await count(`native_rehearsals WHERE title = 'Keyed'`), 1, 'one key, one rehearsal');
    const again = await call('POST', path, { ...keyed, title: 'Other' }, KEY);
    assert.equal(again.status, 422, 'the same key with a different request is refused');
    assert.equal(await count(`native_rehearsals WHERE title = 'Other'`), 0);
    contracts.push('two creates with one Idempotency-Key at once: the second waits on the first and answers with its rehearsal');

    // B01 against a create in flight: the create has read a roster with the
    // leaver on it and is booking; the removal must not clear their slots
    // before that booking commits (projectLock.js).
    const leaver = await person('leaver');
    await q(`INSERT INTO r0_fixture.native_project_members (project_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')`,
      [projectId, leaver]);
    const [raced, leaving] = await slowSlots(async () => {
      const creating = call('POST', path, { title: 'Raced', startsAt: START, endsAt: END, participant_ids: [owner, leaver] });
      await booking();
      return Promise.all([creating, call('DELETE', `/api/native/projects/${projectId}/members/${leaver}`)]);
    });
    assert.deepEqual([raced.status, leaving.status], [201, 200]);
    assert.equal(await count('native_project_members WHERE user_id = $1', [leaver]), 0);
    assert.equal(await count('native_rehearsal_responses WHERE user_id = $1', [leaver]), 0,
      'B01: a member removed while a rehearsal was being created is not left on it');
    assert.equal(await count('native_user_availability WHERE user_id = $1', [leaver]), 0,
      'B01: a member removed while a rehearsal was being created keeps no busy slot from it');
    contracts.push('a member removed while a rehearsal is being created with them is left on nothing and busy for nothing (B01)');

    // B02: deleting the project, with a rehearsal still on it — and the retry
    // racing another create, which must not be cascaded away with its busy
    // slots left behind (projectLock.js).
    const last = await call('POST', path, { ...rehearsal, participant_ids: [owner] });
    assert.equal(last.status, 201);
    const dropProject = () => call('DELETE', `/api/native/projects/${projectId}`);
    await failing('DELETE', 'native_projects', dropProject);
    const [late, dropped] = await slowSlots(async () => {
      const creating = call('POST', path, { title: 'Late', startsAt: START, endsAt: END, participant_ids: [owner] });
      await booking();
      return Promise.all([creating, dropProject()]);
    });
    assert.deepEqual([late.status, dropped.status], [201, 200]);
    assert.equal(await count('native_projects WHERE id = $1', [projectId]), 0);
    assert.equal(await count('native_rehearsals'), 0);
    assert.equal(await count(`native_user_availability WHERE source = 'rehearsal'`), 0,
      'B02: a rehearsal created while the project was deleted leaves no busy slot');
    contracts.push('a project that cannot be deleted keeps its rehearsals\' busy slots; the retry deletes both, '
      + 'and a rehearsal created meanwhile with them (B02)');

    // B02 through account deletion: the owner deletes their account, which
    // takes the project with it, while another administrator is booking a
    // rehearsal there. The deletion must take the project in the same order
    // as DELETE /projects/:id, or that rehearsal is cascaded away and its
    // busy slots stay on the administrator's calendar (projectLock.js).
    const departing = await person('departing');
    const admin = await person('admin');
    const departingToken = generateTokens(departing, 1).accessToken;
    const adminToken = generateTokens(admin, 1).accessToken;
    const theirs = await call('POST', '/api/native/projects', { name: 'Departing' }, undefined, departingToken);
    assert.equal(theirs.status, 201);
    const theirsId = Number(theirs.body.project.id);
    await q(`INSERT INTO r0_fixture.native_project_members (project_id, user_id, role, status) VALUES ($1, $2, 'admin', 'active')`,
      [theirsId, admin]);
    const [booked, gone] = await slowSlots(async () => {
      const creating = call('POST', `/api/native/projects/${theirsId}/rehearsals`,
        { title: 'Orphaned', startsAt: START, endsAt: END, participant_ids: [admin] }, undefined, adminToken);
      await booking();
      return Promise.all([creating, call('DELETE', '/api/auth/me', undefined, undefined, departingToken)]);
    });
    assert.deepEqual([booked.status, gone.status], [201, 200]);
    assert.equal(await count('native_users WHERE id = $1', [departing]), 0);
    assert.equal(await count('native_projects WHERE id = $1', [theirsId]), 0);
    assert.equal(await count('native_rehearsals'), 0);
    assert.equal(await count(`native_user_availability WHERE user_id = $1 AND source = 'rehearsal'`, [admin]), 0,
      'B02: a rehearsal created while its project went with the owner\'s account leaves no busy slot');
    contracts.push('an account deleted while another administrator creates a rehearsal in its project takes the '
      + 'project, the rehearsal and its busy slots together (B02)');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
