import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

const PASSWORD = 'r3-auth-fixture-password';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await check()) return; await sleep(10); }
  throw new Error('Synthetic barrier deadline exceeded');
}

// Registration and address confirmation through the real app on PostgreSQL
// (R3: A01): what the SQLite harness cannot show — the unique key deciding two
// registrations of one address, and the user row lock deciding two
// confirmations with one code. Barriers hold a lock from the control
// connection until both requests are seen waiting on it.
export async function probeR3Auth({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  process.env.EMAIL_TRANSPORT = 'capture-for-tests';
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  const { capturedEmails } = await import('../../services/email/transport.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];
  let forwardedFor = 10;
  const post = (route, body) => new Promise((resolve, reject) => {
    const bytes = Buffer.from(JSON.stringify(body));
    // A fresh documentation address per request keeps the auth IP budget out of the way.
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method: 'POST',
      headers: { Connection: 'close', 'Content-Type': 'application/json', 'Content-Length': bytes.length,
        'X-Forwarded-For': `198.51.100.${forwardedFor++}` } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (error) { reject(error); }
      });
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('R3 auth request timed out')));
    req.end(bytes);
  });
  // The control connection holds the lock inside a transaction, where
  // pg_stat_activity is a snapshot taken once; it is cleared before each look.
  const activity = async (sql) => {
    await control.query('SELECT pg_catalog.pg_stat_clear_snapshot()');
    return (await control.query(sql)).rows;
  };
  const waitingOnLocks = async () => Number((await activity(`SELECT count(*) FROM pg_catalog.pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`))[0].count);
  // Both requests must be seen blocked on the held lock before it is released.
  // On a timeout the backends are named, and the requests are settled first so
  // their dropped sockets cannot hide the reason.
  const barrier = async (requests) => {
    const settled = Promise.allSettled(requests);
    try { await eventually(async () => (await waitingOnLocks()) === requests.length); }
    catch (error) {
      const seen = await activity(`SELECT state, wait_event_type, wait_event, left(query, 120) AS query
        FROM pg_catalog.pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`);
      await control.query('ROLLBACK');
      await settled;
      throw new Error(`${error.message}: ${JSON.stringify(seen)}`);
    }
    await control.query('COMMIT');
    return (await settled).map((outcome) => {
      if (outcome.status === 'rejected') throw outcome.reason;
      return outcome.value;
    });
  };
  const count = async (sql, values = []) => Number((await control.query(sql, values)).rows[0].count);
  const register = (email, extra = {}) => post('/api/auth/register',
    { email, password: PASSWORD, firstName: 'Race', verification: 'code', ...extra });

  try {
    // Refusals write nothing: an app from before R3, and no way to send mail.
    assert.equal((await post('/api/auth/register', { email: 'old@fixture.invalid', password: PASSWORD, firstName: 'Old' })).body.code,
      'CLIENT_UPGRADE_REQUIRED', 'an app from before R3 must be told to update');
    delete process.env.EMAIL_TRANSPORT;
    assert.equal((await register('nomail@fixture.invalid')).status, 503, 'no transport must refuse registration');
    process.env.EMAIL_TRANSPORT = 'capture-for-tests';
    assert.equal(await count('SELECT count(*) FROM r0_fixture.native_users'), 0, 'refused registrations must write nothing');
    contracts.push('old client and missing transport refused with nothing written');

    // Two registrations of one address at once. The identity table is locked,
    // so the first waits at its pending row and the second at the first's
    // uncommitted user; released, the unique key lets exactly one through.
    await control.query('BEGIN');
    await control.query('LOCK TABLE r0_fixture.native_email_identities IN ACCESS EXCLUSIVE MODE');
    const racing = await barrier([register('race@fixture.invalid'), register('RACE@fixture.invalid')]);
    const statuses = racing.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 409], 'two concurrent registrations of one address must give one account');
    assert.equal(await count("SELECT count(*) FROM r0_fixture.native_users WHERE email = 'race@fixture.invalid'"), 1);
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_identities i
      JOIN r0_fixture.native_users u ON u.id = i.user_id WHERE u.email = 'race@fixture.invalid' AND i.status = 'pending'`), 1);
    contracts.push('two concurrent registrations of one address, both seen waiting: one 201, one 409, one pending account');

    // Pending: no session from login.
    const pendingLogin = await post('/api/auth/login', { email: 'race@fixture.invalid', password: PASSWORD });
    assert.equal(pendingLogin.status, 403, 'a pending account must not sign in');
    assert.equal(pendingLogin.body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(pendingLogin.body.accessToken, undefined);
    contracts.push('pending account: login 403 with no tokens');

    // Two confirmations with one code at once: the user row is held, both are
    // seen waiting; released, one confirms and the other finds it done.
    const code = capturedEmails.filter((mail) => mail.to === 'race@fixture.invalid').at(-1).text.match(/\b(\d{6})\b/)[1];
    const userId = (await control.query("SELECT id FROM r0_fixture.native_users WHERE email = 'race@fixture.invalid'")).rows[0].id;
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [userId]);
    const confirmed = await barrier([0, 1].map(() =>
      post('/api/auth/verify-email', { email: 'race@fixture.invalid', password: PASSWORD, code })));
    assert.deepEqual(confirmed.map((response) => response.status).sort(), [200, 409],
      'two concurrent confirmations with one code must confirm once');
    assert.equal(confirmed.find((response) => response.status === 409).body.code, 'ALREADY_VERIFIED');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_identities
      WHERE user_id = $1 AND status = 'verified' AND verified_by = 'code'`, [userId]), 1);
    const login = await post('/api/auth/login', { email: 'race@fixture.invalid', password: PASSWORD });
    assert.equal(login.status, 200, 'a confirmed account must sign in');
    contracts.push('two concurrent confirmations with one code, both seen waiting: one 200, one 409; login works after');

    // The password is checked before the transaction and compared again under
    // the user lock. Changed while the confirmation waited, it no longer counts:
    // the code stays unspent and the address pending.
    assert.equal((await register('moved@fixture.invalid')).status, 201);
    const movedCode = capturedEmails.filter((mail) => mail.to === 'moved@fixture.invalid').at(-1).text.match(/\b(\d{6})\b/)[1];
    const movedId = (await control.query("SELECT id FROM r0_fixture.native_users WHERE email = 'moved@fixture.invalid'")).rows[0].id;
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [movedId]);
    const waiting = post('/api/auth/verify-email', { email: 'moved@fixture.invalid', password: PASSWORD, code: movedCode });
    const settledWaiting = Promise.allSettled([waiting]);
    try { await eventually(async () => (await waitingOnLocks()) === 1); }
    catch (error) { await control.query('ROLLBACK'); await settledWaiting; throw error; }
    await control.query("UPDATE r0_fixture.native_users SET password_hash = 'changed-while-waiting' WHERE id = $1", [movedId]);
    await control.query('COMMIT');
    const [stale] = await settledWaiting;
    assert.equal(stale.status, 'fulfilled');
    assert.equal(stale.value.status, 401, 'a password changed while the confirmation waited must not be accepted');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_codes
      WHERE user_id = $1 AND consumed_at IS NULL AND attempts = 0`, [movedId]), 1, 'the refused confirmation must not spend the code');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_identities
      WHERE user_id = $1 AND status = 'pending'`, [movedId]), 1);
    contracts.push('password changed while a confirmation waited on the user lock: 401, code unspent, address still pending');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
