import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

const PASSWORD = 'r3-auth-fixture-password';
const CHANGED_PASSWORD = 'r3-auth-fixture-changed';
const THIRD_PASSWORD = 'r3-auth-fixture-third';
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
  const { signInWithProvider } = await import('../../utils/accountLinking.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];
  let forwardedFor = 10;
  const call = (method, route, body, token) => new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    // A fresh documentation address per request keeps the auth IP budget out of the way.
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method,
      headers: { Connection: 'close', 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${forwardedFor++}`,
        ...(bytes ? { 'Content-Length': bytes.length } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
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
  const post = (route, body) => call('POST', route, body);
  const version = async (userId) => Number((await control.query(
    'SELECT token_version FROM r0_fixture.native_users WHERE id = $1', [userId])).rows[0].token_version);
  const codeFor = (email) => capturedEmails.filter((mail) => mail.to === email).at(-1).text.match(/\b(\d{6})\b/)[1];

  // A pause after COMMIT and before the route signs its session, for the one
  // transaction whose statements match: the gap a concurrent password change
  // or logout falls into (R3-06). Only the adapter's transaction is wrapped;
  // its SQL, its locks and the routes stay as they are.
  const adapter = database.default;
  const transaction = adapter.transaction;
  let armed = null;
  adapter.transaction = async (callback) => {
    const statements = [];
    const result = await transaction((tx) => callback(Object.fromEntries(['run', 'get', 'all'].map((name) =>
      [name, (sql, params) => { statements.push(sql); return tx[name](sql, params); }]))));
    if (armed && statements.some((sql) => armed.matches.test(sql))) {
      const hold = armed;
      armed = null;
      hold.reached();
      await hold.released;
    }
    return result;
  };
  const holdAfterCommit = (matches) => {
    const hold = { matches };
    hold.reaching = new Promise((resolve) => { hold.reached = resolve; });
    hold.released = new Promise((resolve) => { hold.release = resolve; });
    armed = hold;
    return hold;
  };
  const reach = (hold) => Promise.race([hold.reaching,
    sleep(4000).then(() => { throw new Error('Synthetic post-commit pause was not reached'); })]);
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
  // The same, but each operation starts only once the one before it is seen
  // blocked, so which of them holds the contested row is decided, not raced.
  const inOrder = async (starters) => {
    const operations = [];
    let settled = Promise.allSettled(operations);
    try {
      for (const start of starters) {
        operations.push(start());
        settled = Promise.allSettled(operations);
        await eventually(async () => (await waitingOnLocks()) === operations.length);
      }
    } catch (error) {
      await control.query('ROLLBACK');
      await settled;
      throw error;
    }
    await control.query('COMMIT');
    return (await settled).map((outcome) => {
      if (outcome.status === 'rejected') throw outcome.reason;
      return outcome.value;
    });
  };
  const holdIdentities = async () => {
    await control.query('BEGIN');
    await control.query('LOCK TABLE r0_fixture.native_email_identities IN ACCESS EXCLUSIVE MODE');
  };
  const google = (subject, email, extra = {}) => signInWithProvider({ provider: 'google', providerUserId: subject,
    email, emailVerified: true, firstName: 'Owner', ...extra });
  const accounts = async (email) => (await control.query(`SELECT u.id, u.password_hash, i.status, i.verified_by,
      (SELECT count(*) FROM r0_fixture.native_email_codes c WHERE c.user_id = u.id AND c.consumed_at IS NULL)::int AS live_codes
    FROM r0_fixture.native_users u LEFT JOIN r0_fixture.native_email_identities i ON i.user_id = u.id
    WHERE u.email = $1`, [email])).rows;
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
    const code = codeFor('race@fixture.invalid');
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
    const movedCode = codeFor('moved@fixture.invalid');
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

    // R3-06: a session carries the version read under the lock that checked
    // its proof. An account from before R3 signs in, asks for a code and
    // confirms with its password; after that COMMIT, before the signature,
    // the password changes. The confirmation's session must be revoked by it.
    const legacyId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('legacy@fixture.invalid', $1, 'Legacy') RETURNING id`, [await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
    const before = await post('/api/auth/login', { email: 'legacy@fixture.invalid', password: PASSWORD });
    assert.equal(before.status, 200, 'an account from before R3 must still sign in');
    assert.equal((await post('/api/auth/verify-email/resend', { email: 'legacy@fixture.invalid', password: PASSWORD })).status, 202);
    const confirming = holdAfterCommit(/INSERT INTO native_email_identities[\s\S]*'verified'/);
    const confirmation = Promise.allSettled([post('/api/auth/verify-email',
      { email: 'legacy@fixture.invalid', password: PASSWORD, code: codeFor('legacy@fixture.invalid') })]);
    await reach(confirming);
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_identities
      WHERE user_id = $1 AND status = 'verified'`, [legacyId]), 1, 'the confirmation must have committed');
    assert.equal(await version(legacyId), 1);
    const changed = await call('PUT', '/api/auth/me', { currentPassword: PASSWORD, password: CHANGED_PASSWORD }, before.body.accessToken);
    assert.equal(changed.status, 200, 'the password change must go through');
    assert.equal(await version(legacyId), 2);
    assert.equal((await call('GET', '/api/auth/me', undefined, before.body.accessToken)).status, 401);
    confirming.release();
    const [late] = await confirmation;
    assert.equal(late.status, 'fulfilled');
    assert.equal(late.value.status, 200);
    assert.equal((await call('GET', '/api/auth/me', undefined, late.value.body.accessToken)).status, 401,
      'a session signed from the old password must not outlive the password change');
    assert.equal((await post('/api/auth/refresh', { refreshToken: late.value.body.refreshToken })).status, 401,
      'a refresh token signed from the old password must not outlive the password change');
    contracts.push('confirmation paused after COMMIT while the password changed: its access and refresh tokens are refused');

    // The same for the session a password change hands back: it carries the
    // version the change set, so a logout after that COMMIT revokes it too.
    const current = await post('/api/auth/login', { email: 'legacy@fixture.invalid', password: CHANGED_PASSWORD });
    assert.equal(current.status, 200);
    const saving = holdAfterCommit(/token_version = token_version \+ 1/);
    const save = Promise.allSettled([call('PUT', '/api/auth/me',
      { currentPassword: CHANGED_PASSWORD, password: THIRD_PASSWORD }, current.body.accessToken)]);
    await reach(saving);
    assert.equal(await version(legacyId), 3, 'the password change must have committed');
    const elsewhere = await post('/api/auth/login', { email: 'legacy@fixture.invalid', password: THIRD_PASSWORD });
    assert.equal(elsewhere.status, 200);
    assert.equal((await call('POST', '/api/auth/logout', {}, elsewhere.body.accessToken)).status, 200);
    assert.equal(await version(legacyId), 4);
    saving.release();
    const [saved] = await save;
    assert.equal(saved.status, 'fulfilled');
    assert.equal(saved.value.status, 200);
    assert.equal((await call('GET', '/api/auth/me', undefined, saved.value.body.accessToken)).status, 401,
      'a session from a password change must not outlive a logout after it');
    assert.equal((await post('/api/auth/refresh', { refreshToken: saved.value.body.refreshToken })).status, 401,
      'a refresh token from a password change must not outlive a logout after it');
    contracts.push('password change paused after COMMIT while another device signed everyone out: its tokens are refused');

    // R3-01. A takeover from before R3: a stranger's password on the owner's
    // address, the owner's Google linked to it, the stranger signed in. The
    // owner's next Google sign-in proves the address and takes it back.
    const takenId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('owner@fixture.invalid', $1, 'Stranger') RETURNING id`, [await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
    await control.query(`INSERT INTO r0_fixture.native_auth_providers (user_id, provider_type, provider_user_id, provider_email,
      created_at, updated_at) VALUES ($1, 'google', 'google-owner', 'owner@fixture.invalid', NOW(), NOW())`, [takenId]);
    const stranger = await post('/api/auth/login', { email: 'owner@fixture.invalid', password: PASSWORD });
    assert.equal(stranger.status, 200);
    const owner = await google('google-owner', 'Owner@Fixture.invalid');
    assert.equal(owner.user.id, takenId);
    assert.equal(owner.passwordRevoked, true, 'the provider proving the address must revoke the unproven password');
    assert.equal((await call('GET', '/api/auth/me', undefined, stranger.body.accessToken)).status, 401,
      "the stranger's access token must be revoked");
    assert.equal((await post('/api/auth/refresh', { refreshToken: stranger.body.refreshToken })).status, 401,
      "the stranger's refresh token must be revoked");
    assert.equal((await post('/api/auth/login', { email: 'owner@fixture.invalid', password: PASSWORD })).status, 401);
    assert.equal((await call('GET', '/api/auth/me', undefined,
      generateTokens(owner.user.id, owner.user.token_version).accessToken)).status, 200);
    assert.deepEqual(await accounts('owner@fixture.invalid'),
      [{ id: takenId, password_hash: null, status: 'verified', verified_by: 'google', live_codes: 0 }]);
    contracts.push("Google linked before R3 proves the address: the stranger's password, access and refresh are refused");

    // Two first sign-ins of one Google account at once. The first waits at
    // the held identity table, the second at the first's new user; released,
    // the second meets the unique key, starts over and finds the first.
    await holdIdentities();
    const firsts = await barrier([google('google-new', 'new@fixture.invalid'), google('google-new', 'new@fixture.invalid')])
      .catch((error) => assert.fail(`two first sign-ins of one person must both sign in: ${error.message}`));
    assert.equal(firsts[0].user.id, firsts[1].user.id, 'two first sign-ins of one person must end in one account');
    assert.equal(await count("SELECT count(*) FROM r0_fixture.native_users WHERE email = 'new@fixture.invalid'"), 1);
    assert.equal(await count("SELECT count(*) FROM r0_fixture.native_auth_providers WHERE provider_user_id = 'google-new'"), 1);
    contracts.push('two first Google sign-ins of one person, both seen waiting: one account, one link, both signed in');

    // A registration and a Google sign-in of one address, in both orders.
    // Registration first: its pending account is taken back by the proof.
    await holdIdentities();
    const [registered, proven] = await inOrder([() => register('first@fixture.invalid'),
      () => google('google-first', 'first@fixture.invalid')]);
    assert.equal(registered.status, 201);
    assert.equal(proven.passwordRevoked, true, 'Google after a pending registration must revoke its password');
    assert.deepEqual((await accounts('first@fixture.invalid')).map(({ id, ...rest }) => rest),
      [{ password_hash: null, status: 'verified', verified_by: 'google', live_codes: 0 }]);
    // Google first: the registration finds the address taken.
    await holdIdentities();
    const [created, refused] = await inOrder([() => google('google-second', 'second@fixture.invalid'),
      () => register('second@fixture.invalid')]);
    assert.equal(created.isNewUser, true);
    assert.equal(refused.status, 409, 'a registration after a Google sign-in of the address must be refused');
    assert.deepEqual((await accounts('second@fixture.invalid')).map(({ id, ...rest }) => rest),
      [{ password_hash: null, status: 'verified', verified_by: 'google', live_codes: 0 }]);
    contracts.push('registration against a Google sign-in of one address, each order forced: one verified account, no password');

    // The address moves while the sign-in waits for the account's lock: the
    // proof no longer names that account, so it is not joined.
    const movingId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('moving@fixture.invalid', NULL, 'Moving') RETURNING id`)).rows[0].id;
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [movingId]);
    const moving = Promise.allSettled([google('google-moving', 'moving@fixture.invalid')]);
    try { await eventually(async () => (await waitingOnLocks()) === 1); }
    catch (error) { await control.query('ROLLBACK'); await moving; throw error; }
    await control.query("UPDATE r0_fixture.native_users SET email = 'relocated@fixture.invalid' WHERE id = $1", [movingId]);
    await control.query('COMMIT');
    const [arrived] = await moving;
    assert.equal(arrived.status, 'fulfilled');
    assert.notEqual(arrived.value.user.id, movingId, 'an account whose address moved must not be joined');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_auth_providers WHERE user_id = $1`, [movingId]), 0);
    contracts.push('address changed while a Google sign-in waited on its lock: the moved account is not joined');

    // A link removed while the sign-in waits for the account's lock: under the
    // lock the link is read again, the attempt starts over and links afresh,
    // as a sign-in after the unlink would — not through a link that is gone.
    const unlinked = await google('google-unlinked', 'unlinked@fixture.invalid');
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [unlinked.user.id]);
    const relinking = Promise.allSettled([google('google-unlinked', 'unlinked@fixture.invalid')]);
    try { await eventually(async () => (await waitingOnLocks()) === 1); }
    catch (error) { await control.query('ROLLBACK'); await relinking; throw error; }
    await control.query("DELETE FROM r0_fixture.native_auth_providers WHERE provider_user_id = 'google-unlinked'");
    await control.query('COMMIT');
    const [relinked] = await relinking;
    assert.equal(relinked.status, 'fulfilled');
    assert.equal(relinked.value.user.id, unlinked.user.id);
    assert.equal(relinked.value.linked, true, 'a sign-in through a link removed meanwhile must link afresh');
    assert.equal(await count("SELECT count(*) FROM r0_fixture.native_auth_providers WHERE provider_user_id = 'google-unlinked'"), 1);
    contracts.push('link removed while a Google sign-in waited on its lock: the sign-in starts over and links afresh');

    // R3-09. A request of the stranger's session is admitted by the middleware
    // before the owner's Google sign-in revokes it, and waits for the account's
    // row behind that sign-in. Under the lock it must find itself revoked.
    const strangerAccount = async (email, subject, { apple = false } = {}) => {
      const id = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
        VALUES ($1, $2, 'Stranger') RETURNING id`, [email, await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
      await control.query(`INSERT INTO r0_fixture.native_auth_providers (user_id, provider_type, provider_user_id,
        provider_email, created_at, updated_at) VALUES ($1, 'google', $2, $3, NOW(), NOW())`, [id, subject, email]);
      if (apple) {
        await control.query(`INSERT INTO r0_fixture.native_auth_providers (user_id, provider_type, provider_user_id,
          provider_email, created_at, updated_at) VALUES ($1, 'apple', $2, $3, NOW(), NOW())`, [id, `${subject}-apple`, email]);
      }
      const session = await post('/api/auth/login', { email, password: PASSWORD });
      assert.equal(session.status, 200);
      return { id, session: session.body };
    };
    const behindSignIn = async (id, subject, email, request) => {
      await control.query('BEGIN');
      await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [id]);
      const [owner, response] = await inOrder([() => google(subject, email), request]);
      assert.equal(owner.passwordRevoked, true);
      const ownerToken = generateTokens(owner.user.id, owner.user.token_version).accessToken;
      return { owner, ownerToken, response };
    };
    const ownerStillIn = async (token) => (await call('GET', '/api/auth/me', undefined, token)).status;

    const first = await strangerAccount('first-password@fixture.invalid', 'google-first-password');
    const setting = await behindSignIn(first.id, 'google-first-password', 'first-password@fixture.invalid',
      () => call('PUT', '/api/auth/me', { password: CHANGED_PASSWORD }, first.session.accessToken));
    assert.equal(setting.response.status, 401, 'a request admitted before the revocation must not set a password');
    assert.equal((await control.query('SELECT password_hash FROM r0_fixture.native_users WHERE id = $1', [first.id])).rows[0].password_hash, null);
    assert.equal(await version(first.id), 2);
    assert.equal(await ownerStillIn(setting.ownerToken), 200);
    assert.equal((await post('/api/auth/login', { email: 'first-password@fixture.invalid', password: CHANGED_PASSWORD })).status, 401);
    contracts.push("stranger's PUT /me queued behind the owner's Google sign-in: 401, no password, the owner stays signed in");

    const doomed = await strangerAccount('delete-me@fixture.invalid', 'google-delete-me');
    const deleting = await behindSignIn(doomed.id, 'google-delete-me', 'delete-me@fixture.invalid',
      () => call('DELETE', '/api/auth/me', undefined, doomed.session.accessToken));
    assert.equal(deleting.response.status, 401, 'a request admitted before the revocation must not delete the account');
    assert.equal(await count('SELECT count(*) FROM r0_fixture.native_users WHERE id = $1', [doomed.id]), 1);
    assert.equal(await ownerStillIn(deleting.ownerToken), 200);
    contracts.push("stranger's DELETE /me queued behind the owner's Google sign-in: 401, the account stays");

    const leaving = await strangerAccount('logout@fixture.invalid', 'google-logout');
    const loggingOut = await behindSignIn(leaving.id, 'google-logout', 'logout@fixture.invalid',
      () => call('POST', '/api/auth/logout', {}, leaving.session.accessToken));
    assert.equal(loggingOut.response.status, 200);
    assert.equal(await version(leaving.id), 2, 'a logout admitted before the revocation must not bump the version again');
    assert.equal(await ownerStillIn(loggingOut.ownerToken), 200, 'a logout admitted before the revocation must not sign the owner out');
    contracts.push("stranger's logout queued behind the owner's Google sign-in: no second bump, the owner stays signed in");

    const linkedTwice = await strangerAccount('unlink@fixture.invalid', 'google-unlink', { apple: true });
    const unlinking = await behindSignIn(linkedTwice.id, 'google-unlink', 'unlink@fixture.invalid',
      () => call('DELETE', '/api/auth/me/providers/apple', undefined, linkedTwice.session.accessToken));
    assert.equal(unlinking.response.status, 401, 'an unlink admitted before the revocation must not remove a link');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_auth_providers
      WHERE user_id = $1 AND provider_type = 'apple'`, [linkedTwice.id]), 1);
    contracts.push("stranger's unlink queued behind the owner's Google sign-in: 401, the link stays");

    // The other order: the stranger's password change goes first and wins its
    // new pair; the owner's sign-in right behind it revokes that pair as well.
    const changing = await strangerAccount('change-first@fixture.invalid', 'google-change-first');
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [changing.id]);
    const [changed2, reclaimed] = await inOrder([
      () => call('PUT', '/api/auth/me', { currentPassword: PASSWORD, password: CHANGED_PASSWORD }, changing.session.accessToken),
      () => google('google-change-first', 'change-first@fixture.invalid')]);
    assert.equal(changed2.status, 200);
    assert.equal(reclaimed.passwordRevoked, true, 'a password changed just before the sign-in must be revoked too');
    assert.equal((await call('GET', '/api/auth/me', undefined, changed2.body.accessToken)).status, 401);
    assert.equal((await post('/api/auth/refresh', { refreshToken: changed2.body.refreshToken })).status, 401);
    assert.equal((await post('/api/auth/login', { email: 'change-first@fixture.invalid', password: CHANGED_PASSWORD })).status, 401);
    contracts.push("stranger's password change just before the owner's Google sign-in: the new pair and password are revoked");

    // The stranger removes their own password first (Codex, on b8a86fc): the
    // proof still revokes every session, with no password left to take.
    const unlinkedFirst = await strangerAccount('no-password@fixture.invalid', 'google-no-password');
    await control.query(`INSERT INTO r0_fixture.native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at)
      VALUES ($1, 'email', 'no-password@fixture.invalid', NOW(), NOW())`, [unlinkedFirst.id]);
    assert.equal((await call('DELETE', '/api/auth/me/providers/email', undefined, unlinkedFirst.session.accessToken)).status, 200);
    const cleared = await google('google-no-password', 'no-password@fixture.invalid');
    assert.equal(cleared.passwordRevoked, false);
    assert.equal((await call('GET', '/api/auth/me', undefined, unlinkedFirst.session.accessToken)).status, 401,
      'a session must not outlive the proof because its password was removed first');
    assert.equal((await post('/api/auth/refresh', { refreshToken: unlinkedFirst.session.refreshToken })).status, 401);
    contracts.push("stranger unlinks their password, then the owner's Google proof: the stranger's access and refresh are refused");

    // R3-12. The stranger's phone registered on the account, and one queued
    // behind the owner's sign-in: after the proof neither receives its pushes.
    const phone = (name) => ({ deviceToken: `ExponentPushToken[r3-${name}]`, deviceType: 'ios' });
    const devices = async (id) => count('SELECT count(*) FROM r0_fixture.native_push_tokens WHERE user_id = $1', [id]);
    const withPhone = await strangerAccount('phone@fixture.invalid', 'google-phone');
    assert.equal((await call('POST', '/api/native/push-tokens', phone('before'), withPhone.session.accessToken)).status, 200);
    assert.equal(await devices(withPhone.id), 1);
    await google('google-phone', 'phone@fixture.invalid');
    assert.equal(await devices(withPhone.id), 0, "the proof must take the stranger's devices off the account");
    const queuedPhone = await strangerAccount('queued-phone@fixture.invalid', 'google-queued-phone');
    const registering = await behindSignIn(queuedPhone.id, 'google-queued-phone', 'queued-phone@fixture.invalid',
      () => call('POST', '/api/native/push-tokens', phone('queued'), queuedPhone.session.accessToken));
    assert.equal(registering.response.status, 401, 'a device registration admitted before the revocation must not add a device');
    assert.equal(await devices(queuedPhone.id), 0);
    contracts.push("stranger's device registered before, or queued behind, the owner's Google sign-in: no device left on the account");

    // R3-14. DELETE /me holds its user row while it waits for busy slots a
    // rehearsal rebuild has deleted; the rebuild then inserts a slot for the
    // same person, whose foreign key needs a share lock on that row. With
    // FOR UPDATE that was a deadlock and the account stayed.
    const leaverId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('leaver@fixture.invalid', $1, 'Leaver') RETURNING id`, [await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
    const projectId = (await control.query("INSERT INTO r0_fixture.native_projects (name) VALUES ('Leaving') RETURNING id")).rows[0].id;
    await control.query(`INSERT INTO r0_fixture.native_project_members (user_id, project_id, role, status)
      VALUES ($1, $2, 'owner', 'active')`, [leaverId, projectId]);
    const rehearsalId = (await control.query(`INSERT INTO r0_fixture.native_rehearsals (project_id, starts_at, ends_at)
      VALUES ($1, '2031-04-01T10:00:00Z', '2031-04-01T12:00:00Z') RETURNING id`, [projectId])).rows[0].id;
    const slot = `INSERT INTO r0_fixture.native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
      VALUES ($1, '2031-04-01T10:00:00Z', '2031-04-01T12:00:00Z', 'busy', 'rehearsal', $2)`;
    await control.query(slot, [leaverId, String(rehearsalId)]);
    const leaver = await post('/api/auth/login', { email: 'leaver@fixture.invalid', password: PASSWORD });
    assert.equal(leaver.status, 200);
    await control.query('BEGIN');
    await control.query(`DELETE FROM r0_fixture.native_user_availability WHERE source = 'rehearsal' AND external_event_id = $1`,
      [String(rehearsalId)]);
    const deletion = Promise.allSettled([call('DELETE', '/api/auth/me', undefined, leaver.body.accessToken)]);
    let rebuilt;
    try {
      await eventually(async () => (await waitingOnLocks()) === 1);
      rebuilt = await control.query(slot, [leaverId, String(rehearsalId)]).then(() => 'inserted', (error) => error.code);
      await control.query(rebuilt === 'inserted' ? 'COMMIT' : 'ROLLBACK');
    } catch (error) { await control.query('ROLLBACK').catch(() => {}); await deletion; throw error; }
    const [left] = await deletion;
    assert.equal(rebuilt, 'inserted', 'a rehearsal rebuild and DELETE /me must not deadlock');
    assert.equal(left.status, 'fulfilled');
    assert.equal(left.value.status, 200, 'DELETE /me must go through once the rebuild commits');
    assert.equal(await count('SELECT count(*) FROM r0_fixture.native_users WHERE id = $1', [leaverId]), 0);
    contracts.push('DELETE /me waiting on slots a rehearsal rebuild deleted, the rebuild inserting a slot for the same person: no deadlock, account deleted');

    // Password reset. The request answers alike with and without an account;
    // the confirmation proves the mailbox and takes everything from before.
    const RESET_PASSWORD = 'r3-auth-fixture-reset';
    const forgotten = await strangerAccount('reset@fixture.invalid', 'google-reset');
    assert.equal((await call('POST', '/api/native/push-tokens', phone('reset'), forgotten.session.accessToken)).status, 200);
    const asked = await post('/api/auth/password-reset/request', { email: 'Reset@Fixture.invalid' });
    const unknownAsked = await post('/api/auth/password-reset/request', { email: 'nobody-reset@fixture.invalid' });
    assert.equal(asked.status, 202);
    assert.deepEqual(unknownAsked.body, asked.body, 'a reset request must answer alike with and without an account');
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_email_codes
      WHERE user_id = $1 AND purpose = 'reset' AND consumed_at IS NULL`, [forgotten.id]), 1);
    const resetCode = codeFor('reset@fixture.invalid');
    // Two confirmations with that one code at once, both held at the user row.
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [forgotten.id]);
    const resets = await barrier([0, 1].map(() => post('/api/auth/password-reset/confirm',
      { email: 'reset@fixture.invalid', code: resetCode, newPassword: RESET_PASSWORD })));
    assert.deepEqual(resets.map((response) => response.status).sort(), [200, 400], 'one code must reset once');
    assert.equal(resets.find((response) => response.status === 400).body.code, 'CODE_MISSING');
    assert.equal((await call('GET', '/api/auth/me', undefined, forgotten.session.accessToken)).status, 401,
      "a reset must revoke the stranger's session");
    assert.equal((await post('/api/auth/refresh', { refreshToken: forgotten.session.refreshToken })).status, 401);
    assert.equal((await post('/api/auth/login', { email: 'reset@fixture.invalid', password: PASSWORD })).status, 401);
    assert.equal((await post('/api/auth/login', { email: 'reset@fixture.invalid', password: RESET_PASSWORD })).status, 200);
    assert.equal(await devices(forgotten.id), 0, "a reset must take the stranger's devices off the account");
    assert.deepEqual((await accounts('reset@fixture.invalid')).map(({ id, password_hash: hash, ...rest }) => rest),
      [{ status: 'verified', verified_by: 'code', live_codes: 0 }]);
    assert.equal(await count(`SELECT count(*) FROM r0_fixture.native_auth_providers
      WHERE user_id = $1 AND provider_type = 'email'`, [forgotten.id]), 1);
    contracts.push("password reset: request alike with and without an account; two confirmations with one code at once, one succeeds; the stranger's sessions, password and devices are gone, the address verified");

    // Email change (HP01). Two confirmations of one change at once: the first
    // moves the account and revokes the other sessions, the second — its
    // session among them — finds that under the lock.
    const moverId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('mover@fixture.invalid', $1, 'Mover') RETURNING id`, [await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
    const mover = await post('/api/auth/login', { email: 'mover@fixture.invalid', password: PASSWORD });
    assert.equal(mover.status, 200);
    const moveAsked = await call('POST', '/api/auth/me/email/change',
      { newEmail: 'moved-to@fixture.invalid', currentPassword: PASSWORD }, mover.body.accessToken);
    assert.equal(moveAsked.status, 202);
    const moveCode = codeFor('moved-to@fixture.invalid');
    await control.query('BEGIN');
    await control.query('SELECT id FROM r0_fixture.native_users WHERE id = $1 FOR UPDATE', [moverId]);
    const moves = await barrier([0, 1].map(() =>
      call('POST', '/api/auth/me/email/change/confirm', { code: moveCode }, mover.body.accessToken)));
    assert.deepEqual(moves.map((response) => response.status).sort(), [200, 401], 'one change must move the account once');
    assert.equal((await control.query('SELECT email FROM r0_fixture.native_users WHERE id = $1', [moverId])).rows[0].email,
      'moved-to@fixture.invalid');
    const moved = moves.find((response) => response.status === 200);
    assert.equal((await call('GET', '/api/auth/me', undefined, moved.body.accessToken)).status, 200);
    assert.equal((await call('GET', '/api/auth/me', undefined, mover.body.accessToken)).status, 401);
    assert.deepEqual((await accounts('moved-to@fixture.invalid')).map(({ id, password_hash: hash, ...rest }) => rest),
      [{ status: 'verified', verified_by: 'code', live_codes: 0 }]);
    contracts.push('two confirmations of one email change at once: one moves the account, the other is refused as a revoked session');

    // A registration of the new address while the change waits for it: the
    // registration holds the address first, the change meets the unique key.
    // The registration is held at its sign-in method row (a share lock on that
    // table), which the change does not touch before it moves the address — not
    // at the identity table, which the auth middleware reads, or the change
    // would wait in the middleware and find the address by its explicit check.
    const racerId = (await control.query(`INSERT INTO r0_fixture.native_users (email, password_hash, first_name)
      VALUES ('racer@fixture.invalid', $1, 'Racer') RETURNING id`, [await bcrypt.hash(PASSWORD, 4)])).rows[0].id;
    const racer = await post('/api/auth/login', { email: 'racer@fixture.invalid', password: PASSWORD });
    assert.equal((await call('POST', '/api/auth/me/email/change',
      { newEmail: 'contested-address@fixture.invalid', currentPassword: PASSWORD }, racer.body.accessToken)).status, 202);
    const raceCode = codeFor('contested-address@fixture.invalid');
    await control.query('BEGIN');
    await control.query('LOCK TABLE r0_fixture.native_auth_providers IN SHARE MODE');
    const [taken, lost] = await inOrder([() => register('contested-address@fixture.invalid'),
      () => call('POST', '/api/auth/me/email/change/confirm', { code: raceCode }, racer.body.accessToken)]);
    assert.equal(taken.status, 201);
    assert.equal(lost.status, 409, 'a change to an address registered meanwhile must be refused');
    assert.equal(lost.body.code, 'EMAIL_TAKEN');
    assert.equal((await control.query('SELECT email FROM r0_fixture.native_users WHERE id = $1', [racerId])).rows[0].email,
      'racer@fixture.invalid');
    contracts.push('registration of the new address while the change waited on it: 409, the old address kept');
  } finally {
    adapter.transaction = transaction;
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
