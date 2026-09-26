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
    const firstResult = await first;
    assert.ok(firstResult.ok && firstResult.email === EMAIL, 'first concurrent check of one code must succeed');
    assert.deepEqual(await second, { ok: false, reason: 'CODE_MISSING' }, 'second concurrent check of one code must not succeed');
    contracts.push('two concurrent checks of one code: one success; the second waited on the code row lock');

    // Five wrong codes at once: the first holds the code row, the other four
    // are seen waiting on it, then each counts in turn — none is lost to a
    // race, and the fifth burns the code.
    const issued = await db.transaction((tx) => issueCode(tx, { userId, purpose: 'reset', email: EMAIL, now: tick() }));
    const wrong = issued.code === '000000' ? '000001' : '000000';
    const attemptAt = new Date(clock + 1000);
    const wrongCheck = (tx) => checkCode(tx, { userId, purpose: 'reset', email: EMAIL, code: wrong, now: attemptAt });
    let wrongChecked; const firstWrongChecked = new Promise((resolve) => { wrongChecked = resolve; });
    let releaseWrong; const wrongHeld = new Promise((resolve) => { releaseWrong = resolve; });
    const firstWrong = db.transaction(async (tx) => { const result = await wrongCheck(tx); wrongChecked(); await wrongHeld; return result; });
    await firstWrongChecked;
    const laterWrong = Array.from({ length: 4 }, () => db.transaction(wrongCheck));
    await eventually(async () => (await waitingOnLocks()) === 4);
    releaseWrong();
    const outcomes = await Promise.all([firstWrong, ...laterWrong]);
    assert.deepEqual(outcomes.map((outcome) => outcome.reason).sort(),
      ['CODE_INVALID', 'CODE_INVALID', 'CODE_INVALID', 'CODE_INVALID', 'CODE_LOCKED'],
      'five concurrent wrong codes must count as four invalid and one locked');
    const burned = (await control.query('SELECT attempts, consumed_at FROM r0_fixture.native_email_codes WHERE id = $1', [issued.id])).rows[0];
    assert.equal(burned.attempts, 5, 'every concurrent wrong attempt must be counted');
    assert.notEqual(burned.consumed_at, null, 'the fifth wrong attempt must burn the code');
    contracts.push('five concurrent wrong codes, four seen waiting on the first: all counted, the code burned');

    // Two code requests at once under the user row lock, as the routes issue
    // them: the first holds the lock with its code written, the second is seen
    // waiting, then meets the resend interval. One code, one refusal.
    const requestAt = tick();
    let issuedFirst; const firstIssued = new Promise((resolve) => { issuedFirst = resolve; });
    let releaseIssue; const issueHeld = new Promise((resolve) => { releaseIssue = resolve; });
    const request = (hold) => db.transaction(async (tx) => {
      await tx.get('SELECT id FROM native_users WHERE id = $1 FOR UPDATE', [userId]);
      const issuedCode = await issueCode(tx, { userId, purpose: 'change', email: 'new@fixture.invalid', now: requestAt });
      if (hold) { issuedFirst(); await issueHeld; }
      return issuedCode;
    });
    const firstRequest = request(true); firstRequest.catch(() => {});
    await firstIssued;
    const secondRequest = request(false); secondRequest.catch(() => {});
    await eventually(async () => (await waitingOnLocks()) === 1);
    releaseIssue();
    const [firstOutcome, secondOutcome] = await Promise.allSettled([firstRequest, secondRequest]);
    assert.equal(firstOutcome.status, 'fulfilled', 'the first concurrent code request must get a code');
    assert.ok(secondOutcome.status === 'rejected' && secondOutcome.reason instanceof CodeRateLimited,
      'the second concurrent code request must meet the resend interval');
    assert.equal(Number((await control.query(`SELECT count(*) FROM r0_fixture.native_email_codes
      WHERE user_id = $1 AND purpose = 'change'`, [userId])).rows[0].count), 1, 'two concurrent requests must leave one code');
    contracts.push('two concurrent code requests, the second seen waiting on the user lock: one code, one rate-limited');
  } finally {
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
