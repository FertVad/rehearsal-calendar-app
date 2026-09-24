import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { connect, timeFixture, emailFixture, cases } from './fixture.mjs';
const tests = cases();
const client = await connect();
try {
  for (const [name,zone] of [['utc','UTC'],['jerusalem','Asia/Jerusalem'],['los_angeles','America/Los_Angeles']]) {
    await tests.run(`FM01 historical full SQL preserves UTC source under ${name}`, async () => {
      await timeFixture(client, `fm_before_${name}`);
      await client.query("SELECT set_config('TimeZone',$1,false)", [zone]);
      for(const file of ['migrate-rehearsals-to-timestamptz.sql','migrate-availability-to-timestamptz.sql']) {
        await client.query(readFileSync(new URL(`../historical/${file}`, import.meta.url),'utf8'));
      }
      const { rows } = await client.query(`SELECT starts_at = TIMESTAMPTZ '2026-09-10 10:00:00.123456+00' AS rehearsal,
        (SELECT starts_at = TIMESTAMPTZ '2026-03-08 00:00+00' AND ends_at = TIMESTAMPTZ '2026-03-08 23:59+00'
         FROM native_user_availability WHERE id=2) AS availability
        FROM native_rehearsals WHERE id=1`);
      console.log(JSON.stringify({ observation:name, expectedUTCRehearsal:rows[0].rehearsal, expectedUTCAllDay:rows[0].availability }));
      assert.deepEqual(rows,[{rehearsal:true,availability:true}]);
    });
  }
  await tests.run('FM02 exact historical SQLite001 replay remains one email method per password user', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`CREATE TABLE native_users(id INTEGER PRIMARY KEY,email TEXT,password_hash TEXT,created_at TEXT,updated_at TEXT,last_login_at TEXT);
        INSERT INTO native_users VALUES(1,'synthetic@example.invalid','synthetic-hash','2026-01-01','2026-01-01',NULL);`);
      const sql = readFileSync(new URL('../historical/001-add-oauth-providers.sql',import.meta.url),'utf8');
      sqlite.exec(sql); sqlite.exec(sql);
      const count = sqlite.prepare("SELECT COUNT(*) AS count FROM native_auth_providers WHERE user_id=1 AND provider_type='email'").get().count;
      console.log(JSON.stringify({ observation:'actual original SQLite001 replay',emailRowCount:count }));
      assert.equal(count,1);
    } finally { sqlite.close(); }
  });
  await tests.run('FM02 materialized PostgreSQL equivalent nullable conflict target is replay-idempotent', async () => {
    await emailFixture(client,'fm_before_email_pg');
    const sql = `INSERT INTO native_auth_providers(user_id,provider_type,provider_email,created_at,updated_at,last_used_at)
      SELECT id,'email',email,COALESCE(created_at,NOW()),COALESCE(updated_at,NOW()),last_login_at
      FROM native_users WHERE password_hash IS NOT NULL AND password_hash <> ''
      ON CONFLICT(provider_type,provider_user_id) DO NOTHING`;
    await client.query(sql); await client.query(sql);
    const counts = (await client.query("SELECT count(*)::int AS count FROM native_auth_providers WHERE provider_type='email' GROUP BY user_id ORDER BY user_id")).rows;
    console.log(JSON.stringify({ observation:'PG documented conflict-target equivalent; timestamps supplied solely for fixture',emailCounts:counts.map(r=>r.count) }));
    assert.deepEqual(counts,[{count:1},{count:1}]);
  });
} finally { await client.end(); }
tests.finish();
