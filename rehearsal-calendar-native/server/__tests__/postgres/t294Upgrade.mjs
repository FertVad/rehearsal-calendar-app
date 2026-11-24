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

// Production's database as it is (T-294): created by `migrate --fresh` of a
// release whose migrator and manifest are those of 477ea2f (8a6dd5e, on
// 2026-10-28), and kept by the migrator since. Here 477ea2f's own CLI creates
// such a database; its history is never touched by hand.
// Then this tree's real CLI: --dry plans 016 alone, --apply applies it, the
// next --dry is clean, and the server records the days. A database created by
// this tree's --fresh is version 2 with all 25 tables.
// On 43b5e86 (016 re-pinned into v1) the first --dry answers HISTORY_INVALID.
const base = '477ea2f';
const v1 = 'rehearsly-pg-current-v1';
const v2 = 'rehearsly-pg-current-v2';
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));

// 477ea2f's migrator code is kept in fixtures/migrator-477ea2f byte for byte
// (T-297): CI checks out one commit, so 477ea2f is not in its git history, and
// the scenario fetches nothing. Each file is pinned here by its sha256, the
// hash of `git show 477ea2f:rehearsal-calendar-native/server/<file>`
// (audit/evidence/T-297/extract-fixture.mjs). A changed byte fails the scenario.
const baseCode = Object.freeze({
  'scripts/migrate.js': '1e5b28837b0b123f4cfec9daa748b676c8ffb802b97ee639bd03f4d3c788e1eb',
  'database/migrations/artifacts.mjs': 'd779dae64754e6a282c729e22d1cbe8e25833edcc253fc58d724cc29c5c8c4ca',
  'database/migrations/cli.mjs': '7bad6917bfb16177141dc807a2f10490981d5779c4776f55cf851c7376c28ca7',
  'database/migrations/core.mjs': '04640211c7ed29c1e538543fe395e02cdceca9c94d914d51da4ab602010a98fe',
  'database/migrations/errors.mjs': 'e6aa24349f9e0ea9294b2aa9be47db5595f839c0243c164c95b91b66b1195c36',
  'database/migrations/history.mjs': 'd9879c6104c22b3030949e202bbc8e83e5501db131827c8ffa16919c1b26a9ba',
  'database/migrations/sql.mjs': 'ba70bf8dacc846ff23cef26f3b1853677ffd279dff7aa700644b06bc3c13e578',
  'database/schema/manifest.mjs': '57497bde1283a48e5a69cc66110e8fd266d4f0d7c7d9d60faf26a44aaf34cba7',
});
// The artifacts 477ea2f's manifest names, with the hashes it pins. Version 1's
// artifacts never change (database/schema/README.md), so they come from this
// tree; the old CLI checks each against its manifest (CHECKSUM_MISMATCH), and
// the scenario checks them here first.
const baseArtifacts = Object.freeze({
  'database/init-native-schema.sql': '48284687247da9559e196a0175f427fd39c997fab04f2356de2f7ab204217cf9',
  'database/schema/catalog.json': '3ed03aaac7a6516936b2a8617802a8c286fb5aa711fb1cb9412bb13608af6f83',
  'database/schema/inspect.mjs': 'a38f465f02be34242f43257197b391c4caaf73bfe4c975814ad33a3afe5ca317',
  'database/schema/availability-conflict-key-v1.sql': '9bac959563d488e931f6dc1486f8098499a84cf192a0cdb3d81cf99e40110088',
  'migrations/007-member-availability-rate-limit.sql': '3e24a63c5fe5536e9e32fcc7a8096f149fc003a0aacabe236e0c1385991bb833',
  'migrations/008-invite-rate-limits.sql': '7087822512ee51bc024ed1bacd96b6aebf8cc40a11133d43f63e467d6b532e99',
  'migrations/009-operation-ip-rate-limits.sql': 'f52802b7cbc0d057e0098ce8f890aea4192268e6d05e0beef3ffbf1af6af5961',
  'migrations/010-email-verification.sql': '0306e3c33c39edc892388dedabd4aed5909b0b0b81d53244b52c8a8032dfea6d',
  'migrations/011-push-tickets.sql': 'b2a92ce145607f7298dd4f091e5ee15e9ad10c01a442f0cb81899ede97ddca5b',
  'migrations/012-idempotency-keys.sql': '807f7d43e52dbb7060a4b7a22c8608f09b47b118e25ad4083a69088b2f215449',
  'migrations/013-push-token-owner.sql': '3fe1254b348ee3be9112ad91fb9a754306a261102697e7662ccbf8c7de0a9998',
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function baseMigrator() {
  const fixture = await realpath(await mkdtemp(path.join(tmpdir(), 't294-base-migrator-')));
  const code = fileURLToPath(new URL(`./fixtures/migrator-${base}/`, import.meta.url));
  const copy = async (from, file, expected) => {
    const bytes = await readFile(path.join(from, file));
    assert.equal(sha256(bytes), expected, `${file} is not ${base}'s`);
    const target = path.join(fixture, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  };
  for (const [file, expected] of Object.entries(baseCode)) await copy(code, file, expected);
  for (const [file, expected] of Object.entries(baseArtifacts)) await copy(serverRoot, file, expected);
  // Every artifact the old manifest names is here, with the hash it pins.
  const named = new Map([...(await readFile(path.join(fixture, 'database/schema/manifest.mjs'), 'utf8'))
    .matchAll(/"file": "([^"]+)",\s*"sha256": "([0-9a-f]{64})"/g)].map(([, file, hash]) => [file, hash]));
  assert.deepEqual(Object.fromEntries([...named].sort()), Object.fromEntries(Object.entries(baseArtifacts).sort()));
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
