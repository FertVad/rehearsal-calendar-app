// R2 before/after reproduction: the same scenarios against the pre-R2 tooling
// (git BEFORE, extracted to a temporary root with no .env) and against the
// current tree, on a disposable loopback PostgreSQL 15 owned by this run.
//
//   node audit/evidence/R2/before-after.mjs
//
// Exit 0 only when every "before" expectation reproduces the audited defect
// and every "after" expectation holds. No database URL is accepted; the old
// runner's dotenv call finds no file because its root is a fresh temp dir.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Nothing ambient may select a database for the application imported below.
for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'SERVER_ENV_FILE']) delete process.env[key];
const BEFORE = 'aa00ffd5874b3b5e4c402b42b120ceb876e637e2';
const repo = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const server = path.join(repo, 'rehearsal-calendar-native/server');
const require = createRequire(path.join(server, 'package.json'));
const pg = require('pg');
const Database = require('better-sqlite3');
const load = file => import(pathToFileURL(path.join(server, file)).href);
const { runMigrations, loadArtifacts } = await load('database/migrations/core.mjs');
const { runCLI } = await load('database/migrations/cli.mjs');
const { manifest, inspectSchema } = await load('database/schema/manifest.mjs');
const artifacts = await loadArtifacts(manifest, server + path.sep);
const bootstrap = readFileSync(path.join(server, 'database/init-native-schema.sql'), 'utf8');
const keyStatement = /CREATE UNIQUE INDEX idx_availability_imported_event\s+ON native_user_availability \(user_id, external_event_id, source\);/;
assert.match(bootstrap, keyStatement);
const bootstrapWithoutKey = bootstrap.replace(keyStatement, '');
const routeInsert = `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, notes, is_all_day, source, external_event_id)
  VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (user_id, external_event_id, source) DO NOTHING`;
assert.ok(readFileSync(path.join(server, 'routes/native/availability.js'), 'utf8')
  .includes('ON CONFLICT (user_id, external_event_id, source) DO NOTHING'), 'route statement moved; update this reproduction');

const results = [];
function report(finding, phase, check, expected, actual) {
  const ok = expected === actual;
  results.push(ok);
  console.log(JSON.stringify({ finding, phase, check, expected, actual, result: ok ? 'PASS' : 'FAIL' }));
}
const quote = value => `"${value.replaceAll('"', '""')}"`;

// ---- old tooling: files from BEFORE, own root, no .env, real node_modules ----
const scratch = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), 'r2-before-after-'));
function oldRoot(name, migrationFiles) {
  const root = path.join(scratch, name);
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'migrations'));
  mkdirSync(path.join(root, 'database'));
  const show = rel => execFileSync('git', ['-C', repo, 'show', `${BEFORE}:rehearsal-calendar-native/server/${rel}`]);
  writeFileSync(path.join(root, 'scripts/migrate.js'), show('scripts/migrate.js'));
  for (const file of migrationFiles) {
    writeFileSync(path.join(root, 'migrations', file.name), file.body ?? show(`migrations/${file.name}`));
  }
  symlinkSync(path.join(server, 'node_modules'), path.join(root, 'node_modules'));
  assert.equal(existsSync(path.join(root, '.env')), false);
  return root;
}
function oldRunner(root, args, databaseUrl) {
  assert.equal(existsSync(path.join(root, '.env')), false);
  const env = { PATH: '/usr/bin:/bin', HOME: scratch, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) };
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/migrate.js'), ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  assert.ifError(child.error);
  return { status: child.status, output: child.stdout + child.stderr };
}
const beforeFiles = execFileSync('git', ['-C', repo, 'ls-tree', '--name-only', `${BEFORE}:rehearsal-calendar-native/server/migrations`],
  { encoding: 'utf8' }).trim().split('\n');

// ---- disposable PostgreSQL ----
const docker = '/usr/local/bin/docker';
const cli = (...args) => execFileSync(docker, ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 20000,
  env: { ...process.env, POSTGRES_PASSWORD: secret } }).trim();
