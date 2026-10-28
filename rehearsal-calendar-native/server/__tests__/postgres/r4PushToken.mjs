import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// One owner per push token on PostgreSQL (R4, cause fix 11: G01). Two people
// register the same phone's token at once — an account switch with a late
// registration from the previous session still in flight. Each request used to
// delete the other owners' rows and then upsert its own on (user_id,
// device_token); neither delete saw the other's uncommitted insert, so both
// rows survived and the previous owner's pushes kept reaching the phone. The
// token is now unique on its own (migration 013) and registration is one
// upsert on it: the later request waits for the earlier one and takes the row.
export async function probeR4PushToken({ connectionString, control, allowedPorts }) {
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
  const person = async (label) => (await q(`INSERT INTO r0_fixture.native_users (email, first_name, timezone)
    VALUES ($1, $2, 'UTC') RETURNING id`, [`${label}@fixture.invalid`, label])).rows[0].id;
  const register = (userId, deviceToken) => new Promise((resolve, reject) => {
    const bytes = Buffer.from(JSON.stringify({ deviceToken, deviceType: 'ios', deviceName: 'iPhone' }));
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method: 'POST',
      path: '/api/native/push-tokens', headers: { Connection: 'close',
        Authorization: `Bearer ${generateTokens(userId, 1).accessToken}`,
        'Content-Type': 'application/json', 'Content-Length': bytes.length } }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('R4 push token request timed out')));
    req.end(bytes);
  });
  const owners = async (deviceToken) => (await q(
    'SELECT user_id FROM r0_fixture.native_push_tokens WHERE device_token = $1 ORDER BY user_id', [deviceToken]))
    .rows.map((row) => row.user_id);
  const until = async (condition, what) => {
    for (let i = 0; i < 200; i += 1) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const sleeping = async () => {
    await q('SELECT pg_catalog.pg_stat_clear_snapshot()');
    return Number((await q(`SELECT count(*) FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event = 'PgSleep'`)).rows[0].count);
  };

  try {
    const previous = await person('previous');
    const next = await person('next');

    // Every token row written takes a second: the first registration is caught
    // with its insert made and its transaction still open when the second one
    // starts, which is the order that left two owners.
    await q(`CREATE FUNCTION r0_fixture.slow_token() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(1); RETURN NEW; END $$`);
    await q(`CREATE TRIGGER slow_token BEFORE INSERT ON r0_fixture.native_push_tokens
      FOR EACH ROW EXECUTE FUNCTION r0_fixture.slow_token()`);
    const race = async (deviceToken) => {
      const first = register(previous, deviceToken);
      await until(async () => (await sleeping()) > 0, 'the first registration to be writing its row');
      return Promise.all([first, register(next, deviceToken)]);
    };
    const PHONE = 'ExponentPushToken[r4racephone0000000001]';
    assert.deepEqual(await race(PHONE), [200, 200]);
    assert.deepEqual(await owners(PHONE), [next], 'G01: one push token, one owner — the later registration');
    contracts.push('two registrations of one token at once leave one owner, the later one (G01)');

    // The audit's order with a row already there: the previous owner holds the
    // token, re-registers it as the next person signs in on the phone.
    const HELD = 'ExponentPushToken[r4racephone0000000002]';
    assert.equal(await register(previous, HELD), 200);
    assert.deepEqual(await race(HELD), [200, 200]);
    assert.deepEqual(await owners(HELD), [next], 'G01: a held token racing a new sign-in still has one owner');
    contracts.push('a held token re-registered while the next person signs in ends with one owner (G01)');
    await q('DROP TRIGGER slow_token ON r0_fixture.native_push_tokens');

    // The rule is the schema's, not the handler's: no writer can add a second owner.
    await assert.rejects(q(`INSERT INTO r0_fixture.native_push_tokens (user_id, device_token, last_active_at)
      VALUES ($1, $2, NOW())`, [previous, PHONE]), { code: '23505' });
    contracts.push('the schema refuses a second owner of a token to any writer');

    // Migration 013 on the shape a schema has before it: the old pair key, the
    // plain token index, and tokens held twice. The most recently active holder
    // keeps each token (the later row on a tie), and the result is the current
    // catalog exactly.
    const migration = await readFile(new URL('../../migrations/013-push-token-owner.sql', import.meta.url), 'utf8');
    await q('BEGIN');
    try {
      await q('SET LOCAL search_path TO r0_fixture,pg_catalog');
      await q(`DELETE FROM native_push_tokens;
        ALTER TABLE native_push_tokens DROP CONSTRAINT native_push_tokens_device_token_key;
        ALTER TABLE native_push_tokens ADD UNIQUE (user_id, device_token);
        CREATE INDEX idx_push_tokens_token ON native_push_tokens(device_token)`);
      const before = await inspectSchema(q, { schema: 'r0_fixture', profile: 'rehearsly-pg-current-v1' });
      assert.equal(before.compatible, false, 'the old shape is not the current catalog');
      await q(`INSERT INTO native_push_tokens (user_id, device_token, last_active_at) VALUES
        ($1, 'ExponentPushToken[twice]', '2026-10-01T10:00:00Z'), ($2, 'ExponentPushToken[twice]', '2026-10-01T11:00:00Z'),
        ($2, 'ExponentPushToken[tie]', '2026-10-01T10:00:00Z'), ($1, 'ExponentPushToken[tie]', '2026-10-01T10:00:00Z'),
        ($1, 'ExponentPushToken[once]', '2026-10-01T09:00:00Z')`, [previous, next]);
      await q(migration);
      assert.deepEqual((await q('SELECT device_token, user_id FROM native_push_tokens ORDER BY device_token')).rows, [
        { device_token: 'ExponentPushToken[once]', user_id: previous },
        { device_token: 'ExponentPushToken[tie]', user_id: previous },
        { device_token: 'ExponentPushToken[twice]', user_id: next },
      ]);
      const after = await inspectSchema(q, { schema: 'r0_fixture', profile: 'rehearsly-pg-current-v1' });
      assert.equal(after.compatible, true, `013 yields the current catalog: ${JSON.stringify(after.issues)}`);
    } finally { await q('ROLLBACK'); }
    contracts.push('migration 013 keeps the most recently active holder of each token and yields the current catalog');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
