import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, symlink, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { runMigrations, validateArtifacts } from '../../database/migrations/core.mjs';
import { sha256, canonical, tableGroups } from '../../database/migrations/artifacts.mjs';

const quote = value => `"${value.replaceAll('"', '""')}"`;
const current = 'rehearsly-pg-current-v1';
const domain = 'rehearsly-pg-domain13-v1';
const predecessor = 'rehearsly-pg-domain13-pre-import-key-v1';
const groups = [...tableGroups];
const tableNames = ['native_fixture', ...groups.map(group => `native_budget_${group}`)];
const baseSQL = 'CREATE TABLE native_fixture(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); INSERT INTO native_fixture VALUES(1,\'preserved\');';
const keySQL = 'CREATE UNIQUE INDEX native_fixture_key ON native_fixture(payload);';
const budgetSQL = group => `CREATE TABLE native_budget_${group}(id INTEGER PRIMARY KEY); INSERT INTO native_budget_${group} VALUES(1);`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(work, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await work()) return; await sleep(10); }
  throw new Error('Synthetic barrier deadline exceeded');
}

// Intentionally small real PostgreSQL catalog fixture for the migration engine.
// F01/F02 tests separately run the canonical19-table checker and actual HTTP.
async function inspectFixture(query, { schema, profile }) {
  const objects = (await query(`SELECT c.relname,c.relkind FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
    AND c.relname=ANY($2::text[]) ORDER BY c.relname`, [schema, [...tableNames, 'native_fixture_key']])).rows;
  const names = new Set(objects.map(row => row.relname));
  const columns = (await query(`SELECT a.attname,t.typname,a.attnotnull FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname='native_fixture'
    AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [schema])).rows;
  const frontier = { domain: 'v1', availabilityConflictKey: names.has('native_fixture_key'),
    budgets: groups.filter(group => names.has(`native_budget_${group}`)) };
  const base = names.has('native_fixture') && canonical(columns) === canonical([
    { attname: 'id', typname: 'int4', attnotnull: true }, { attname: 'payload', typname: 'text', attnotnull: true }]);
  const compatible = base && (profile === predecessor ? !frontier.availabilityConflictKey
    : frontier.availabilityConflictKey && (profile !== current || frontier.budgets.length === groups.length));
  return { compatible, issues: [], frontier, evidenceSha256: sha256(canonical({ objects, columns })) };
}

async function fixtureArtifacts({ changed = false } = {}) {
  const files = new Map();
  function artifact(file, source) { const bytes = Buffer.from(source); files.set(file, bytes); return { file, sha256: sha256(bytes) }; }
  const inspector = artifact('__tests__/postgres/r2Migrations.mjs', await readFile(new URL(import.meta.url)));
  const bootstrap = artifact('fixture/bootstrap.sql', baseSQL + keySQL + groups.map(budgetSQL).join('\n'));
  const descriptor = artifact('fixture/profile.json', canonical({ version: 1, tables: tableNames, bootstrapSha256: bootstrap.sha256 }));
  const steps = [{ id: 'availability-conflict-key-v1', sql: artifact('fixture/key.sql', keySQL),
    roots: [current,domain,predecessor], when: { missingAvailabilityKey: true }, verifyProfile: domain }, ...groups.map(group => ({
    id: `budget-${group}`, sql: artifact(`fixture/${group}.sql`, budgetSQL(group) + (changed && group === '009' ? '\n-- changed artifact' : '')),
    roots: [current,domain,predecessor], when: { missingBudget: group }, verifyProfile: domain,
  }))];
  const manifest = { formatVersion: 1, currentProfile: current, lockTables: tableNames,
    profiles: [{ id: current, descriptor, inspector, bootstrap, completionProfile: current, fresh: true, adopt: true },
      { id: domain, descriptor, inspector, completionProfile: current, fresh: false, adopt: true },
      { id: predecessor, descriptor, inspector, completionProfile: current, fresh: false, adopt: true }],
    steps, legacyFilenames: ['historic.sql'] };
  return { artifacts: validateArtifacts(manifest, files), manifest, files };
}

export async function probeR2Migrations({ connectionString, control }) {
  const target = new URL(connectionString);
  assert.equal(target.hostname, '127.0.0.1');
  const prefix = `r2_mig_${randomBytes(6).toString('hex')}`;
  const schemas = [];
  const contracts = [];
  const { artifacts, manifest, files } = await fixtureArtifacts();
  const run = (schema, mode, extra = {}) => runMigrations({ connectionString, schema,
    request: { mode, ...(mode === 'adopt' ? { profileId: domain } : {}) }, artifacts, inspectSchema: inspectFixture, ...extra });
  const check = async (name, work) => {
    await work(); contracts.push(name); console.log(JSON.stringify({ check: name, result: 'PASS' }));
  };
  const make = async ({ key = true, budgets = [], legacy = false } = {}) => {
    const schema = `${prefix}_${schemas.length}`;
    await control.query(`CREATE SCHEMA ${quote(schema)}`); schemas.push(schema);
    await control.query(`SET search_path=${quote(schema)}`);
    await control.query(baseSQL + (key ? keySQL : '') + budgets.map(budgetSQL).join('\n'));
    if (legacy) await control.query(`CREATE TABLE native_migrations(filename TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO native_migrations VALUES('historic.sql','2020-01-01T01:02:03.123456Z');`);
    return schema;
  };
  const snapshot = async schema => ({
    objects: (await control.query(`SELECT c.relname,c.relkind FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname`, [schema])).rows,
    data: (await control.query(`SELECT * FROM ${quote(schema)}.native_fixture ORDER BY id`)).rows,
    history: (await control.query(`SELECT to_jsonb(h) AS row FROM ${quote(schema)}.native_schema_history h ORDER BY ordinal`)).rows,
  });
  const originalQuery = pg.Client.prototype.query;
  try {
    await check('actual CLI help and invalid flags precede environment loading and connections', async () => {
      const entry = fileURLToPath(new URL('../../scripts/migrate.js', import.meta.url));
      for (const [args, code, expected] of [[['--help'], 0, 'usage'], [['--dry', '--baseline'], 2, 'BASELINE_UNSUPPORTED'],
        [['--dry', '--fresh'], 2, 'USAGE_INVALID'], [['--unknown-sensitive-value'], 2, 'USAGE_INVALID'],
        [['--dry','--dry'],2,'USAGE_INVALID'], [['--adopt'],2,'USAGE_INVALID'], [['positional-sensitive-value'],2,'USAGE_INVALID']]) {
        const child = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 3000,
          env: { PATH: '/usr/bin:/bin', SERVER_ENV_FILE: '/private/tmp/does-not-exist-r2-explicit-env', DATABASE_URL: 'invalid-sensitive-value' } });
        assert.ifError(child.error); assert.equal(child.status, code);
        const output = JSON.parse(child.stdout.trim()); assert.equal(output.code ?? output.type, expected);
        assert.equal(child.stderr, ''); assert.ok(!child.stdout.includes('sensitive-value'));
      }
    });
    await check('dry absent history creates no ledger; observed transaction is READ ONLY and takes no advisory lock', async () => {
      const schema = await make();
      let readOnly = false; let advisoryCalls = 0;
      pg.Client.prototype.query = function (query, ...args) {
        const text = typeof query === 'string' ? query : query.text;
        if (this.connectionParameters.application_name === 'rehearsly-migrations' && /pg_try_advisory/.test(text)) advisoryCalls++;
        return originalQuery.call(this, query, ...args);
      };
      const inspector = async (query, options) => {
        assert.equal((await query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on'); readOnly = true;
        return inspectFixture(query, options);
      };
      const before = (await control.query(`SELECT relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY relname`, [schema])).rows;
      const result = await run(schema, 'dry', { inspectSchema: inspector });
      assert.equal(result.state, 'unmanaged-compatible'); assert.equal(readOnly, true); assert.equal(advisoryCalls, 0);
      assert.deepEqual((await control.query(`SELECT relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY relname`, [schema])).rows, before);
      pg.Client.prototype.query = originalQuery;
    });
    await check('fresh is atomic, refuses existing sentinel and writes only an honest fresh root', async () => {
      const schema = `${prefix}_${schemas.length}`; await control.query(`CREATE SCHEMA ${quote(schema)}`); schemas.push(schema);
      const dry = await run(schema, 'dry'); assert.equal(dry.state, 'empty');
      await run(schema, 'fresh');
      const rows = (await control.query(`SELECT kind,artifact_sha256 FROM ${quote(schema)}.native_schema_history`)).rows;
      assert.deepEqual(rows, [{ kind: 'fresh', artifact_sha256: artifacts.profiles[0].bootstrap.sha256 }]);
      const before = await snapshot(schema);
      await assert.rejects(run(schema, 'fresh'), { code: 'SCHEMA_UNRECOGNIZED' });
      assert.deepEqual(await snapshot(schema), before);
      await assert.rejects(run(schema, 'fresh', { schema: `${prefix}_absent` }), { code: 'SCHEMA_UNRECOGNIZED' });
      const failed = `${prefix}_${schemas.length}`; await control.query(`CREATE SCHEMA ${quote(failed)}`); schemas.push(failed);
      await assert.rejects(run(failed, 'fresh', { inspectSchema: async (query, options) => {
        const actual = await inspectFixture(query, options); return { ...actual, compatible: false };
      } }), { code: 'POSTCONDITION_FAILED' });
      assert.equal((await control.query('SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1', [failed])).rows[0].count, '0');
      await control.query(`CREATE TYPE ${quote(failed)}.sentinel_type AS (value INTEGER)`);
      await assert.rejects(run(failed, 'fresh'), { code: 'SCHEMA_UNRECOGNIZED' });
      assert.equal((await control.query('SELECT to_regtype($1) AS type', [`${failed}.sentinel_type`])).rows[0].type, `${failed}.sentinel_type`);
    });
    await check('adoption preserves legacy timestamp precision and does not invent applied SQL', async () => {
      const schema = await make({ legacy: true });
      const before = (await control.query(`SELECT filename,applied_at::text AS applied_at FROM ${quote(schema)}.native_migrations`)).rows;
      await assert.rejects(run(schema, 'apply'), { code: 'LEGACY_HISTORY_UNVERIFIED' });
      await run(schema, 'adopt');
      const recorded = (await control.query(`SELECT kind,artifact_sha256 FROM ${quote(schema)}.native_schema_history`)).rows;
      assert.deepEqual(recorded, [{ kind: 'adopt', artifact_sha256: artifacts.profiles[1].descriptor.sha256 }]);
      assert.deepEqual((await control.query(`SELECT filename,applied_at::text AS applied_at FROM ${quote(schema)}.native_migrations`)).rows, before);
      const managed = await snapshot(schema); await run(schema, 'dry'); assert.deepEqual(await snapshot(schema), managed);
      assert.equal((await run(schema,'adopt')).outcome,'unchanged'); assert.deepEqual(await snapshot(schema),managed);
      await control.query(`UPDATE ${quote(schema)}.native_migrations SET applied_at=applied_at+interval '1 microsecond'`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      await control.query(`UPDATE ${quote(schema)}.native_migrations SET applied_at='infinity'`);
      await assert.rejects(run(schema, 'dry'), { code: 'LEGACY_HISTORY_UNVERIFIED' });
      assert.equal((await control.query(`SELECT applied_at::text FROM ${quote(schema)}.native_migrations`)).rows[0].applied_at, 'infinity');
    });
    await check('real ledger INSERT failure rolls back the whole pending batch; repair and retry apply once', async () => {
      const schema = await make(); await run(schema, 'adopt');
      const before = await snapshot(schema);
      let injected = false;
      await assert.rejects(run(schema, 'apply', { inspectSchema: async (query, options) => {
        if (!injected) {
          injected = true;
          // Same real transaction after history inspection. The trigger is a
          // storage-failure injection, not accepted pre-existing ledger drift.
          await query(`CREATE FUNCTION ${quote(schema)}.reject_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.id='budget-008' THEN RAISE EXCEPTION 'synthetic ledger refusal'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER reject_ledger BEFORE INSERT ON ${quote(schema)}.native_schema_history
            FOR EACH ROW EXECUTE FUNCTION ${quote(schema)}.reject_ledger();`);
        }
        return inspectFixture(query, options);
      } }), { code: 'MIGRATION_FAILED' });
      assert.deepEqual(await snapshot(schema), before);
      assert.equal((await control.query(`SELECT to_regclass($1) AS relation`, [`${schema}.native_budget_007`])).rows[0].relation, null);
      const success = await run(schema, 'apply'); assert.deepEqual(success.stepIds, groups.map(group => `budget-${group}`));
      const after = await snapshot(schema); assert.equal((await run(schema, 'apply')).outcome, 'unchanged'); assert.deepEqual(await snapshot(schema), after);
      const altered = await fixtureArtifacts({ changed: true });
      await assert.rejects(run(schema, 'apply', { artifacts: altered.artifacts }), { code: 'HISTORY_INVALID' });
    });
    await check('suppressed ledger INSERT cannot commit SQL; pre-existing trigger drift refuses', async () => {
      const schema = await make(); await run(schema, 'adopt'); const before = await snapshot(schema);
      const trigger = `CREATE FUNCTION ${quote(schema)}.suppress_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
        CREATE TRIGGER suppress_ledger BEFORE INSERT ON ${quote(schema)}.native_schema_history FOR EACH ROW EXECUTE FUNCTION ${quote(schema)}.suppress_ledger();`;
      let injected = false;
      await assert.rejects(run(schema, 'apply', { inspectSchema: async (query, options) => {
        if (!injected) { injected = true; await query(trigger); }
        return inspectFixture(query, options);
      } }), { code: 'HISTORY_RECORD_FAILED' });
      assert.deepEqual(await snapshot(schema), before);
      await control.query(trigger);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      assert.deepEqual(await snapshot(schema), before);
    });
    await check('edited out-of-order history refuses before schema mutation', async () => {
      const schema = await make(); await run(schema, 'adopt');
      const step = artifacts.steps.find(item => item.id === 'budget-009');
      await control.query(`INSERT INTO ${quote(schema)}.native_schema_history
        (ordinal,id,kind,artifact_sha256,descriptor_sha256,frontier)
        VALUES(1,$1,'migration',$2,$3,$4)`, [step.id,step.sql.sha256,step.definitionSha256,
        JSON.stringify({ domain: 'v1',availabilityConflictKey:true,budgets:['009'] })]);
      const before = await snapshot(schema);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      assert.deepEqual(await snapshot(schema), before);
    });
    await check('ledger constraint/default/rule/forced-RLS drift cannot masquerade as valid history', async () => {
      const schema = await make(); await run(schema, 'adopt');
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history ALTER COLUMN recorded_at SET DEFAULT '2000-01-01Z'::timestamptz`);
      await assert.rejects(run(schema, 'dry'), { code: 'HISTORY_INVALID' });
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history ALTER COLUMN recorded_at SET DEFAULT clock_timestamp()`);
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history ADD CONSTRAINT unknown_restriction CHECK(id<>'blocked')`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history DROP CONSTRAINT unknown_restriction`);
      await control.query(`CREATE RULE suppress_history AS ON INSERT TO ${quote(schema)}.native_schema_history DO INSTEAD NOTHING`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      await control.query(`DROP RULE suppress_history ON ${quote(schema)}.native_schema_history`);
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history FORCE ROW LEVEL SECURITY`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history NO FORCE ROW LEVEL SECURITY`);
      const preserved = await snapshot(schema);
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history SET UNLOGGED`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      assert.deepEqual(await snapshot(schema), preserved);
      await control.query(`ALTER TABLE ${quote(schema)}.native_schema_history SET LOGGED`);
      await control.query(`CREATE UNIQUE INDEX extra_unique_history ON ${quote(schema)}.native_schema_history(artifact_sha256)`);
      await assert.rejects(run(schema, 'apply'), { code: 'HISTORY_INVALID' });
      await control.query(`DROP INDEX ${quote(schema)}.extra_unique_history`);
      await run(schema, 'apply');
    });
    await check('advisory lock prevents concurrent executors and explicit retry re-reads committed history', async () => {
      const schema = await make(); await run(schema, 'adopt');
      let entered; const barrier = new Promise(resolve => { entered = resolve; });
      let release; const wait = new Promise(resolve => { release = resolve; });
      let blocked = false;
      const first = run(schema, 'apply', { inspectSchema: async (query, options) => {
        if (!blocked) { blocked = true; entered(); await wait; }
        return inspectFixture(query, options);
      } });
      first.catch(() => {}); await barrier;
      try { await assert.rejects(run(schema, 'apply'), { code: 'MIGRATION_BUSY' }); }
      finally { release(); }
      await first; assert.equal((await run(schema, 'apply')).outcome, 'unchanged');
      assert.equal((await control.query(`SELECT count(*) FROM ${quote(schema)}.native_schema_history`)).rows[0].count, String(groups.length + 1));
    });
    await check('write inspection holds real table locks against app writes; lock wait is bounded', async () => {
      const schema = await make();
      const blocker = new pg.Client({ connectionString }); await blocker.connect();
      try {
        await blocker.query('BEGIN'); await blocker.query(`UPDATE ${quote(schema)}.native_fixture SET payload='held' WHERE id=1`);
        const started = Date.now(); await assert.rejects(run(schema, 'adopt'), { code: 'MIGRATION_FAILED' });
        const elapsedMs = Date.now() - started; assert.ok(elapsedMs >= 900 && elapsedMs < 3500);
        assert.equal((await control.query('SELECT to_regclass($1) AS relation', [`${schema}.native_schema_history`])).rows[0].relation, null);
        await blocker.query('ROLLBACK'); await run(schema, 'adopt');
      } finally { await blocker.end(); }
      const protectedSchema = await make();
      const writer = new pg.Client({ connectionString }); await writer.connect();
      let sawWriteRefusal = false;
      try {
        await writer.query("SET lock_timeout='200ms'");
        await run(protectedSchema, 'adopt', { inspectSchema: async (query, options) => {
          await assert.rejects(writer.query(`UPDATE ${quote(protectedSchema)}.native_fixture SET payload='not-admitted' WHERE id=1`), { code: '55P03' });
          sawWriteRefusal = true;
          return inspectFixture(query, options);
        } });
      } finally { await writer.end(); }
      assert.equal(sawWriteRefusal, true);
      assert.equal((await control.query(`SELECT payload FROM ${quote(protectedSchema)}.native_fixture WHERE id=1`)).rows[0].payload, 'preserved');
    });
    await check('real transport loss after COMMIT is outcome unknown; next explicit run verifies history', async () => {
      const schema = await make({ budgets: ['007', '008'] }); await run(schema, 'adopt');
      let executed = false;
      pg.Client.prototype.query = function (query, ...args) {
        const text = typeof query === 'string' ? query : query.text;
        if (this.connectionParameters.application_name === 'rehearsly-migrations' && text === 'COMMIT' && !executed) {
          executed = true;
          const socket = this.connection.stream; socket.pause();
          const pending = originalQuery.call(this, query, ...args); pending.catch(() => {});
          return (async () => {
            await eventually(async () => Number((await control.query(`SELECT count(*) FROM ${quote(schema)}.native_schema_history WHERE id='budget-009'`)).rows[0].count) === 1);
            socket.destroy(new Error('Synthetic lost COMMIT response'));
            return pending;
          })();
        }
        return originalQuery.call(this, query, ...args);
      };
      try { await assert.rejects(run(schema, 'apply'), { code: 'COMMIT_OUTCOME_UNKNOWN' }); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(executed, true); assert.equal((await run(schema, 'apply')).outcome, 'unchanged');
      assert.equal((await control.query(`SELECT count(*) FROM ${quote(schema)}.native_budget_009`)).rows[0].count, '1');
    });
    await check('PostgreSQL COMMIT response ROLLBACK is a known failure, never unknown or success', async () => {
      const schema = await make({ budgets: ['007','008'] }); await run(schema, 'adopt');
      let injected = false;
      pg.Client.prototype.query = function (query, ...args) {
        const text = typeof query === 'string' ? query : query.text;
        if (this.connectionParameters.application_name === 'rehearsly-migrations' && text === 'COMMIT' && !injected) {
          injected = true;
          return (async () => {
            await originalQuery.call(this, 'SELECT 1/0').catch(() => {});
            const actual = await originalQuery.call(this, query, ...args);
            assert.equal(actual.command, 'ROLLBACK'); return actual;
          })();
        }
        return originalQuery.call(this, query, ...args);
      };
      try { await assert.rejects(run(schema, 'apply'), { code: 'MIGRATION_FAILED' }); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(injected, true);
      assert.equal((await control.query(`SELECT count(*) FROM ${quote(schema)}.native_schema_history`)).rows[0].count, '1');
      assert.equal((await control.query('SELECT to_regclass($1) AS relation', [`${schema}.native_budget_009`])).rows[0].relation, null);
      await run(schema, 'apply');
    });
    await check('curated artifact boundary rejects transaction/session controls, respecting quoted bodies and comments', async () => {
      const { validateTransactionalSQL } = await import('../../database/migrations/sql.mjs');
      for (const sql of ['/* outer /* nested */ comment */ COMMIT;', 'SELECT 1; ROLLBACK;', 'START TRANSACTION;',
        'SET LOCAL search_path=public;', 'CREATE INDEX CONCURRENTLY idx ON test(id);', '/* unterminated']) {
        assert.throws(() => validateTransactionalSQL(sql), { code: 'ARTIFACT_INVALID' });
      }
      validateTransactionalSQL("SELECT 'COMMIT;'; DO $$ BEGIN PERFORM 1; END $$; -- ROLLBACK\nSELECT 2;");
    });
    await check('an unrelated pinned profile and its scoped steps preserve existing root identities and plans', async () => {
      const schema = await make(); await run(schema, 'adopt');
      const futureId = 'future-reviewed-profile-v2';
      const futureBytes = Buffer.from('// Independently pinned future inspector artifact.');
      const extendedFiles = new Map(files); extendedFiles.set('fixture/future-inspector.mjs', futureBytes);
      const futureProfile = { ...manifest.profiles[0], id: futureId, completionProfile: futureId,
        inspector: { file: 'fixture/future-inspector.mjs', sha256: sha256(futureBytes) } };
      const extended = validateArtifacts({ ...manifest, currentProfile: futureId, profiles: [...manifest.profiles, futureProfile],
        steps: [...manifest.steps, { ...manifest.steps.at(-1), id: 'future-budget-009', roots: [futureId], verifyProfile: futureId }] }, extendedFiles);
      assert.equal(extended.profiles[1].definitionSha256, artifacts.profiles[1].definitionSha256);
      const before = await run(schema, 'dry'); const after = await run(schema, 'dry', { artifacts: extended });
      assert.deepEqual(after, before);
      const versionedInspector = (query, options) => options.profile === futureId
        ? Promise.resolve({ compatible: false, issues: [{ code: 'FUTURE_PROFILE_NOT_CURRENT', objectId: 'future-v2' }] })
        : inspectFixture(query, options);
      assert.deepEqual((await run(schema, 'apply', { artifacts: extended, inspectSchema: versionedInspector })).stepIds, groups.map(group => `budget-${group}`));
      assert.equal((await run(schema, 'apply', { artifacts: extended, inspectSchema: versionedInspector })).outcome,'unchanged');
      assert.equal((await run(schema, 'apply')).outcome, 'unchanged');
      const freshSchema = `${prefix}_${schemas.length}`;
      await control.query(`CREATE SCHEMA ${quote(freshSchema)}`); schemas.push(freshSchema);
      await run(freshSchema,'fresh');
      assert.equal((await control.query(`SELECT count(*) FROM ${quote(freshSchema)}.native_schema_history`)).rows[0].count,'1');
      assert.equal((await run(freshSchema,'apply',{artifacts:extended,inspectSchema:versionedInspector})).outcome,'unchanged');
      const tampered = new Map(extendedFiles); tampered.set(manifest.profiles[1].inspector.file, Buffer.from('changed old inspector'));
      assert.throws(() => validateArtifacts(manifest,tampered), { code: 'CHECKSUM_MISMATCH' });
    });
    await check('copied actual CLI uses explicit environment, fresh canonical artifacts and readable duplicate dry diagnostics', async () => {
      const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
      // The system's temp folder, as its real path: /private/tmp exists only
      // on macOS, and CI runs Linux. The guard below compares paths as written.
      const fixture = await realpath(await mkdtemp(path.join(tmpdir(), 'reh-migration-cli-')));
      try {
        // The runner's code, plus every artifact the real manifest names.
        const { manifest: realManifest } = await import('../../database/schema/manifest.mjs');
        const copied = [...new Set(['scripts/migrate.js', 'database/migrations/cli.mjs', 'database/migrations/core.mjs',
          'database/migrations/artifacts.mjs', 'database/migrations/errors.mjs', 'database/migrations/history.mjs',
          'database/migrations/sql.mjs', 'database/schema/manifest.mjs',
          ...realManifest.profiles.flatMap(profile => [profile.descriptor, profile.inspector, profile.bootstrap]).filter(Boolean).map(ref => ref.file),
          ...realManifest.steps.map(step => step.sql.file)])];
        for (const file of copied) {
          await mkdir(path.dirname(path.join(fixture,file)), { recursive: true });
          await copyFile(path.join(sourceRoot,file),path.join(fixture,file));
        }
        await writeFile(path.join(fixture,'package.json'),'{"type":"module"}');
        await symlink(path.join(sourceRoot,'node_modules'),path.join(fixture,'node_modules'));
        const selectedEnvironment = path.join(fixture,'explicit-synthetic-environment.txt');
        const childSchema = `${prefix}_${schemas.length}`; await control.query(`CREATE SCHEMA ${quote(childSchema)}`); schemas.push(childSchema);
        await writeFile(selectedEnvironment,`DATABASE_URL=${connectionString}\nMIGRATION_SCHEMA=${childSchema}\n`);
        // This explicit fixture's implicit file is poison. A preload rejects any
        // attempted read of it and permits connections only to the owned PG port.
        await writeFile(path.join(fixture,'.env'),'MIGRATION_SCHEMA=must_not_be_read\n');
        const guard = path.join(fixture,'guard.mjs');
        await writeFile(guard, `import fs from 'node:fs';import fsp from 'node:fs/promises';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
const forbidden=${JSON.stringify(path.join(fixture,'.env'))};
const check=p=>{if(String(p)===forbidden)throw new Error('Implicit environment read forbidden');};
const sync=fs.readFileSync;fs.readFileSync=function(p,...a){check(p);return sync.call(this,p,...a);};
const asyncRead=fsp.readFile;fsp.readFile=function(p,...a){check(p);return asyncRead.call(this,p,...a);};syncBuiltinESMExports();
const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...a){const first=Array.isArray(a[0])?a[0][0]:a[0],o=typeof first==='object'?first:{port:first,host:a[1]};
if(o.host!=='127.0.0.1'||String(o.port)!==${JSON.stringify(target.port)})throw new Error('External connection refused');return original.apply(this,a);};`);
        const cli = (args, extra = {}) => {
          const child = spawnSync(process.execPath,['--import',guard,path.join(fixture,'scripts/migrate.js'),...args],{
            cwd:fixture,encoding:'utf8',timeout:15000,env:{PATH:'/usr/bin:/bin',SERVER_ENV_FILE:selectedEnvironment,...extra},
          });
          assert.ifError(child.error); assert.equal(child.stderr,'');
          assert.ok(!child.stdout.includes(target.password));
          return { status:child.status,output:JSON.parse(child.stdout.trim()) };
        };
        assert.equal(cli(['--dry']).output.state,'empty');
        assert.equal(cli(['--fresh']).status,0);
        assert.equal(cli(['--dry']).output.state,'managed');
        assert.equal(cli(['--apply']).output.outcome,'unchanged');
        const override = `${prefix}_${schemas.length}`; await control.query(`CREATE SCHEMA ${quote(override)}`); schemas.push(override);
        assert.equal(cli(['--dry'],{MIGRATION_SCHEMA:override}).output.state,'empty','Process environment must beat selected file');
        assert.equal(cli(['--dry'],{SERVER_ENV_FILE:'relative-forbidden'}).output.code,'CONFIG_INVALID');
        assert.equal(cli(['--dry'],{SERVER_ENV_FILE:path.join(fixture,'missing-file')}).output.code,'CONFIG_INVALID');
        await control.query(`SET search_path=${quote(override)}`);
        await control.query(await readFile(path.join(sourceRoot,'database/init-native-schema.sql'),'utf8'));
        await control.query(`DROP INDEX idx_availability_imported_event;
          INSERT INTO native_users(email,first_name) VALUES('migration-fixture@example.test','Fixture');
          INSERT INTO native_user_availability(user_id,starts_at,ends_at,source,external_event_id)
          SELECT 1,'2030-01-01T10:00:00Z'::timestamptz,'2030-01-01T11:00:00Z'::timestamptz,'apple_calendar','synthetic-event-value-not-for-logs' FROM generate_series(1,2);`);
        const before = (await control.query(`SELECT * FROM ${quote(override)}.native_user_availability ORDER BY id`)).rows;
        const result = cli(['--dry'],{MIGRATION_SCHEMA:override}); assert.equal(result.status,0);
        assert.equal(result.output.state,'unmanaged-unrecognized');
        assert.ok(result.output.diagnostics.some(item=>item.issues.some(issue=>issue.code==='IMPORTED_EVENT_DUPLICATES')));
        assert.ok(result.output.diagnostics.some(item=>item.issues.some(issue=>issue.code==='CONFLICT_TARGET_MISSING')));
        assert.ok(!JSON.stringify(result.output).includes('synthetic-event-value-not-for-logs'));
        const adoption = cli(['--adopt',predecessor],{MIGRATION_SCHEMA:override}); assert.equal(adoption.status,1);
        assert.equal(adoption.output.code,'PRECONDITION_FAILED');
        assert.ok(adoption.output.diagnostics[0].issues.some(issue=>issue.code==='IMPORTED_EVENT_DUPLICATES'));
        assert.deepEqual((await control.query(`SELECT * FROM ${quote(override)}.native_user_availability ORDER BY id`)).rows,before);
        assert.equal((await control.query('SELECT to_regclass($1) AS relation',[`${override}.native_schema_history`])).rows[0].relation,null);
      } finally { await rm(fixture,{recursive:true,force:true}); }
    });
    await check('artifact tampering refuses before SQL and mutable input bytes cannot change admitted snapshots', async () => {
      const admitted = artifacts.steps[0].sql.sql;
      files.get('fixture/key.sql').fill(32);
      assert.equal(artifacts.steps[0].sql.sql, admitted);
      assert.throws(() => validateArtifacts(manifest, files), { code: 'CHECKSUM_MISMATCH' });
    });
    return { outcome: 'PASS', contracts, fixture: 'synthetic PostgreSQL migration contracts; canonical schema covered separately' };
  } finally {
    pg.Client.prototype.query = originalQuery;
    await control.query('SET search_path=public');
    for (const schema of schemas.reverse()) await control.query(`DROP SCHEMA ${quote(schema)} CASCADE`);
  }
}
