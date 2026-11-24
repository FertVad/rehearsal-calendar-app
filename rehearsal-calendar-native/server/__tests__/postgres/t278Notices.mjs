import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { manifest, inspectSchema } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// A deleted account's name leaves other people's inboxes, on PostgreSQL (T-278).
// The notices that carry a member's name — joined, made an administrator, has
// seen a rehearsal — record whom they name in data.aboutUserId; DELETE /me
// removes every one naming the account; data step 015 removes the ones written
// before the mark. And a notice being written while the account is deleted
// either commits first and is removed with it, or waits and writes nothing.
export async function probeT278Notices({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  const { notifyMemberJoined, notifyAdminAppointed, notifyMemberResponse } =
    await import('../../services/notifications/pushNotificationService.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];

  const q = (sql, params) => control.query(sql, params);
  const person = async (label) => (await q(`INSERT INTO r0_fixture.native_users (email, first_name, last_name, timezone)
    VALUES ($1, $2, 'Fixture', 'UTC') RETURNING id`, [`${label}@fixture.invalid`, label])).rows[0].id;
  const deleteMe = (userId) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method: 'DELETE',
      path: '/api/auth/me', headers: { Connection: 'close',
        Authorization: `Bearer ${generateTokens(userId, 1).accessToken}` } }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('T-278 delete request timed out')));
    req.end();
  });
  const rows = async () => (await q(`SELECT id, user_id, type, body, data FROM r0_fixture.native_notifications
    ORDER BY id`)).rows;
  const about = async (userId) => (await rows()).filter((row) => Number(row.data?.aboutUserId) === userId);
  const until = async (condition, what) => {
    for (let i = 0; i < 200; i += 1) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`timed out waiting for ${what}`);
  };

  try {
    const owner = await person('owner');
    const admin = await person('admin');
    const leaving = await person('leaving');
    const staying = await person('staying');
    const rehearsal = { id: 1, project_id: 1, title: 'Run', starts_at: '2030-10-01T17:00:00Z' };

    // Data step 015 first, on rows as the old server wrote them: the three
    // naming notices without a mark (one with no data at all), beside marked
    // ones and notices that name nobody.
    const insert = (userId, type, body, data) => q(`INSERT INTO r0_fixture.native_notifications
      (user_id, type, title, body, data) VALUES ($1, $2, 'T', $3, $4::jsonb) RETURNING id`,
    [userId, type, body, data === null ? null : JSON.stringify(data)]);
    await insert(owner, 'member_joined', 'old joined', { type: 'member_joined', projectId: 1 });
    await insert(owner, 'admin_appointed', 'old admin', { type: 'admin_appointed', projectId: 1 });
    await insert(admin, 'member_response', 'old seen', { type: 'member_response', rehearsalId: 1 });
    await insert(admin, 'member_joined', 'old, no data', null);
    const kept = [
      ...(await insert(owner, 'member_joined', 'marked joined', { type: 'member_joined', aboutUserId: staying })).rows,
      ...(await insert(admin, 'member_response', 'marked seen', { type: 'member_response', aboutUserId: staying })).rows,
      ...(await insert(owner, 'rehearsal_created', 'names nobody', { type: 'rehearsal_created', rehearsalId: 1 })).rows,
      ...(await insert(owner, 'project_deleted', 'no data', null)).rows,
    ].map((row) => row.id);
    const step = await readFile(new URL('../../migrations/015-delete-unmarked-name-notices.sql', import.meta.url), 'utf8');
    await q('SET search_path TO r0_fixture');
    await q(step);
    assert.deepEqual((await rows()).map((row) => row.id), kept, '015 deletes the unmarked naming notices only');
    await q(step);
    assert.deepEqual((await rows()).map((row) => row.id), kept, '015 rerun changes nothing');
    contracts.push('step 015 deletes the joined/appointed/seen notices without a mark, keeps marked and other notices; rerun is a no-op');

    // The real service writes each of the three with its mark, through the
    // real adapter: the guarded insert's parameters resolve on PostgreSQL.
    await notifyMemberJoined('Hamlet', { id: leaving, name: 'leaving Fixture' }, [owner, admin], 1);
    await notifyAdminAppointed('Hamlet', { id: leaving, name: 'leaving Fixture' }, [admin], 1);
    await notifyMemberResponse(rehearsal, 'Hamlet', { id: leaving, name: 'leaving Fixture' }, [owner, admin]);
    await notifyMemberJoined('Hamlet', { id: staying, name: 'staying Fixture' }, [owner, admin], 1);
    const naming = await about(leaving);
    assert.deepEqual(naming.map((row) => row.type).sort(),
      ['admin_appointed', 'member_joined', 'member_joined', 'member_response', 'member_response']);
    assert.ok(naming.every((row) => row.body.includes('leaving Fixture')));
    contracts.push('joined, appointed and seen notices record whom they name (data.aboutUserId) on PostgreSQL');

    const before = (await rows()).filter((row) => Number(row.data?.aboutUserId) !== leaving);
    assert.equal(await deleteMe(leaving), 200);
    assert.deepEqual(await about(leaving), []);
    assert.deepEqual((await rows()).filter((row) => row.body.includes('leaving')), []);
    assert.deepEqual(await rows(), before, 'every other notice stays');
    contracts.push('DELETE /me removes every notice naming the account from the others\' inboxes, and nothing else');

    // A notice written while the account is being deleted. The deletion has
    // removed the account and the notices naming it, uncommitted; the notice
    // waits on the account's row, and after the commit writes nothing.
    const racing = await person('racing');
    const waiting = async () => {
      await q('SELECT pg_catalog.pg_stat_clear_snapshot()');
      return Number((await q(`SELECT count(*) FROM pg_catalog.pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`)).rows[0].count) > 0;
    };
    const deleter = new pg.Client({ connectionString });
    await deleter.connect();
    try {
      await deleter.query('BEGIN');
      await deleter.query('DELETE FROM r0_fixture.native_users WHERE id = $1', [racing]);
      await deleter.query(`DELETE FROM r0_fixture.native_notifications
        WHERE CAST(data->>'aboutUserId' AS TEXT) = $1`, [String(racing)]);
      const told = notifyMemberJoined('Hamlet', { id: racing, name: 'racing Fixture' }, [owner, admin], 1);
      await until(waiting, 'the notice to wait for the account being deleted');
      await deleter.query('COMMIT');
      await told;
    } finally { await deleter.end(); }
    assert.deepEqual(await about(racing), [], 'a notice racing the deletion leaves no name behind');
    assert.deepEqual((await rows()).filter((row) => row.body.includes('racing')), []);
    contracts.push('a notice written during the deletion waits for it and writes nothing naming the deleted account');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
