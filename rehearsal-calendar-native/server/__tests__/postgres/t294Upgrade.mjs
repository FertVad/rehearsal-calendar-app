import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, symlink, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCLI } from '../../database/migrations/cli.mjs';
import { manifest, inspectSchema } from '../../database/schema/manifest.mjs';

// Production's database as it is (T-294): created by `migrate --fresh` of a
// release whose migrator and manifest are those of 477ea2f (8a6dd5e, on
// 2026-10-28), and kept by the migrator since. Here 477ea2f's own CLI, taken
// from git, creates such a database; its history is never touched by hand.
// Then this tree's real CLI: --dry plans 016 alone, --apply applies it, the
// next --dry is clean, and the server records the days. A database created by
// this tree's --fresh is version 2 with all 25 tables.
// On 43b5e86 (016 re-pinned into v1) the first --dry answers HISTORY_INVALID.
const base = '477ea2f';
const v1 = 'rehearsly-pg-current-v1';
const v2 = 'rehearsly-pg-current-v2';
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = path.resolve(serverRoot, '../..');
const prefix = 'rehearsal-calendar-native/server/';

async function baseMigrator() {
  const fixture = await realpath(await mkdtemp(path.join(tmpdir(), 't294-base-migrator-')));
  const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { maxBuffer: 16 * 1024 * 1024 });
  const files = git('ls-tree', '-r', '--name-only', base, '--', `${prefix}database/migrations`, `${prefix}database/schema`,
    `${prefix}database/init-native-schema.sql`, `${prefix}scripts/migrate.js`, `${prefix}migrations`)
    .toString().trim().split('\n');
  assert.ok(files.includes(`${prefix}database/schema/manifest.mjs`) && files.includes(`${prefix}scripts/migrate.js`));
  for (const file of files) {
    const target = path.join(fixture, file.slice(prefix.length));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, git('show', `${base}:${file}`));
  }
  await writeFile(path.join(fixture, 'package.json'), '{"type":"module"}');
  await symlink(path.join(serverRoot, 'node_modules'), path.join(fixture, 'node_modules'));
  return fixture;
}

