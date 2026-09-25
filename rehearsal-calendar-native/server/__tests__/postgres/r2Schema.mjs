import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from '../../database/schema/inspect.mjs';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';
import { checkSchemaHttp } from './r2SchemaHttp.mjs';

const schemaSql=readFileSync(new URL('../../database/init-native-schema.sql',import.meta.url),'utf8');
const groupTables={
  '007':['native_member_availability_rate_limits'],
  '008':['native_invite_account_rate_limits','native_invite_ip_rate_limits','native_invite_ip_rate_limit_gate'],
  '009':['native_operation_ip_rate_limits','native_operation_ip_rate_limit_gates'],
  '010':['native_email_codes','native_email_identities'],
};

// Only invoked after probe.mjs verifies its freshly owned disposable database.
// This scenario starts with the empty r0_fixture schema, never fixture.sql.
export async function probeR2Schema({connectionString,control,allowedPorts}) {
  const client=control;
  const inspect=inspectSchema;
  const query=client.query.bind(client);
  const artifacts=await loadArtifacts(manifest,fileURLToPath(new URL('../../',import.meta.url)));
  const migrate=(schema,request)=>runMigrations({connectionString,schema,request,artifacts,inspectSchema});
  const report=[];
  const check=async(schema,profile='rehearsly-pg-current-v1')=>inspect(query,{schema,profile});
  const create=async(name)=>{
    await query(`CREATE SCHEMA ${name}`);await query(`SET search_path TO ${name},pg_catalog`);await query(schemaSql);
  };
  const pass=(name)=>{report.push(name);console.log(JSON.stringify({check:name,outcome:'PASS'}));};
  async function withMutation(name,sql,code,profile='rehearsly-pg-current-v1') {
    await query('BEGIN');
    try {
      await query('SET LOCAL search_path TO r0_fixture,pg_catalog');
      await query(sql);
      const result=await check('r0_fixture',profile);
      assert.equal(result.compatible,false,name);
      assert.ok(result.issues.some(issue=>issue.code===code),name+': '+JSON.stringify(result.issues));
    } finally {await query('ROLLBACK');}
    assert.equal((await check('r0_fixture')).compatible,true);
    pass(name);
  }
  assert.equal((await migrate('r0_fixture',{mode:'fresh'})).outcome,'applied');
  const baseline=await check('r0_fixture');
  assert.equal(baseline.compatible,true);pass('actual fresh catalog');
  await withMutation('missing conflict target', 'DROP INDEX idx_availability_imported_event','CONFLICT_TARGET_MISSING');
  await withMutation('same-name wrong key', 'DROP INDEX idx_availability_imported_event; CREATE UNIQUE INDEX idx_availability_imported_event ON native_user_availability(user_id,title)','CONFLICT_TARGET_MISSING');
  await withMutation('reserved nonunique name refuses repair preflight', 'DROP INDEX idx_availability_imported_event; CREATE INDEX idx_availability_imported_event ON native_user_availability(title)','RESERVED_OBJECT_CONFLICT','rehearsly-pg-domain13-pre-import-key-v1');
  await withMutation('reserved name on wrong table refuses repair preflight', 'DROP INDEX idx_availability_imported_event; CREATE INDEX idx_availability_imported_event ON native_users(id)','RESERVED_OBJECT_CONFLICT','rehearsly-pg-domain13-pre-import-key-v1');
  await withMutation('reserved relation name refuses repair preflight', 'DROP INDEX idx_availability_imported_event; CREATE TABLE idx_availability_imported_event(marker text)','RESERVED_OBJECT_CONFLICT','rehearsly-pg-domain13-pre-import-key-v1');
  await withMutation('partial conflict target', 'DROP INDEX idx_availability_imported_event; CREATE UNIQUE INDEX idx_availability_imported_event ON native_user_availability(user_id,external_event_id,source) WHERE external_event_id IS NOT NULL','CONFLICT_TARGET_MISSING');
  await withMutation('deferrable conflict target', 'DROP INDEX idx_availability_imported_event; ALTER TABLE native_user_availability ADD UNIQUE(user_id,external_event_id,source) DEFERRABLE','CONFLICT_TARGET_MISSING');
  await withMutation('NULLS NOT DISTINCT is not the manual-row contract', 'DROP INDEX idx_availability_imported_event; CREATE UNIQUE INDEX idx_availability_imported_event ON native_user_availability(user_id,external_event_id,source) NULLS NOT DISTINCT','CONFLICT_TARGET_MISSING');
  await withMutation('old reminder unique still restrictive', 'ALTER TABLE native_push_reminders ADD UNIQUE(rehearsal_id,reminder_type)','UNKNOWN_RESTRICTIVE_OBJECT');
  await withMutation('extra unique on a lookup key', 'CREATE UNIQUE INDEX bad_unique ON native_users(week_start_day)','UNKNOWN_RESTRICTIVE_OBJECT');
  await withMutation('required check not validated', 'ALTER TABLE native_user_availability DROP CONSTRAINT native_user_availability_check; ALTER TABLE native_user_availability ADD CHECK(ends_at>starts_at) NOT VALID','REQUIRED_CONSTRAINT_MISSING');
  await withMutation('foreign key wrong action', 'ALTER TABLE native_project_members DROP CONSTRAINT native_project_members_user_id_fkey; ALTER TABLE native_project_members ADD FOREIGN KEY(user_id) REFERENCES native_users(id) ON DELETE RESTRICT','REQUIRED_CONSTRAINT_MISSING');
  await withMutation('notification index wrong ordering', 'DROP INDEX idx_notifications_user_created; CREATE INDEX idx_notifications_user_created ON native_notifications(user_id,created_at ASC)','REQUIRED_INDEX_MISSING');
  await withMutation('notification index wrong predicate', 'DROP INDEX idx_notifications_user_unread; CREATE INDEX idx_notifications_user_unread ON native_notifications(user_id) WHERE read_at IS NOT NULL','REQUIRED_INDEX_MISSING');
  await withMutation('RLS is rejected', 'ALTER TABLE native_users ENABLE ROW LEVEL SECURITY','RELATION_POLICY_MISMATCH');
  await withMutation('unknown CHECK is rejected', 'ALTER TABLE native_users ADD CHECK(length(email)>100)','UNKNOWN_RESTRICTIVE_OBJECT');
  await withMutation('unknown expression index is rejected', 'CREATE INDEX unknown_expression ON native_users((length(email)))','INDEX_UNEXPECTED');
  await withMutation('unknown trigger is rejected', "CREATE FUNCTION trigger_body() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$; CREATE TRIGGER new_trigger BEFORE INSERT ON native_users FOR EACH ROW EXECUTE FUNCTION trigger_body()",'RELATION_POLICY_MISMATCH');
  await query('BEGIN');
  try {
    await query('SET LOCAL search_path TO r0_fixture,pg_catalog');
    await query('ALTER TABLE native_project_members DISABLE TRIGGER ALL');
    assert.equal((await query(`SELECT bool_and(convalidated) AS validated FROM pg_catalog.pg_constraint
      WHERE conrelid='native_project_members'::regclass AND contype='f'`)).rows[0].validated,true);
    await query("INSERT INTO native_project_members(user_id,project_id) VALUES(2000000000,2000000000)");
    assert.equal(Number((await query('SELECT count(*) FROM native_project_members WHERE user_id=2000000000')).rows[0].count),1);
    const state=await check('r0_fixture');
    assert.equal(state.compatible,false);
    assert.ok(state.issues.some(issue=>issue.code==='FOREIGN_KEY_ENFORCEMENT_DISABLED'));
  } finally {await query('ROLLBACK');}
  assert.equal((await check('r0_fixture')).compatible,true);
  pass('disabled internal FK triggers permit an orphan despite validated metadata and are refused');
  await withMutation('different timestamp type is rejected', 'ALTER TABLE native_bug_reports ALTER COLUMN created_at TYPE timestamp without time zone','COLUMN_SHAPE_MISMATCH');
  await withMutation('nullable auth password must remain nullable', 'ALTER TABLE native_users ALTER COLUMN password_hash SET NOT NULL','COLUMN_SHAPE_MISMATCH');
  await withMutation('missing identity ownership is rejected', 'ALTER TABLE native_users ALTER COLUMN id DROP IDENTITY','COLUMN_SHAPE_MISMATCH');
  await query('BEGIN');
  try {
    await query('SET LOCAL search_path TO r0_fixture,pg_catalog');
    await query(`ALTER TABLE native_users ALTER COLUMN id DROP IDENTITY;
      CREATE SEQUENCE serial_fixture_id AS integer OWNED BY native_users.id;
      ALTER TABLE native_users ALTER COLUMN id SET DEFAULT nextval('serial_fixture_id'::regclass);
      ALTER INDEX idx_availability_imported_event RENAME TO equivalent_import_key`);
    const state=await check('r0_fixture');
    assert.equal(state.compatible,true,JSON.stringify(state.issues));
    assert.equal(state.evidenceSha256,baseline.evidenceSha256);
  } finally {await query('ROLLBACK');}
  pass('owned int4 serial generator and renamed equivalent index retain the same contract');
  await query('BEGIN');
  try {
    await query('SET LOCAL search_path TO r0_fixture,pg_catalog');
    await query('DROP INDEX idx_availability_imported_event; ALTER TABLE native_user_availability ADD UNIQUE(user_id,external_event_id,source)');
    const state=await check('r0_fixture');
    assert.equal(state.compatible,true,JSON.stringify(state.issues));
    assert.equal(state.evidenceSha256,baseline.evidenceSha256);
  } finally {await query('ROLLBACK');}
  pass('immediate equivalent UNIQUE constraint provides the same conflict target');
  await withMutation('partial budget group is rejected', 'DROP TABLE native_invite_ip_rate_limits','BUDGET_GROUP_PARTIAL','rehearsly-pg-domain13-v1');
  await withMutation('gate count mismatch is rejected', 'UPDATE native_operation_ip_rate_limit_gates SET key_count=1 WHERE operation=\'auth\'','GATE_COUNT_MISMATCH');
  await query('BEGIN');
  try {
    await query('SET LOCAL search_path TO r0_fixture,pg_catalog');
    await query(`CREATE SCHEMA r2_schema_outside;
      CREATE TABLE r2_schema_outside.sentinel(user_id integer REFERENCES r0_fixture.native_users(id) ON DELETE RESTRICT,marker text);
      WITH u AS (INSERT INTO native_users(email,first_name) VALUES('external-edge@fixture.invalid','External edge') RETURNING id)
      INSERT INTO r2_schema_outside.sentinel SELECT id,'untouched' FROM u`);
    const before=(await query('SELECT * FROM r2_schema_outside.sentinel')).rows;
    const result=await check('r0_fixture');
    assert.equal(result.compatible,false);
    assert.ok(result.issues.some(issue=>issue.code==='INCOMING_FOREIGN_KEY_UNRECOGNIZED'));
    assert.deepEqual((await query('SELECT * FROM r2_schema_outside.sentinel')).rows,before);
  } finally {await query('ROLLBACK');}
  pass('unknown incoming FK refuses adoption without touching external sentinel');
  await query('SET search_path TO r0_fixture,pg_catalog');
  const invalidIds=(await query("INSERT INTO native_users(email,first_name) VALUES('invalid-one@fixture.invalid','same'),('invalid-two@fixture.invalid','same') RETURNING id")).rows.map(row=>row.id);
  try {
    await assert.rejects(query('CREATE UNIQUE INDEX CONCURRENTLY invalid_owned_index ON native_users(first_name)'), {code:'23505'});
    assert.ok((await check('r0_fixture')).issues.some(issue=>issue.code==='INDEX_NOT_USABLE'));
  } finally {
    await query('DROP INDEX IF EXISTS invalid_owned_index');
    await query('DELETE FROM native_users WHERE id=ANY($1::integer[])',[invalidIds]);
  }
  assert.equal((await check('r0_fixture')).compatible,true);
  pass('actual failed concurrent unique build leaves an unusable index and is refused');
  await create('r2_schema_modern');
  await query("INSERT INTO native_users(email,first_name,created_at,updated_at) VALUES('preserve@fixture.invalid','  Keep  ','2026-01-02T03:04:05Z','2026-01-02T03:04:05Z')");
  await query("INSERT INTO native_user_availability(user_id,starts_at,ends_at,title,external_event_id) VALUES(1,'2026-10-01T10:00Z','2026-10-01T11:00Z','keep1',NULL),(1,'2026-10-02T10:00Z','2026-10-02T11:00Z','keep2',NULL),(1,'2026-10-03T10:00Z','2026-10-03T11:00Z','keep3','imported-1')");
  const before=(await query('SELECT row_to_json(a) AS row FROM native_user_availability a ORDER BY id')).rows;
  const usersBefore=(await query('SELECT row_to_json(u) AS row FROM native_users u ORDER BY id')).rows;
  for(const names of Object.values(groupTables)) for(const table of names) await query(`DROP TABLE ${table}`);
  await query('DROP INDEX idx_availability_imported_event');
  await assert.rejects(query(`INSERT INTO native_user_availability(user_id,starts_at,ends_at,external_event_id)
    VALUES(1,'2026-11-01T10:00Z','2026-11-01T11:00Z','missing-key-proof')
    ON CONFLICT(user_id,external_event_id,source) DO NOTHING`),{code:'42P10'});
  assert.deepEqual((await query('SELECT row_to_json(a) AS row FROM native_user_availability a ORDER BY id')).rows,before);
  pass('deliberate missing-key fixture reproduces the actual PostgreSQL 42P10 failure without row changes');
  assert.equal((await check('r2_schema_modern','rehearsly-pg-domain13-v1')).compatible,false);
  const predecessor=await check('r2_schema_modern','rehearsly-pg-domain13-pre-import-key-v1');
  assert.equal(predecessor.compatible,true,JSON.stringify(predecessor.issues));
  assert.deepEqual(predecessor.repairCandidates,[{id:'availability-conflict-key-v1',profileId:'rehearsly-pg-domain13-pre-import-key-v1'}]);
  await query(`CREATE TABLE native_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL);
    INSERT INTO native_migrations VALUES('005-unique-imported-event.sql','2026-01-02T03:04:05Z')`);
  const legacyBefore=(await query('SELECT * FROM native_migrations')).rows;
  assert.equal((await migrate('r2_schema_modern',{mode:'adopt',profileId:'rehearsly-pg-domain13-pre-import-key-v1'})).outcome,'applied');
  assert.equal((await check('r2_schema_modern','rehearsly-pg-domain13-pre-import-key-v1')).compatible,true);
  const applied=await migrate('r2_schema_modern',{mode:'apply'});
  assert.deepEqual(applied.stepIds,manifest.steps.map(step=>step.id));
  assert.deepEqual((await query('SELECT id,kind FROM native_schema_history ORDER BY ordinal')).rows,
    [{id:'rehearsly-pg-domain13-pre-import-key-v1',kind:'adopt'},...manifest.steps.map(step=>({id:step.id,kind:'migration'}))]);
  assert.deepEqual((await query('SELECT * FROM native_migrations')).rows,legacyBefore);
  const upgraded=await check('r2_schema_modern');
  assert.equal(upgraded.compatible,true,JSON.stringify(upgraded.issues));
  assert.equal(upgraded.evidenceSha256,baseline.evidenceSha256);
  assert.deepEqual((await query('SELECT row_to_json(a) AS row FROM native_user_availability a ORDER BY id')).rows,before);
  assert.deepEqual((await query('SELECT row_to_json(u) AS row FROM native_users u ORDER BY id')).rows,usersBefore);
  assert.equal((await migrate('r2_schema_modern',{mode:'apply'})).outcome,'unchanged');
  pass('real runner adoption and repair-first batch preserve rows and legacy ledger and match runner fresh catalog');
  await query('BEGIN');
  try {
    await query('DROP INDEX idx_availability_imported_event');
    await query("INSERT INTO native_user_availability(user_id,starts_at,ends_at,external_event_id) VALUES(1,'2026-10-04T10:00Z','2026-10-04T11:00Z','imported-1')");
    const state=await check('r2_schema_modern','rehearsly-pg-domain13-pre-import-key-v1');
    assert.equal(state.compatible,false);
    assert.ok(state.issues.some(issue=>issue.code==='IMPORTED_EVENT_DUPLICATES'));
    assert.deepEqual(state.repairCandidates,[]);
    assert.equal(Number((await query('SELECT count(*) FROM native_user_availability')).rows[0].count),4);
  } finally {await query('ROLLBACK');}
  pass('duplicates refuse adoption and do not delete any row');
  const fingerprint=(await check('r2_schema_modern')).evidenceSha256;
  await query("INSERT INTO native_operation_ip_rate_limits(operation,ip_key,reset_at,request_count) VALUES('auth',repeat('a',64),1,1)");
  await query("UPDATE native_operation_ip_rate_limit_gates SET key_count=1 WHERE operation='auth'");
  const live=await check('r2_schema_modern');assert.equal(live.compatible,true);assert.equal(live.evidenceSha256,fingerprint);
  pass('consistent nonzero budget state is accepted without counter fingerprint drift');
  await create('r2_schema_partial');
  for(const table of groupTables['008']) await query(`DROP TABLE ${table}`);
  const partial=await check('r2_schema_partial','rehearsly-pg-domain13-v1');
  assert.equal(partial.compatible,true,JSON.stringify(partial.issues));
  assert.deepEqual(partial.frontier.budgets,Object.keys(groupTables).filter(group=>group!=='008'));
  await migrate('r2_schema_partial',{mode:'adopt',profileId:'rehearsly-pg-domain13-v1'});
  const oneGroup=await migrate('r2_schema_partial',{mode:'apply'});
  assert.deepEqual(oneGroup.stepIds,['008-invite-rate-limits']);
  assert.equal((await check('r2_schema_partial')).evidenceSha256,baseline.evidenceSha256);
  pass('modern adoption applies only the missing whole budget group');
  // FM01: the historical DATE+TIME→TIMESTAMPTZ files cast in the session zone.
  // No supported path may run them: the legacy layout is refused by every mode,
  // under a non-UTC session, and left exactly as it was.
  await create('r2_schema_legacy_time');
  await query(`ALTER TABLE native_rehearsals DROP COLUMN starts_at, DROP COLUMN ends_at,
      ADD COLUMN date DATE NOT NULL, ADD COLUMN start_time TIME NOT NULL, ADD COLUMN end_time TIME NOT NULL;
    ALTER TABLE native_user_availability DROP COLUMN starts_at, DROP COLUMN ends_at,
      ADD COLUMN date DATE NOT NULL, ADD COLUMN start_time TIME, ADD COLUMN end_time TIME;
    INSERT INTO native_users(email,first_name) VALUES('legacy-time@fixture.invalid','Legacy');
    INSERT INTO native_projects(name) VALUES('Legacy');
    INSERT INTO native_rehearsals(project_id,date,start_time,end_time) VALUES(1,'2025-09-10','10:00','12:00');
    INSERT INTO native_user_availability(user_id,date,is_all_day) VALUES(1,'2025-09-11',true);
    CREATE TABLE native_migrations(filename TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL);
    INSERT INTO native_migrations VALUES('add-is-all-day-flag.sql','2025-12-01T00:00:00Z')`);
  const legacyState=async()=>(await query(`SELECT
    (SELECT json_agg(r ORDER BY id) FROM r2_schema_legacy_time.native_rehearsals r) AS rehearsals,
    (SELECT json_agg(a ORDER BY id) FROM r2_schema_legacy_time.native_user_availability a) AS availability,
    (SELECT json_agg(c.relname ORDER BY c.relname) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
      ON n.oid=c.relnamespace WHERE n.nspname='r2_schema_legacy_time') AS relations`)).rows[0];
  const legacyTimeBefore=await legacyState();
  const jerusalem=new URL(connectionString);
  jerusalem.searchParams.set('options','-c TimeZone=Asia/Jerusalem');
  const legacyRun=request=>runMigrations({connectionString:jerusalem.href,schema:'r2_schema_legacy_time',request,artifacts,inspectSchema});
  const legacyDry=await legacyRun({mode:'dry'});
  assert.equal(legacyDry.state,'unmanaged-unrecognized');
  assert.deepEqual(legacyDry.eligibleActions,[]);
  const legacyIssues=new Set(legacyDry.diagnostics.flatMap(item=>item.issues.map(issue=>`${issue.code}:${issue.objectId}`)));
  for (const issue of ['COLUMN_UNEXPECTED:native_rehearsals.date','COLUMN_MISSING:native_rehearsals.starts_at',
    'COLUMN_UNEXPECTED:native_user_availability.start_time','COLUMN_MISSING:native_user_availability.ends_at']) assert.ok(legacyIssues.has(issue),issue);
  for (const profile of manifest.profiles.filter(item=>item.adopt)) {
    await assert.rejects(legacyRun({mode:'adopt',profileId:profile.id}),{code:'PRECONDITION_FAILED'});
  }
  await assert.rejects(legacyRun({mode:'apply'}),{code:'LEGACY_HISTORY_UNVERIFIED'});
  await assert.rejects(legacyRun({mode:'fresh'}),{code:'SCHEMA_UNRECOGNIZED'});
  assert.deepEqual(await legacyState(),legacyTimeBefore);
  pass('legacy DATE/TIME layout is refused by every mode in a non-UTC session and left unchanged');
  // FM01/FM02: historical files are ledger names only. The runnable set is the
  // reviewed forward steps; 001's SQLite backfill cannot even parse on PostgreSQL,
  // and the runner accepts no non-PostgreSQL target.
  assert.deepEqual(manifest.steps.map(step=>step.sql.file).sort(),['database/schema/availability-conflict-key-v1.sql',
    'migrations/007-member-availability-rate-limit.sql','migrations/008-invite-rate-limits.sql','migrations/009-operation-ip-rate-limits.sql',
    'migrations/010-email-verification.sql']);
  await query('BEGIN');
  try {
    await query('SET LOCAL search_path TO r2_schema_legacy_time,pg_catalog');
    await assert.rejects(query(readFileSync(new URL('../../migrations/001-add-oauth-providers.sql',import.meta.url),'utf8')),{code:'42601'});
  } finally {await query('ROLLBACK');}
  for (const url of ['file:/private/tmp/r2-no-sqlite.sqlite','sqlite:///private/tmp/r2-no-sqlite.sqlite']) {
    await assert.rejects(runMigrations({connectionString:url,schema:'public',request:{mode:'dry'},artifacts,inspectSchema}),{code:'CONFIG_INVALID'});
  }
  pass('no historical conversion or backfill is runnable; non-PostgreSQL targets are refused');
  const http=[];
  for (const schema of ['r0_fixture','r2_schema_modern']) {
    http.push(await checkSchemaHttp({connectionString,control,allowedPorts,schema}));
    assert.equal((await check(schema)).compatible,true);
    pass('actual HTTP contracts on '+schema);
  }
  return {outcome:'PASS',checks:report.length,catalogTables:21,http};
}
