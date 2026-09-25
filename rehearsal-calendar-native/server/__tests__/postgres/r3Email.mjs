import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

const EMAIL = 'race@fixture.invalid';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await check()) return; await sleep(10); }
  throw new Error('Synthetic barrier deadline exceeded');
}

// One-time codes against real concurrency (R3): the application's own adapter,
// two or more real PostgreSQL connections, barriers instead of sleeps. The
// SQLite harness drops FOR UPDATE, so these properties exist only here.
export async function probeR3Email({ connectionString, control }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const db = await database.initDatabase({ connectionString });
  const { issueCode, checkCode, CodeRateLimited } = await import('../../services/email/codes.js');
  const contracts = [];
  const userId = (await control.query(`INSERT INTO r0_fixture.native_users(email, first_name)
    VALUES ($1, 'Race') RETURNING id`, [EMAIL])).rows[0].id;
  const waitingOnLocks = async () => Number((await control.query(`SELECT count(*) FROM pg_catalog.pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`)).rows[0].count);
  let clock = Date.now();
  const tick = () => new Date(clock += 61_000);

  try {
    // Two checks of one code: the first holds the code row, the second waits
    // on it, then no longer sees a live row. Exactly one success.
    const { code } = await db.transaction((tx) => issueCode(tx, { userId, purpose: 'verify', email: EMAIL, now: tick() }));
    const now = new Date(clock + 1000);
    let checked; const firstChecked = new Promise((resolve) => { checked = resolve; });
    let release; const held = new Promise((resolve) => { release = resolve; });
    const first = db.transaction(async (tx) => {
      const result = await checkCode(tx, { userId, purpose: 'verify', email: EMAIL, code, now });
      checked(result); await held; return result;
    });
    await firstChecked;
    const second = db.transaction((tx) => checkCode(tx, { userId, purpose: 'verify', email: EMAIL, code, now }));
    await eventually(async () => (await waitingOnLocks()) === 1);
    release();
    assert.deepEqual(await first, { ok: true, email: EMAIL });
    assert.deepEqual(await second, { ok: false, reason: 'CODE_MISSING' });
    contracts.push('two concurrent checks of one code: one success; the second waited on the code row lock');

    // Five wrong codes at once: every attempt is counted, none is lost to a
    // race, and the fifth burns the code.
    const issued = await db.transaction((tx) => issueCode(tx, { userId, purpose: 'reset', email: EMAIL, now: tick() }));
    const wrong = issued.code === '000000' ? '000001' : '000000';
    const attemptAt = new Date(clock + 1000);
    const outcomes = await Promise.all(Array.from({ length: 5 }, () =>
      db.transaction((tx) => checkCode(tx, { userId, purpose: 'reset', email: EMAIL, code: wrong, now: attemptAt }))));
    assert.deepEqual(outcomes.map((outcome) => outcome.reason).sort(),
      ['CODE_INVALID', 'CODE_INVALID', 'CODE_INVALID', 'CODE_INVALID', 'CODE_LOCKED']);
    const burned = (await control.query('SELECT attempts, consumed_at FROM r0_fixture.native_email_codes WHERE id = $1', [issued.id])).rows[0];
    assert.equal(burned.attempts, 5);
    assert.notEqual(burned.consumed_at, null);
    contracts.push('five concurrent wrong codes: all counted, the code burned');

    // Two code requests at once under the user row lock, as the routes issue
    // them: one code, one refusal by the resend interval.
    const requestAt = tick();
    const requests = await Promise.allSettled(Array.from({ length: 2 }, () => db.transaction(async (tx) => {
      await tx.get('SELECT id FROM native_users WHERE id = $1 FOR UPDATE', [userId]);
      return issueCode(tx, { userId, purpose: 'change', email: 'new@fixture.invalid', now: requestAt });
    })));
    assert.equal(requests.filter((request) => request.status === 'fulfilled').length, 1);
    assert.ok(requests.find((request) => request.status === 'rejected').reason instanceof CodeRateLimited);
    assert.equal(Number((await control.query(`SELECT count(*) FROM r0_fixture.native_email_codes
      WHERE user_id = $1 AND purpose = 'change'`, [userId])).rows[0].count), 1);
    contracts.push('two concurrent code requests under the user lock: one code, one rate-limited');
  } finally {
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
