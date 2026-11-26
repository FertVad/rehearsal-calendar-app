import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, symlink, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCLI } from '../../database/migrations/cli.mjs';
import { manifest, inspectSchema } from '../../database/schema/manifest.mjs';
import { dateIn, addDays } from '../../utils/dateIn.js';

// Migration 017 on production's database as it will be (T-406): created by
// 477ea2f's `--fresh` (2026-10-28, root fresh rehearsly-pg-current-v1), then
// 016 applied by T-294's own migrator (b8722df) — each by its own CLI, from
// pinned copies of its code. Then this tree: --dry plans 017 alone, --apply
// applies it, the next --dry is empty, the catalog is this tree's --fresh.
// Then the server on that database: requests at once write each weekend day
// once (the key, not a lookup), and the planner shows a member from
// Asia/Jerusalem busy on Friday and one from Europe/Moscow on Sunday, neither
// of whom read their own availability.
const v1 = 'rehearsly-pg-current-v1';
const current = 'rehearsly-pg-current-v3';
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));

// Each file is `git show <base>:rehearsal-calendar-native/server/<file>`, byte
// for byte (audit/evidence/T-297/extract-fixture.mjs, audit/evidence/T-406/extract-fixture.mjs).
const pinned = Object.freeze({
  '477ea2f': {
    'scripts/migrate.js': '1e5b28837b0b123f4cfec9daa748b676c8ffb802b97ee639bd03f4d3c788e1eb',
    'database/migrations/artifacts.mjs': 'd779dae64754e6a282c729e22d1cbe8e25833edcc253fc58d724cc29c5c8c4ca',
    'database/migrations/cli.mjs': '7bad6917bfb16177141dc807a2f10490981d5779c4776f55cf851c7376c28ca7',
    'database/migrations/core.mjs': '04640211c7ed29c1e538543fe395e02cdceca9c94d914d51da4ab602010a98fe',
    'database/migrations/errors.mjs': 'e6aa24349f9e0ea9294b2aa9be47db5595f839c0243c164c95b91b66b1195c36',
    'database/migrations/history.mjs': 'd9879c6104c22b3030949e202bbc8e83e5501db131827c8ffa16919c1b26a9ba',
    'database/migrations/sql.mjs': 'ba70bf8dacc846ff23cef26f3b1853677ffd279dff7aa700644b06bc3c13e578',
    'database/schema/manifest.mjs': '57497bde1283a48e5a69cc66110e8fd266d4f0d7c7d9d60faf26a44aaf34cba7',
  },
  b8722df: {
    'scripts/migrate.js': '1e5b28837b0b123f4cfec9daa748b676c8ffb802b97ee639bd03f4d3c788e1eb',
    'database/migrations/artifacts.mjs': 'a692c31a4ada64c495b83dc873293559b8aecf6579e93f8815f36dbd9a56da1e',
    'database/migrations/cli.mjs': '7bad6917bfb16177141dc807a2f10490981d5779c4776f55cf851c7376c28ca7',
    'database/migrations/core.mjs': '04640211c7ed29c1e538543fe395e02cdceca9c94d914d51da4ab602010a98fe',
    'database/migrations/errors.mjs': 'e6aa24349f9e0ea9294b2aa9be47db5595f839c0243c164c95b91b66b1195c36',
    'database/migrations/history.mjs': 'd9879c6104c22b3030949e202bbc8e83e5501db131827c8ffa16919c1b26a9ba',
    'database/migrations/sql.mjs': 'ba70bf8dacc846ff23cef26f3b1853677ffd279dff7aa700644b06bc3c13e578',
    'database/schema/manifest.mjs': 'edc9ae532aa4e20de93587dc39de84ca3c8ab188529801e5b15beea9d7a43a70',
  },
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * A release's migrator in a temporary directory: its pinned code, and the
 * artifacts its manifest names, taken from this tree — those never change
 * (database/schema/README.md); each must have the hash the manifest pins.
 */
async function releaseMigrator(base) {
  const fixture = await realpath(await mkdtemp(path.join(tmpdir(), `t406-migrator-${base}-`)));
  const code = fileURLToPath(new URL(`./fixtures/migrator-${base}/`, import.meta.url));
  const copy = async (from, file, expected) => {
    const bytes = await readFile(path.join(from, file));
    assert.equal(sha256(bytes), expected, `${file} is not ${base}'s`);
    const target = path.join(fixture, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  };
  for (const [file, expected] of Object.entries(pinned[base])) await copy(code, file, expected);
  const named = [...(await readFile(path.join(fixture, 'database/schema/manifest.mjs'), 'utf8'))
    .matchAll(/"file": "([^"]+)",\s*"sha256": "([0-9a-f]{64})"/g)].map(([, file, hash]) => [file, hash]);
  for (const [file, expected] of new Map(named)) await copy(serverRoot, file, expected);
  await writeFile(path.join(fixture, 'package.json'), '{"type":"module"}');
  await symlink(path.join(serverRoot, 'node_modules'), path.join(fixture, 'node_modules'));
  return fixture;
}

export async function probeT406Upgrade({ connectionString, control, allowedPorts }) {
  const contracts = [];
  const q = async (sql, params) => (await control.query(sql, params)).rows;
  const history = (schema) => q(`SELECT to_jsonb(h) AS row FROM ${schema}.native_schema_history h ORDER BY ordinal`);
  const newCLI = async (mode, schema = 'r0_fixture') => {
    const out = [];
    const code = await runCLI({ argv: [mode], env: { DATABASE_URL: connectionString, MIGRATION_SCHEMA: schema },
      emit: (value) => out.push(value) });
    assert.equal(out.length, 1);
    return { code, ...out[0] };
  };
  const fixtures = { '477ea2f': await releaseMigrator('477ea2f'), b8722df: await releaseMigrator('b8722df') };
  const freshSchema = 't406_fresh';
  try {
    for (const fixture of Object.values(fixtures)) {
      await writeFile(path.join(fixture, 'synthetic-environment.txt'), `DATABASE_URL=${connectionString}\nMIGRATION_SCHEMA=r0_fixture\n`);
    }
    const releaseCLI = async (base, mode) => {
      const fixture = fixtures[base];
      const child = spawnSync(process.execPath, [path.join(fixture, 'scripts/migrate.js'), mode], {
        cwd: fixture, encoding: 'utf8', timeout: 30000,
        env: { PATH: '/usr/bin:/bin', SERVER_ENV_FILE: path.join(fixture, 'synthetic-environment.txt') } });
      assert.ifError(child.error);
      assert.equal(child.stderr, '');
      return { status: child.status, ...JSON.parse(child.stdout.trim()) };
    };
    const productionBudgets = ['007', '008', '009', '010', '011', '012', '013'];

    // 1. Production's database: 477ea2f's --fresh, then 016 by T-294's release.
    assert.equal((await releaseCLI('477ea2f', '--fresh')).rootId, v1);
    assert.deepEqual(await releaseCLI('b8722df', '--apply'), { status: 0, type: 'result', mode: 'apply', outcome: 'applied',
      state: 'managed', rootId: v1, stepIds: ['016-usage-statistics'] });
    assert.deepEqual((await releaseCLI('b8722df', '--dry')).stepIds, []);
    const recorded = await history('r0_fixture');
    assert.deepEqual(recorded.map(({ row }) => [row.ordinal, row.id, row.kind]), [[0, v1, 'fresh'], [1, '016-usage-statistics', 'migration']]);
    contracts.push('477ea2f\'s --fresh, then b8722df\'s --apply: root fresh v1 and 016, as production after T-294');

    // 2. This tree: --dry plans 017 alone and changes nothing.
    assert.deepEqual(await newCLI('--dry'), { code: 0, type: 'result', mode: 'dry', outcome: 'planned', state: 'managed',
      rootId: v1, stepIds: ['017-weekend-defaults'], eligibleActions: ['apply'],
      frontier: { domain: 'v1', availabilityConflictKey: true, budgets: [...productionBudgets, '016', '017'] } });
    assert.deepEqual(await history('r0_fixture'), recorded);
    contracts.push('this tree\'s --dry on it: managed, root v1, plans 017-weekend-defaults alone, writes nothing');

    // 3. --apply applies 017 after the untouched rows; the next --dry is empty.
    assert.deepEqual(await newCLI('--apply'), { code: 0, type: 'result', mode: 'apply', outcome: 'applied',
      state: 'managed', rootId: v1, stepIds: ['017-weekend-defaults'] });
    const after = await history('r0_fixture');
    assert.deepEqual(after.slice(0, 2), recorded, 'the root and 016 stay as recorded');
    assert.deepEqual(after.slice(2).map(({ row }) => [row.ordinal, row.id, row.kind]), [[2, '017-weekend-defaults', 'migration']]);
    assert.deepEqual((await newCLI('--dry')).stepIds, []);
    assert.equal((await newCLI('--apply')).outcome, 'unchanged');
    await control.query(`CREATE SCHEMA ${freshSchema}`);
    assert.deepEqual(await newCLI('--fresh', freshSchema), { code: 0, type: 'result', mode: 'fresh', outcome: 'applied',
      state: 'managed', rootId: current, stepIds: [] });
    const upgraded = await inspectSchema(control.query.bind(control), { schema: 'r0_fixture', profile: current });
    const fresh = await inspectSchema(control.query.bind(control), { schema: freshSchema, profile: current });
    assert.equal(upgraded.compatible, true, JSON.stringify(upgraded.issues));
    assert.equal(upgraded.evidenceSha256, fresh.evidenceSha256, 'the upgraded catalog is the fresh catalog');
    assert.equal(manifest.currentProfile, current);
    contracts.push('--apply: 017 recorded after them; the next --dry plans nothing; the catalog equals this tree\'s --fresh (v3)');

    // 4. The server on the upgraded database.
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
    const get = (userId, pathname) => new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method: 'GET', path: pathname,
        headers: { Connection: 'close', Authorization: `Bearer ${generateTokens(userId, 1).accessToken}` } }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.once('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null }));
      });
      req.once('error', reject);
      req.end();
    });
    try {
      const [{ id: israel }] = await q("INSERT INTO r0_fixture.native_users (email, first_name, timezone) VALUES ('t406-il@example.test', 'Dana', 'Asia/Jerusalem') RETURNING id");
      const [{ id: russia }] = await q("INSERT INTO r0_fixture.native_users (email, first_name, timezone) VALUES ('t406-ru@example.test', 'Oleg', 'Europe/Moscow') RETURNING id");
      assert.deepEqual(await q('SELECT weekends_busy FROM r0_fixture.native_users WHERE id = ANY($1::int[])', [[israel, russia]]),
        [{ weekends_busy: true }, { weekends_busy: true }]);
      const [{ id: project }] = await q("INSERT INTO r0_fixture.native_projects (name) VALUES ('T-406') RETURNING id");
      await q(`INSERT INTO r0_fixture.native_project_members (project_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active'), ($1, $3, 'member', 'active')`, [project, russia, israel]);

      const after1 = (zone, weekday) => {
        let date = addDays(dateIn(Date.now(), zone), 1);
        while (((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1 !== weekday) date = addDays(date, 1);
        return date;
      };
      const friday = after1('Asia/Jerusalem', 5);
      const sunday = after1('Europe/Moscow', 7);
      const [first, last] = [friday, sunday].sort();
      const planner = `/api/native/projects/${project}/members/availability?startDate=${first}&endDate=${last}`;

      // Neither has read their own availability: the planners and the
      // person's own reads race to lay the weekends out.
      const answers = await Promise.all([
        ...Array.from({ length: 6 }, () => get(israel, '/api/native/availability')),
        ...Array.from({ length: 3 }, () => get(russia, planner)),
      ]);
      assert.deepEqual([...new Set(answers.map((answer) => answer.status))], [200]);
      const duplicates = await q(`SELECT user_id, starts_at, count(*) FROM r0_fixture.native_user_availability
        WHERE source = 'weekend' GROUP BY user_id, starts_at HAVING count(*) > 1`);
      assert.deepEqual(duplicates, []);
      const days = await q(`SELECT user_id, count(*)::int AS n, min(to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')) AS first
        FROM r0_fixture.native_user_availability WHERE source = 'weekend' GROUP BY user_id ORDER BY user_id`);
      assert.equal(days.length, 2);
      for (const row of days) assert.ok(row.n >= 104 && row.n <= 106, JSON.stringify(row));
      contracts.push('six reads and three planners at once: every weekend day of both written once, a year ahead');

      const shown = (await get(russia, planner)).body.availability;
      const on = (userId, date) => shown.find((a) => Number(a.userId) === userId).dates.find((d) => d.date === date)?.timeRanges;
      assert.deepEqual(on(israel, friday), [{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }]);
      assert.deepEqual(on(russia, sunday), [{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }]);
      assert.equal(on(israel, sunday), undefined);
      assert.equal(on(russia, friday), undefined);
      contracts.push('the planner: the member from Asia/Jerusalem busy all Friday, the one from Europe/Moscow all Sunday');

      const through = await q("SELECT CAST(weekends_through AS TEXT) AS through, weekends_days FROM r0_fixture.native_users WHERE id = $1", [israel]);
      assert.equal(through[0].through, addDays(dateIn(Date.now(), 'Asia/Jerusalem'), 365));
      assert.equal(through[0].weekends_days, '5,6');
      contracts.push('weekends_through reads back as the date a year on, weekends_days as 5,6');
    } finally {
      await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
      await database.closeDatabase();
    }
  } finally {
    await control.query(`DROP SCHEMA IF EXISTS ${freshSchema} CASCADE`);
    for (const fixture of Object.values(fixtures)) await rm(fixture, { recursive: true, force: true });
  }
  return { outcome: 'PASS', contracts };
}