const nonce = randomBytes(12).toString('hex');
const secret = randomBytes(20).toString('hex');
let container;
let control;
try {
  assert.ok(cli('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}').startsWith('unix://'));
  const images = [...new Set(cli('image', 'ls', '--filter', 'reference=postgres:15', '--quiet', '--no-trunc').split('\n'))];
  assert.equal(images.length, 1);
  container = cli('run', '--pull=never', '--rm', '--detach', '--name', `rehearsly-r2-ba-${nonce}`,
    '--label', `rehearsly.r2ba=${nonce}`, '--memory', '512m', '--stop-timeout', '3',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m', '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=r2_owner', '--env', 'POSTGRES_DB=r2_repro', '--env', 'POSTGRES_PASSWORD', images[0]);
  assert.match(container, /^[a-f0-9]{64}$/);
  // Docker Desktop can publish the port a moment after docker run returns.
  let binding = '';
  for (let attempt = 0; attempt < 50 && !binding; attempt++) {
    try { binding = cli('port', container, '5432/tcp').split('\n')[0].trim(); } catch { binding = ''; }
    if (!binding) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const base = new URL(`postgresql://r2_owner@${binding}/r2_repro`);
  base.password = secret;
  const urlFor = (schema, timeZone = 'UTC') => {
    const url = new URL(base.href);
    url.searchParams.set('options', `-c search_path=${schema} -c TimeZone=${timeZone}`);
    return url.href;
  };
  for (let attempt = 0; attempt < 40 && !control; attempt++) {
    const candidate = new pg.Client({ connectionString: base.href, connectionTimeoutMillis: 1000 });
    candidate.on('error', () => {});
    try { await candidate.connect(); control = candidate; }
    catch { await candidate.end().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(control, 'disposable PostgreSQL did not start');
  await control.query('CREATE TABLE public.r2_owned_database(nonce TEXT NOT NULL)');
  await control.query('INSERT INTO public.r2_owned_database VALUES ($1)', [nonce]);
  console.log(JSON.stringify({ harness: 'R2 before/after', before: BEFORE, node: process.version,
    postgres: (await control.query('SELECT version()')).rows[0].version }));
  const q = (text, values) => control.query(text, values);
  const createSchema = async (name, sql) => {
    await q(`CREATE SCHEMA ${quote(name)}`);
    if (sql) { await q(`SET search_path TO ${quote(name)}`); await q(sql); await q('RESET search_path'); }
  };
  const relations = async schema => (await q(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
    ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY 1`, [schema])).rows.map(row => row.relname);
  const sqlState = async (work) => { try { await work(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
  const migrate = (schema, request, extra = {}) => runMigrations({ connectionString: base.href, schema, request,
    artifacts, inspectSchema, ...extra });
  const migrationCode = async (work) => { try { const r = await work(); return r.outcome ?? 'OK'; } catch (error) { return error.code; } };
  async function emitCLI(argv, env) {
    const lines = [];
    const status = await runCLI({ argv, env, emit: value => lines.push(value) });
    return { status, output: lines.at(-1) };
  }

  // ===== F01: the bootstrap file executes on PostgreSQL =====
  const oldBootstrap = execFileSync('git', ['-C', repo, 'show', `${BEFORE}:rehearsal-calendar-native/server/database/init-native-schema.sql`], { encoding: 'utf8' });
  await createSchema('before_f01');
  await q('BEGIN');
  const oldF01 = await sqlState(async () => { await q('SET LOCAL search_path TO before_f01'); await q(oldBootstrap); });
  await q('ROLLBACK');
  report('F01', 'before', 'documented bootstrap on empty PostgreSQL schema', '42601', oldF01);
  await createSchema('after_f01');
  report('F01', 'after', 'runner --fresh on empty PostgreSQL schema', 'applied', await migrationCode(() => migrate('after_f01', { mode: 'fresh' })));
  const freshInspection = await inspectSchema(q, { schema: 'after_f01', profile: 'rehearsly-pg-current-v1' });
  report('F01', 'after', 'fresh catalog matches the reviewed descriptor', true, freshInspection.compatible);
  // As many as the checked-out descriptor names: 19 at eb24c62, 21 once R3 added group 010.
  const describedTables = JSON.parse(readFileSync(path.join(server, 'database/schema/catalog.json'), 'utf8')).tables.length;
  report('F01', 'after', 'application tables created', describedTables, Number((await q(`SELECT count(*) FROM pg_catalog.pg_tables
    WHERE schemaname='after_f01' AND tablename LIKE 'native\\_%' AND tablename<>'native_schema_history'`)).rows[0].count));

  // ===== F02: bulk availability conflict target after provisioning =====
  // Old procedure after F01's dialect is fixed: a base without the 005 index,
  // then --baseline. The base below differs from the old file only in dialect
  // and extra objects; the one property F02 depends on (no 005 index) holds.
  const realRoot = oldRoot('real', beforeFiles.map(name => ({ name })));
  await createSchema('before_f02', bootstrapWithoutKey);
  const baselined = oldRunner(realRoot, ['--baseline'], urlFor('before_f02'));
  report('F02', 'before', 'old --baseline exit status', 0, baselined.status);
  report('F02', 'before', 'ledger claims 005 applied', 1, Number((await q(`SELECT count(*) FROM before_f02.native_migrations
    WHERE filename='005-unique-imported-event.sql'`)).rows[0].count));
  report('F02', 'before', '005 conflict index actually present', 0, Number((await q(`SELECT count(*) FROM pg_catalog.pg_indexes
    WHERE schemaname='before_f02' AND indexname='idx_availability_imported_event'`)).rows[0].count));
  await q(`INSERT INTO before_f02.native_users(email,first_name) VALUES('f02@fixture.invalid','F02')`);
  const bulkArgs = [1, '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', 'busy', null, null, false, 'manual', null];
  report('F02', 'before', 'route bulk INSERT ... ON CONFLICT', '42P10',
    await sqlState(async () => { await q('SET search_path TO before_f02'); try { await q(routeInsert, bulkArgs); } finally { await q('RESET search_path'); } }));
  // The same through the application: current app code, old provisioning result.
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const database = await load('database/db.js');
  const { createApp } = await load('app.js');
  await database.initDatabase({ connectionString: urlFor('before_f02') });
  const listener = await new Promise((resolve, reject) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  try {
    const call = async (route, body, token) => {
      const response = await fetch(`http://127.0.0.1:${listener.address().port}${route}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.201', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    // The session is signed for an account written directly. Registration went
    // through /api/auth/register until R3 made it wait for an emailed code in
    // tables (group 010) the old procedure never created; F02 is about the
    // bulk route, and a refused session would show as 401, not 500.
    const account = (await q(`INSERT INTO before_f02.native_users(email,first_name)
      VALUES('f02-http@fixture.invalid','F02') RETURNING id, token_version`)).rows[0];
    const { generateTokens } = await load('middleware/jwtMiddleware.js');
    const bulk = await call('/api/native/availability/bulk', { entries: [{ startsAt: '2031-03-29T10:00:00Z',
      endsAt: '2031-03-29T11:00:00Z', type: 'busy' }] }, generateTokens(account.id, account.token_version).accessToken);
    report('F02', 'before', 'POST /api/native/availability/bulk on the old-procedure database', 500, bulk.status);
  } finally {
    await new Promise(resolve => listener.close(resolve));
    await database.closeDatabase();
  }
  // After: fresh has the key (F01 schema); baseline is refused; the same
  // key-less base is refused by the default profile and repaired only by the
  // explicit predecessor profile, without touching rows.
  await q(`INSERT INTO after_f01.native_users(email,first_name) VALUES('f02@fixture.invalid','F02')`);
  report('F02', 'after', 'route bulk INSERT on fresh schema', 'OK',
    await sqlState(async () => { await q('SET search_path TO after_f01'); try { await q(routeInsert, bulkArgs); await q(routeInsert, bulkArgs); } finally { await q('RESET search_path'); } }));
  report('F02', 'after', 'repeated manual bulk rows stay legal (NULL external id)', 2,
    Number((await q(`SELECT count(*) FROM after_f01.native_user_availability`)).rows[0].count));
  const baselineCLI = await emitCLI(['--baseline'], { DATABASE_URL: urlFor('unused') });
  report('F02', 'after', 'CLI --baseline refused', 'BASELINE_UNSUPPORTED', baselineCLI.output.code);
  await createSchema('after_f02', bootstrapWithoutKey);
  await q(`INSERT INTO after_f02.native_users(email,first_name) VALUES('f02@fixture.invalid','F02')`);
  await q(`INSERT INTO after_f02.native_user_availability(user_id,starts_at,ends_at,external_event_id,source)
    VALUES(1,'2026-10-01T10:00Z','2026-10-01T11:00Z','ext-1','apple_calendar'),(1,'2026-10-02T10:00Z','2026-10-02T11:00Z',NULL,'manual')`);
  const rowsBefore = (await q('SELECT row_to_json(a) AS row FROM after_f02.native_user_availability a ORDER BY id')).rows;
  report('F02', 'after', 'default profile refuses a base without the conflict key', 'PRECONDITION_FAILED',
    await migrationCode(() => migrate('after_f02', { mode: 'adopt', profileId: 'rehearsly-pg-domain13-v1' })));
  report('F02', 'after', 'refused adoption wrote no history', false, (await relations('after_f02')).includes('native_schema_history'));
  report('F02', 'after', 'explicit pre-import-key adoption', 'applied',
    await migrationCode(() => migrate('after_f02', { mode: 'adopt', profileId: 'rehearsly-pg-domain13-pre-import-key-v1' })));
  const repaired = await migrate('after_f02', { mode: 'apply' });
  report('F02', 'after', 'first forward step creates the key', 'availability-conflict-key-v1', repaired.stepIds[0]);
  report('F02', 'after', 'route bulk INSERT after repair', 'OK',
    await sqlState(async () => { await q('SET search_path TO after_f02'); try { await q(routeInsert, bulkArgs); } finally { await q('RESET search_path'); } }));
  report('F02', 'after', 'existing rows preserved by repair', JSON.stringify(rowsBefore),
    JSON.stringify((await q('SELECT row_to_json(a) AS row FROM after_f02.native_user_availability a WHERE id<=2 ORDER BY id')).rows));
  report('F02', 'after', 'repaired catalog equals fresh', freshInspection.evidenceSha256,
    (await inspectSchema(q, { schema: 'after_f02', profile: 'rehearsly-pg-current-v1' })).evidenceSha256);

  // ===== FT01: --dry writes nothing; --dry --baseline cannot rewrite history =====
  await createSchema('before_ft01');
  // With no ledger the old runner refuses (exit 1), but only after it has
  // already created the ledger table that --dry promised not to create.
  const oldDry = oldRunner(realRoot, ['--dry'], urlFor('before_ft01'));
  report('FT01', 'before', 'old --dry exit status', 1, oldDry.status);
  report('FT01', 'before', 'old --dry created relations', 'native_migrations,native_migrations_pkey', (await relations('before_ft01')).join(','));
  await createSchema('before_ft01b');
  oldRunner(realRoot, ['--dry', '--baseline'], urlFor('before_ft01b'));
  report('FT01', 'before', 'old --dry --baseline recorded files without running them',
    beforeFiles.filter(file => !file.endsWith('-sqlite.sql')).length,
    Number((await q('SELECT count(*) FROM before_ft01b.native_migrations')).rows[0].count));
  await createSchema('after_ft01');
  const newDry = await migrate('after_ft01', { mode: 'dry' });
  report('FT01', 'after', 'runner --dry on empty schema', 'planned', newDry.outcome);
  report('FT01', 'after', 'runner --dry created relations', '', (await relations('after_ft01')).join(','));
  const dryBaseline = await emitCLI(['--dry', '--baseline'], { DATABASE_URL: urlFor('after_ft01') });
  report('FT01', 'after', 'CLI --dry --baseline', 'BASELINE_UNSUPPORTED', dryBaseline.output.code);
  report('FT01', 'after', 'relations after refused --dry --baseline', '', (await relations('after_ft01')).join(','));

  // ===== FT02: SQL and its ledger record commit together =====
  const probeRoot = oldRoot('ft02', [{ name: '900-ft02-probe.sql', body: 'CREATE TABLE ft02_probe(id INTEGER PRIMARY KEY);\nINSERT INTO ft02_probe VALUES (1);\n' }]);
  await createSchema('before_ft02', `CREATE TABLE native_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO native_migrations(filename) VALUES ('add-token-version.sql');
    CREATE FUNCTION lose_record() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.filename = '900-ft02-probe.sql' THEN RAISE EXCEPTION 'synthetic ledger failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER lose_record BEFORE INSERT ON native_migrations FOR EACH ROW EXECUTE FUNCTION lose_record();`);
  const failed = oldRunner(probeRoot, [], urlFor('before_ft02'));
  report('FT02', 'before', 'old runner reports failure', 1, failed.status);
  report('FT02', 'before', 'SQL effects left committed after ledger failure', 1,
    Number((await q('SELECT count(*) FROM before_ft02.ft02_probe')).rows[0].count));
  report('FT02', 'before', 'file left unrecorded', 0,
    Number((await q(`SELECT count(*) FROM before_ft02.native_migrations WHERE filename='900-ft02-probe.sql'`)).rows[0].count));
  await q('DROP TRIGGER lose_record ON before_ft02.native_migrations');
  const retried = oldRunner(probeRoot, [], urlFor('before_ft02'));
  report('FT02', 'before', 'promised resume re-executes the applied SQL and fails', true,
    retried.status === 1 && /already exists/.test(retried.output));
  // After: a ledger refusal inside the runner transaction rolls back the step.
  await createSchema('after_ft02', bootstrap);
  await q('DROP TABLE after_ft02.native_operation_ip_rate_limits, after_ft02.native_operation_ip_rate_limit_gates');
  await migrate('after_ft02', { mode: 'adopt', profileId: 'rehearsly-pg-domain13-v1' });
  const historyBefore = (await q('SELECT to_jsonb(h) AS row FROM after_ft02.native_schema_history h ORDER BY ordinal')).rows;
  let injected = false;
  const injecting = async (query, options) => {
    if (!injected) {
      injected = true;
      await query(`CREATE FUNCTION after_ft02.lose_record() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.id = '009-operation-ip-rate-limits' THEN RAISE EXCEPTION 'synthetic ledger failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER lose_record BEFORE INSERT ON after_ft02.native_schema_history
        FOR EACH ROW EXECUTE FUNCTION after_ft02.lose_record()`);
    }
    return inspectSchema(query, options);
  };
  report('FT02', 'after', 'runner reports failure', 'MIGRATION_FAILED',
    await migrationCode(() => migrate('after_ft02', { mode: 'apply' }, { inspectSchema: injecting })));
  report('FT02', 'after', 'step SQL rolled back with its ledger row', null,
    (await q(`SELECT to_regclass('after_ft02.native_operation_ip_rate_limits') AS relation`)).rows[0].relation);
  report('FT02', 'after', 'history unchanged', JSON.stringify(historyBefore),
    JSON.stringify((await q('SELECT to_jsonb(h) AS row FROM after_ft02.native_schema_history h ORDER BY ordinal')).rows));
  const resumed = await migrate('after_ft02', { mode: 'apply' });
  report('FT02', 'after', 'explicit retry applies the step once', '009-operation-ip-rate-limits', resumed.stepIds.join(','));
  report('FT02', 'after', 'second retry is unchanged', 'unchanged', (await migrate('after_ft02', { mode: 'apply' })).outcome);

  // ===== FM01: historical date/time conversion and session TimeZone =====
  // The same modern schema, with rehearsals/availability in the pre-2025-12
  // DATE + TIME layout. Values are documented UTC wall times.
  const legacyLayout = `${bootstrap}
    ALTER TABLE native_rehearsals DROP COLUMN starts_at, DROP COLUMN ends_at,
      ADD COLUMN date DATE NOT NULL, ADD COLUMN start_time TIME NOT NULL, ADD COLUMN end_time TIME NOT NULL;
    ALTER TABLE native_user_availability DROP COLUMN starts_at, DROP COLUMN ends_at,
      ADD COLUMN date DATE NOT NULL, ADD COLUMN start_time TIME, ADD COLUMN end_time TIME;
    INSERT INTO native_users(email,first_name) VALUES('fm01@fixture.invalid','FM01');
    INSERT INTO native_projects(name) VALUES('FM01');
    INSERT INTO native_rehearsals(project_id,date,start_time,end_time) VALUES(1,'2025-09-10','10:00','12:00');
    INSERT INTO native_user_availability(user_id,date,start_time,end_time,is_all_day) VALUES
      (1,'2025-09-10','10:00','11:00',false),(1,'2025-09-11',NULL,NULL,true);
    CREATE TABLE native_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO native_migrations(filename) VALUES ('add-is-all-day-flag.sql');`;
  const conversionRoot = oldRoot('fm01', [{ name: 'migrate-availability-to-timestamptz.sql' }, { name: 'migrate-rehearsals-to-timestamptz.sql' }]);
  const instants = async schema => ({
    rehearsal: (await q(`SELECT to_char(starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') AS s FROM ${schema}.native_rehearsals`)).rows[0].s,
    allDay: (await q(`SELECT to_char(starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') AS s FROM ${schema}.native_user_availability WHERE is_all_day`)).rows[0].s,
  });
  await createSchema('before_fm01_utc', legacyLayout);
  report('FM01', 'before', 'control: old runner in a UTC session', 0, oldRunner(conversionRoot, [], urlFor('before_fm01_utc', 'UTC')).status);
  report('FM01', 'before', 'control: UTC session keeps documented UTC instants',
    JSON.stringify({ rehearsal: '2025-09-10T10:00Z', allDay: '2025-09-11T00:00Z' }), JSON.stringify(await instants('before_fm01_utc')));
  await createSchema('before_fm01', legacyLayout);
  report('FM01', 'before', 'old runner in an Asia/Jerusalem session', 0, oldRunner(conversionRoot, [], urlFor('before_fm01', 'Asia/Jerusalem')).status);
  report('FM01', 'before', 'non-UTC session shifts instants; all-day lands on the previous day',
    JSON.stringify({ rehearsal: '2025-09-10T07:00Z', allDay: '2025-09-10T21:00Z' }), JSON.stringify(await instants('before_fm01')));
  // After: no supported path executes a historical conversion. The legacy
  // layout is refused by every mode and left byte-for-byte unchanged.
  await createSchema('after_fm01', legacyLayout);
  const legacyRows = async () => JSON.stringify((await q(`SELECT (SELECT json_agg(r ORDER BY id) FROM after_fm01.native_rehearsals r) AS r,
    (SELECT json_agg(a ORDER BY id) FROM after_fm01.native_user_availability a) AS a`)).rows);
  const legacyBefore = [await legacyRows(), (await relations('after_fm01')).join(',')];
  const jerusalem = urlFor('after_fm01', 'Asia/Jerusalem');
  const legacyRun = (request) => runMigrations({ connectionString: jerusalem, schema: 'after_fm01', request, artifacts, inspectSchema });
  const legacyDry = await legacyRun({ mode: 'dry' });
  report('FM01', 'after', 'dry classifies the legacy layout', 'unmanaged-unrecognized', legacyDry.state);
  report('FM01', 'after', 'dry offers no action', '[]', JSON.stringify(legacyDry.eligibleActions));
  const issueCodes = new Set(legacyDry.diagnostics.flatMap(item => item.issues.map(issue => `${issue.code}:${issue.objectId}`)));
  report('FM01', 'after', 'refusal names the legacy time columns', true,
    ['COLUMN_UNEXPECTED:native_rehearsals.date', 'COLUMN_MISSING:native_rehearsals.starts_at',
      'COLUMN_UNEXPECTED:native_user_availability.start_time', 'COLUMN_MISSING:native_user_availability.ends_at'].every(code => issueCodes.has(code)));
  for (const profile of artifacts.profiles.filter(item => item.adopt)) {
    report('FM01', 'after', `adopt ${profile.id}`, 'PRECONDITION_FAILED', await migrationCode(() => legacyRun({ mode: 'adopt', profileId: profile.id })));
  }
  report('FM01', 'after', 'apply', 'LEGACY_HISTORY_UNVERIFIED', await migrationCode(() => legacyRun({ mode: 'apply' })));
  report('FM01', 'after', 'fresh', 'SCHEMA_UNRECOGNIZED', await migrationCode(() => legacyRun({ mode: 'fresh' })));
  report('FM01', 'after', 'rows and relations unchanged after every refusal', JSON.stringify(legacyBefore),
    JSON.stringify([await legacyRows(), (await relations('after_fm01')).join(',')]));
  const stepFiles = artifacts.steps.map(step => step.sql.file).sort();
  report('FM01', 'after', 'no historical conversion is a runnable step', false,
    stepFiles.some(file => /timestamptz|fix-date|drop-old|001-/.test(file)));

  // ===== FM02: repeated OAuth backfill =====
  // Before: the old runner's supported SQLite path. The ledger INSERT is lost
  // after 001 ran (FT02), and the promised resume replays the backfill.
  const oauthRoot = oldRoot('fm02', [{ name: '001-add-oauth-providers.sql' }]);
  const sqlitePath = path.join(oauthRoot, 'database/data.sqlite');
  const seed = new Database(sqlitePath);
  seed.exec(`CREATE TABLE native_users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT,
      first_name TEXT, created_at TEXT, updated_at TEXT, last_login_at TEXT);
    INSERT INTO native_users(email,password_hash,first_name,created_at,updated_at) VALUES
      ('one@fixture.invalid','synthetic-hash-1','One','2025-01-01','2025-01-01'),
      ('two@fixture.invalid','synthetic-hash-2','Two','2025-01-01','2025-01-01'),
      ('oauth@fixture.invalid',NULL,'OAuth','2025-01-01','2025-01-01');
    CREATE TABLE native_migrations(filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO native_migrations(filename) VALUES ('add-token-version.sql');
    CREATE TRIGGER lose_record BEFORE INSERT ON native_migrations WHEN NEW.filename = '001-add-oauth-providers.sql'
      BEGIN SELECT RAISE(ABORT, 'synthetic ledger failure'); END;`);
  seed.close();
  const emailRows = () => { const db = new Database(sqlitePath, { readonly: true });
    try { return db.prepare(`SELECT count(*) AS n, count(DISTINCT user_id) AS users FROM native_auth_providers WHERE provider_type='email'`).get(); }
    finally { db.close(); } };
  report('FM02', 'before', 'first run fails on the lost ledger record', 1, oldRunner(oauthRoot, []).status);
  report('FM02', 'before', 'backfill already committed', JSON.stringify({ n: 2, users: 2 }), JSON.stringify(emailRows()));
  { const db = new Database(sqlitePath); db.exec('DROP TRIGGER lose_record'); db.close(); }
  report('FM02', 'before', 'resume succeeds', 0, oldRunner(oauthRoot, []).status);
  report('FM02', 'before', 'resume duplicated every email provider', JSON.stringify({ n: 4, users: 2 }), JSON.stringify(emailRows()));
  // After: no SQLite path, and 001 is not executable on PostgreSQL at all.
  const serverSqlite = path.join(server, 'database/data.sqlite');
  const hadServerSqlite = existsSync(serverSqlite);
  report('FM02', 'after', 'CLI without a PostgreSQL URL', 'CONFIG_INVALID', (await emitCLI(['--apply'], {})).output.code);
  report('FM02', 'after', 'CLI with a SQLite URL', 'CONFIG_INVALID', (await emitCLI(['--apply'], { DATABASE_URL: `file:${sqlitePath}` })).output.code);
  report('FM02', 'after', 'no SQLite database file created', hadServerSqlite, existsSync(serverSqlite));
  report('FM02', 'after', 'no step executes 001', false, stepFiles.some(file => file.includes('001-add-oauth-providers')));
  await createSchema('after_fm02');
  await q('BEGIN');
  const pg001 = await sqlState(async () => { await q('SET LOCAL search_path TO after_fm02');
    await q(readFileSync(path.join(server, 'migrations/001-add-oauth-providers.sql'), 'utf8')); });
  await q('ROLLBACK');
  report('FM02', 'after', '001 cannot run on PostgreSQL (SQLite dialect)', '42601', pg001);
} finally {
  if (control) await control.end().catch(() => {});
  if (container) {
    const label = cli('inspect', container, '--format', '{{index .Config.Labels "rehearsly.r2ba"}}');
    if (label === nonce) cli('stop', container);
  }
  rmSync(scratch, { recursive: true, force: true });
}
const failures = results.filter(ok => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', checks: results.length, failures }));
process.exitCode = failures ? 1 : 0;
