import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';
import { dateIn } from '../../utils/dateIn.js';

// Use of the app and invitation counts on PostgreSQL (T-294): migration 016's
// tables from the canonical schema, the writes through the real app — DATE
// from a text parameter, the upserts, the invitation's INSERT … SELECT, the
// join's savepoint — the admin figures, the 13-month purge, the cascades of an
// account and a project, and the same app with 016's tables gone. The SQLite
// route tests (usageStatistics.test.js, adminUsage.test.js) fix the clock; here
// it is the real one.
export async function probeT294Usage({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  await database.initDatabase({ connectionString });
  const runtime = { ensureInitialized: async () => true, checkReady: async () => true };
  const server = await new Promise((resolve, reject) => {
    const listener = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  const contracts = [];
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  const call = (method, path, { token, body, build, agent } = {}) => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method, path,
      headers: { Connection: 'close', ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(build ? { 'X-App-Build': String(build) } : {}),
        ...(agent ? { 'User-Agent': agent } : {}) } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.once('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* a page */ }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`T-294 ${path} timed out`)));
    req.end(payload);
  });
  const q = async (sql, params) => (await control.query(sql, params)).rows;
  const days = () => q('SELECT user_id, day::text AS day, app_build FROM native_usage_days ORDER BY user_id, day');
  const counts = () => q('SELECT project_id, day::text AS day, page_opens, app_opens, joins FROM native_invite_counts ORDER BY project_id, day');
  const until = async (check) => {
    for (let i = 0; i < 200; i++) { if (await check()) return; await new Promise((r) => setTimeout(r, 10)); }
    throw new Error('T-294: the count did not arrive');
  };
  const token = (id) => generateTokens(id, 1).accessToken;
  const today = () => dateIn(Date.now(), 'UTC');

  try {
    await q(`INSERT INTO native_users (id, email, first_name, timezone, created_at) VALUES
      (1, 'olga@example.test', 'Olga', 'America/Mazatlan', NOW() - INTERVAL '20 days'),
      (2, 'ivan@example.test', 'Ivan', 'Europe/Berlin', NOW() - INTERVAL '10 days'),
      (3, 'anna@example.test', 'Anna', NULL, NOW() - INTERVAL '9 days')`);
    await q("INSERT INTO native_projects (id, name, invite_code) VALUES (1, 'Hamlet', 'ABCDEFGH'), (2, 'Gone', 'HGFEDCBA')");
    await q(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at) VALUES
      (1, 1, 'owner', 'active', NOW()), (1, 2, 'owner', 'active', NOW())`);

    // The day of use, in each person's zone; once a day; the last build.
    assert.equal((await call('GET', '/api/native/projects', { token: token(1), build: 41 })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: token(1), build: 41 })).status, 200);
    assert.equal((await call('GET', '/api/native/projects', { token: token(1), build: 42 })).status, 200);
    assert.equal((await call('GET', '/api/native/projects', { token: token(3) })).status, 200);
    assert.deepEqual(await days(), [
      { user_id: 1, day: dateIn(Date.now(), 'America/Mazatlan'), app_build: 42 },
      { user_id: 3, day: today(), app_build: null }]);
    contracts.push('a session\'s request records the day in the person\'s zone (UTC without one), once, with the last build');

    // Two first requests at once: one row.
    const both = await Promise.all([1, 2, 3, 4].map(() => call('GET', '/api/native/projects', { token: token(2), build: 41 })));
    assert.ok(both.every((response) => response.status === 200));
    assert.deepEqual((await days()).filter((row) => row.user_id === 2), [{ user_id: 2, day: dateIn(Date.now(), 'Europe/Berlin'), app_build: 41 }]);
    contracts.push('concurrent first requests of one person make one row (the key)');

    assert.equal((await call('GET', '/api/native/projects', { token: 'not-a-token' })).status, 401);
    assert.equal((await days()).length, 3);
    contracts.push('a refused session records nothing');

    // A sign-in that revokes sessions holds the person's row FOR UPDATE. The
    // day's write does not wait behind it: the request goes on at once, writes
    // nothing, and the next one writes the day.
    await q("INSERT INTO native_users (id, email, first_name, created_at) VALUES (4, 'lena@example.test', 'Lena', NOW())");
    const holder = new (await import('pg')).default.Client({ connectionString });
    await holder.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM native_users WHERE id = 4 FOR UPDATE');
      const started = Date.now();
      assert.equal((await call('GET', '/api/native/projects', { token: token(4), build: 41 })).status, 200);
      assert.ok(Date.now() - started < 2000, 'the request did not wait for the locked row');
      assert.equal((await days()).filter((row) => row.user_id === 4).length, 0);
    } finally {
      await holder.query('ROLLBACK');
      await holder.end();
    }
    assert.equal((await call('GET', '/api/native/projects', { token: token(4), build: 41 })).status, 200);
    assert.deepEqual((await days()).filter((row) => row.user_id === 4), [{ user_id: 4, day: today(), app_build: 41 }]);
    await q('DELETE FROM native_users WHERE id = 4');
    contracts.push('the day\'s write never waits behind a sign-in holding the person\'s row: the next request writes it');

    // The invitation: page, app, join.
    assert.equal((await call('GET', '/invite/ABCDEFGH', { agent: 'TelegramBot (like TwitterBot)' })).status, 200);
    assert.equal((await call('HEAD', '/invite/ABCDEFGH', { agent: SAFARI })).status, 200);
    assert.equal((await call('GET', '/invite/ZZZZZZZZ', { agent: SAFARI })).status, 200);
    const page = await call('GET', '/invite/ABCDEFGH', { agent: SAFARI });
    assert.equal(page.status, 200);
    await until(async () => (await counts()).length === 1);
    assert.equal((await call('GET', '/api/native/invite/ABCDEFGH')).status, 200);
    assert.equal((await call('POST', '/api/native/invite/ABCDEFGH/join', { token: token(2) })).status, 200);
    assert.equal((await call('POST', '/api/native/invite/ABCDEFGH/join', { token: token(2) })).status, 400);
    assert.deepEqual(await counts(), [{ project_id: 1, day: today(), page_opens: 1, app_opens: 1, joins: 1 }]);
    contracts.push('invitation: a person\'s page view, the app\'s opening and a join count; a preview, HEAD, an unknown code and a repeated join do not');

    // The admin: figures, last day, the purge when it opens.
    await q(`INSERT INTO native_usage_days (user_id, day) VALUES (3, CURRENT_DATE - INTERVAL '14 months')`);
    await q(`INSERT INTO native_invite_counts (project_id, day, page_opens) VALUES (1, CURRENT_DATE - INTERVAL '14 months', 3)`);
    const login = await call('POST', '/admin/api/login', { body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status, 200);
    const admin = login.body.token;
    const analytics = await call('GET', '/admin/api/analytics', { token: admin });
    assert.equal(analytics.status, 200);
    assert.equal(analytics.body.usage.recorded, true);
    assert.deepEqual(analytics.body.usage.active, { day: 3, week: 3, month: 3, of: 3 });
    assert.deepEqual(analytics.body.usage.builds, [{ build: 42, people: 1 }, { build: 41, people: 1 }, { build: null, people: 1 }]);
    assert.deepEqual(analytics.body.usage.invitations, [{ project: 'Hamlet', owner: 'Olga', pageOpens: 1, appOpens: 1, joins: 1 }]);
    assert.equal((await days()).length, 3, 'the 14-month-old day is gone');
    assert.equal((await counts()).length, 1, 'the 14-month-old count is gone');
    const users = await call('GET', '/admin/api/users', { token: admin });
    assert.equal(users.body.appDaysRecorded, true);
    assert.deepEqual(Object.fromEntries(users.body.users.map((user) => [user.email, user.lastAppDay])), {
      'olga@example.test': dateIn(Date.now(), 'America/Mazatlan'), 'ivan@example.test': dateIn(Date.now(), 'Europe/Berlin'),
      'anna@example.test': today() });
    contracts.push('admin: active, builds, invitations and last day on PostgreSQL types; opening it deletes what is past 13 months');

    // Deleting an account deletes its days; deleting a project its counts.
    assert.equal((await call('DELETE', '/api/auth/me', { token: token(3) })).status, 200);
    assert.deepEqual((await days()).map((row) => row.user_id), [1, 2]);
    await q("INSERT INTO native_invite_counts (project_id, day, page_opens) VALUES (2, CURRENT_DATE, 4)");
    assert.equal((await call('DELETE', '/api/native/projects/2', { token: token(1) })).status, 200);
    assert.deepEqual((await counts()).map((row) => row.project_id), [1]);
    contracts.push('the days go with the account, the counts with the project');

    // 016 not applied: the same app, the same answers; the admin says "no data".
    await q('DROP TABLE native_usage_days; DROP TABLE native_invite_counts');
    await q('DELETE FROM native_project_members WHERE user_id = 2');
    // First the join: Ivan's day is already in this instance's memory, so the
    // count is the first write to find 016 missing. It is undone alone by its
    // savepoint — on PostgreSQL a failed statement would otherwise abort the
    // whole transaction, and the join with it.
    assert.equal((await call('POST', '/api/native/invite/ABCDEFGH/join', { token: token(2) })).status, 200);
    assert.equal((await q("SELECT status FROM native_project_members WHERE user_id = 2 AND project_id = 1"))[0].status, 'active');
    assert.equal((await call('GET', '/api/native/projects', { token: token(1), build: 43 })).status, 200);
    assert.equal((await call('GET', '/invite/ABCDEFGH', { agent: SAFARI })).status, 200);
    assert.equal((await call('GET', '/api/native/invite/ABCDEFGH')).status, 200);
    const without = await call('GET', '/admin/api/analytics', { token: admin });
    assert.equal(without.status, 200);
    assert.deepEqual(without.body.usage, { recorded: false });
    const listed = await call('GET', '/admin/api/users', { token: admin });
    assert.equal(listed.body.appDaysRecorded, false);
    contracts.push('without 016: requests, the page and a join work as before; the admin says there is no data');
  } finally {
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