export async function probeT294Upgrade({ connectionString, control, allowedPorts }) {
  const contracts = [];
  const q = async (sql, params) => (await control.query(sql, params)).rows;
  const history = (schema) => q(`SELECT to_jsonb(h) AS row FROM ${schema}.native_schema_history h ORDER BY ordinal`);
  const tables = async (schema) => (await q(`SELECT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname LIKE 'native\\_%' AND c.relname <> 'native_schema_history'
    ORDER BY c.relname`, [schema])).map((row) => row.relname);
  const newCLI = async (mode, schema = 'r0_fixture') => {
    const out = [];
    const code = await runCLI({ argv: [mode], env: { DATABASE_URL: connectionString, MIGRATION_SCHEMA: schema },
      emit: (value) => out.push(value) });
    assert.equal(out.length, 1);
    return { code, ...out[0] };
  };
  const fixture = await baseMigrator();
  const freshSchema = 't294_fresh_v2';
  try {
    // 1. 477ea2f's CLI creates the database, as production's was.
    const environment = path.join(fixture, 'synthetic-environment.txt');
    await writeFile(environment, `DATABASE_URL=${connectionString}\nMIGRATION_SCHEMA=r0_fixture\n`);
    const oldCLI = (mode) => {
      const child = spawnSync(process.execPath, [path.join(fixture, 'scripts/migrate.js'), mode], {
        cwd: fixture, encoding: 'utf8', timeout: 30000, env: { PATH: '/usr/bin:/bin', SERVER_ENV_FILE: environment } });
      assert.ifError(child.error);
      assert.equal(child.stderr, '');
      return { status: child.status, ...JSON.parse(child.stdout.trim()) };
    };
    assert.equal(oldCLI('--dry').state, 'empty');
    assert.deepEqual(oldCLI('--fresh'), { status: 0, type: 'result', mode: 'fresh', outcome: 'applied',
      state: 'managed', rootId: v1, stepIds: [] });
    const recorded = await history('r0_fixture');
    assert.equal(recorded.length, 1);
    assert.deepEqual({ ...recorded[0].row, recorded_at: undefined }, { ordinal: 0, id: v1, kind: 'fresh',
      artifact_sha256: '48284687247da9559e196a0175f427fd39c997fab04f2356de2f7ab204217cf9',
      descriptor_sha256: '8bf276976bdc5863e45e2dd511cb042e9d2b448402717e1db4e27735f622ca6f',
      frontier: { domain: 'v1', availabilityConflictKey: true, budgets: ['007', '008', '009', '010', '011', '012', '013'] },
      legacy_evidence_sha256: null, recorded_at: undefined });
    // As production's --dry of 16.11 and 20.11: managed, root v1, nothing to do.
    assert.deepEqual(oldCLI('--dry'), { status: 0, type: 'result', mode: 'dry', outcome: 'planned', state: 'managed',
      rootId: v1, stepIds: [], eligibleActions: ['apply'],
      frontier: { domain: 'v1', availabilityConflictKey: true, budgets: ['007', '008', '009', '010', '011', '012', '013'] } });
    assert.equal((await tables('r0_fixture')).length, 23);
    contracts.push(`${base}'s CLI --fresh: root fresh ${v1} with production's hashes, 23 tables`);

    // 2. This tree: --dry plans 016 alone and changes nothing.
    const dry = await newCLI('--dry');
    assert.deepEqual(dry, { code: 0, type: 'result', mode: 'dry', outcome: 'planned', state: 'managed', rootId: v1,
      stepIds: ['016-usage-statistics'], eligibleActions: ['apply'],
      frontier: { domain: 'v1', availabilityConflictKey: true,
        budgets: ['007', '008', '009', '010', '011', '012', '013', '016'] } });
    assert.deepEqual(await history('r0_fixture'), recorded);
    contracts.push('this tree\'s --dry on that database: managed, root v1, plans 016-usage-statistics alone');

    // 3. --apply applies 016 after the untouched root; the next --dry is clean.
    assert.deepEqual(await newCLI('--apply'), { code: 0, type: 'result', mode: 'apply', outcome: 'applied',
      state: 'managed', rootId: v1, stepIds: ['016-usage-statistics'] });
    const after = await history('r0_fixture');
    assert.deepEqual(after[0], recorded[0], 'the root record is exactly as the fresh wrote it');
    assert.deepEqual(after.slice(1).map(({ row }) => [row.ordinal, row.id, row.kind]), [[1, '016-usage-statistics', 'migration']]);
    assert.equal((await newCLI('--dry')).stepIds.length, 0);
    assert.equal((await newCLI('--apply')).outcome, 'unchanged');
    assert.deepEqual(await tables('r0_fixture'), await (async () => {
      await control.query(`CREATE SCHEMA ${freshSchema}`);
      assert.deepEqual(await newCLI('--fresh', freshSchema), { code: 0, type: 'result', mode: 'fresh', outcome: 'applied',
        state: 'managed', rootId: v2, stepIds: [] });
      return tables(freshSchema);
    })());
    assert.equal((await tables(freshSchema)).length, 25);
    assert.equal((await history(freshSchema))[0].row.id, v2);
    const upgraded = await inspectSchema(control.query.bind(control), { schema: 'r0_fixture', profile: v2 });
    const fresh = await inspectSchema(control.query.bind(control), { schema: freshSchema, profile: v2 });
    assert.equal(upgraded.compatible, true, JSON.stringify(upgraded.issues));
    assert.equal(upgraded.evidenceSha256, fresh.evidenceSha256, 'the upgraded catalog is the fresh v2 catalog');
    assert.equal(manifest.currentProfile, v2);
    contracts.push('--apply: 016 recorded after the untouched root; the next --dry plans nothing; the catalog equals this tree\'s --fresh (v2, 25 tables)');

    // 4. The server on the upgraded database records the day.
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
    try {
      const [{ id }] = await q("INSERT INTO r0_fixture.native_users (email, first_name, timezone) VALUES ('upgrade@example.test', 'Upgrade', 'UTC') RETURNING id");
      const status = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method: 'GET', path: '/api/native/projects',
          headers: { Connection: 'close', Authorization: `Bearer ${generateTokens(id, 1).accessToken}`, 'X-App-Build': '57' } },
        (res) => { res.resume(); res.once('end', () => resolve(res.statusCode)); });
        req.once('error', reject);
        req.end();
      });
      assert.equal(status, 200);
      assert.deepEqual(await q('SELECT user_id, app_build FROM r0_fixture.native_usage_days'), [{ user_id: id, app_build: 57 }]);
    } finally {
      await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
      await database.closeDatabase();
    }
    contracts.push('the server on the upgraded database records the day and the build');
  } finally {
    await control.query(`DROP SCHEMA IF EXISTS ${freshSchema} CASCADE`);
    await rm(fixture, { recursive: true, force: true });
  }
  return { outcome: 'PASS', base, contracts };
}
