import pg from 'pg';
import { MigrationError, fail } from './errors.mjs';
import { canonical, sha256, assertValidatedArtifacts, validateFrontier, needsStep, advance, stepsForRoot } from './artifacts.mjs';
import { quote, inspectLegacy, inspectHistory, isEmpty, createHistory, record } from './history.mjs';

export { MigrationError } from './errors.mjs';
export { validateArtifacts, loadArtifacts } from './artifacts.mjs';
export const migrationPolicy = Object.freeze({ connectionTimeoutMillis: 2000, query_timeout: 35000,
  statementTimeoutMs: 30000, lockTimeoutMs: 1000 });
// Fixed across schemas and runner processes in the same PostgreSQL database.
const executorKey = Object.freeze([1919248499, 1835624306]);

async function lockTargets(query, schema, artifacts) {
  const names = [...new Set([...artifacts.lockTables, 'native_migrations', 'native_schema_history'])].sort();
  const rows = (await query(`SELECT c.relname,c.relkind FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) ORDER BY c.relname`, [schema, names])).rows;
  if (rows.some(row => !['r', 'p'].includes(row.relkind))) fail('SCHEMA_UNRECOGNIZED');
  if (rows.length) await query(`LOCK TABLE ${rows.map(row => `${quote(schema)}.${quote(row.relname)}`).join(',')}
    IN SHARE ROW EXCLUSIVE MODE`);
}

export function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.some(value => typeof value !== 'string')) fail('USAGE_INVALID', 2);
  if (!argv.length) return Object.freeze({ mode: 'apply' });
  if (argv.length === 1 && ['--apply', '--dry', '--fresh', '--help'].includes(argv[0])) {
    return Object.freeze({ mode: argv[0].slice(2) });
  }
  if (argv.length === 2 && argv[0] === '--adopt' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(argv[1])) {
    return Object.freeze({ mode: 'adopt', profileId: argv[1] });
  }
  if (argv.includes('--baseline')) fail('BASELINE_UNSUPPORTED', 2);
  fail('USAGE_INVALID', 2);
}

function configuration(connectionString, schema, request) {
  if (typeof connectionString !== 'string' || !connectionString.trim()
    || typeof schema !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(schema) || schema.startsWith('pg_')) fail('CONFIG_INVALID', 2);
  try {
    const target = new URL(connectionString.trim());
    if (!['postgres:', 'postgresql:'].includes(target.protocol) || !target.hostname || target.pathname.length < 2) fail('CONFIG_INVALID', 2);
  } catch { fail('CONFIG_INVALID', 2); }
  if (!request || !['dry', 'apply', 'fresh', 'adopt'].includes(request.mode)
    || Object.keys(request).some(key => !['mode', 'profileId'].includes(key))
    || (request.mode === 'adopt' ? typeof request.profileId !== 'string' : request.profileId !== undefined)) fail('USAGE_INVALID', 2);
  return connectionString.trim();
}

async function checkedInspection(inspectSchema, query, schema, profile) {
  const result = await inspectSchema(query, { schema, profile });
  if (!result || typeof result.compatible !== 'boolean') fail('POSTCONDITION_FAILED');
  if (!result.compatible) {
    const issues = (Array.isArray(result.issues) ? result.issues : []).slice(0, 100).map(issue => ({
      code: typeof issue?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(issue.code) ? issue.code : 'SCHEMA_INCOMPATIBLE',
      objectId: typeof issue?.objectId === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(issue.objectId)
        ? issue.objectId : `object:${sha256(String(issue?.objectId ?? '')).slice(0, 16)}`,
    }));
    return { compatible: false, diagnostics: { profileId: profile, issues } };
  }
  if (!/^[0-9a-f]{64}$/.test(result.evidenceSha256)) fail('POSTCONDITION_FAILED');
  return { compatible: true, evidenceSha256: result.evidenceSha256, frontier: validateFrontier(result.frontier) };
}

async function observe(query, schema, artifacts, inspectSchema, request) {
  const legacy = await inspectLegacy(query, schema, artifacts);
  const history = await inspectHistory(query, schema, artifacts, legacy);
  const inspections = {};
  const empty = await isEmpty(query, schema);
  if (history) {
    const last = history.rows.at(-1);
    const profile = last.kind === 'migration'
      ? artifacts.steps.find(step => step.id === last.id).verifyProfile : history.profile.id;
    const actual = await checkedInspection(inspectSchema, query, schema, profile);
    if (!actual.compatible || canonical(actual.frontier) !== canonical(history.frontier)) fail('PRECONDITION_FAILED', 1,
      actual.diagnostics ? [actual.diagnostics] : undefined);
    inspections[profile] = actual;
  } else if (!empty) {
    const candidates = request.mode === 'adopt' ? artifacts.profiles.filter(profile => profile.id === request.profileId)
      : request.mode === 'dry' ? artifacts.profiles.filter(profile => profile.adopt) : [];
    for (const profile of candidates) inspections[profile.id] = await checkedInspection(inspectSchema, query, schema, profile.id);
  }
  return { legacy, history, inspections, empty };
}

export function buildPlan({ request, observations, artifacts }) {
  assertValidatedArtifacts(artifacts);
  const { history, inspections, empty } = observations;
  if (history) {
    let frontier = history.frontier;
    const pending = [];
    for (const step of stepsForRoot(artifacts, history.root.id)) {
      if (needsStep(step, frontier)) { pending.push(step.id); frontier = advance(step, frontier); }
    }
    if (!frontier.availabilityConflictKey || canonical(frontier.budgets) !== canonical(['007', '008', '009'])) fail('ARTIFACT_INVALID', 2);
    return { state: 'managed', rootId: history.root.id, stepIds: pending, frontier, eligibleActions: ['apply'] };
  }
  const profiles = artifacts.profiles.filter(profile => profile.adopt && inspections[profile.id]?.compatible).map(profile => profile.id);
  return { state: empty ? 'empty' : profiles.length ? 'unmanaged-compatible' : 'unmanaged-unrecognized',
    stepIds: [], eligibleActions: empty ? ['fresh'] : profiles.map(id => `adopt:${id}`),
    diagnostics: Object.values(inspections).filter(item => !item.compatible).map(item => item.diagnostics) };
}

// One invocation owns one Client and one transaction; no pool.query, app adapter,
// environment discovery, SQL rewrite, generic SQL sandbox or automatic retry.
export async function runMigrations({ connectionString, schema = 'public', request, artifacts, inspectSchema }) {
  assertValidatedArtifacts(artifacts);
  const url = configuration(connectionString, schema, request);
  if (typeof inspectSchema !== 'function') fail('ARTIFACT_INVALID', 2);
  if (request.mode === 'adopt' && !artifacts.profiles.some(profile => profile.id === request.profileId && profile.adopt)) fail('USAGE_INVALID', 2);
  const client = new pg.Client({ connectionString: url, ...migrationPolicy,
    application_name: 'rehearsly-migrations' });
  let fault = false;
  client.on('error', () => { fault = true; });
  let begun = false;
  let commitAttempted = false;
  const query = (text, values = []) => client.query({ text, values, query_timeout: migrationPolicy.query_timeout });
  try {
    await client.connect();
    await query(request.mode === 'dry' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    begun = true;
    await query("SET LOCAL statement_timeout = '30s'");
    await query("SET LOCAL lock_timeout = '1s'");
    await query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    await query("SET LOCAL TIME ZONE 'UTC'");
    // pg_catalog is searched implicitly first, but CREATE uses this schema.
    await query("SELECT pg_catalog.set_config('search_path',$1,true)", [quote(schema)]);
    if (request.mode !== 'dry') {
      const locked = await query('SELECT pg_catalog.pg_try_advisory_xact_lock($1,$2) AS locked', executorKey);
      if (!locked.rows[0].locked) fail('MIGRATION_BUSY');
      // Curated table names only. Advisory locks coordinate migrators; these
      // ordinary table locks also hold existing app rows/catalog stable against
      // DML and conflicting DDL through commit. Not a lock on an empty namespace.
      await lockTargets(query, schema, artifacts);
    }
    const observed = await observe(query, schema, artifacts, inspectSchema, request);
    const plan = buildPlan({ request, observations: observed, artifacts });
    if (request.mode === 'dry') {
      await query('ROLLBACK');
      begun = false;
      return { outcome: 'planned', ...plan };
    }
    const applied = [];
    let rootId = plan.rootId;
    if (request.mode === 'fresh') {
      if (!observed.empty || observed.history || observed.legacy.present) fail('SCHEMA_UNRECOGNIZED');
      const profile = artifacts.profiles.find(item => item.id === artifacts.currentProfile);
      await query(profile.bootstrap.sql);
      const actual = await checkedInspection(inspectSchema, query, schema, profile.id);
      if (!actual.compatible || !actual.frontier.availabilityConflictKey
        || canonical(actual.frontier.budgets) !== canonical(['007', '008', '009'])) fail('POSTCONDITION_FAILED');
      await createHistory(query, schema);
      await record(query, schema, { ordinal: 0, id: profile.id, kind: 'fresh',
        artifactSha256: profile.bootstrap.sha256, descriptorSha256: profile.definitionSha256, frontier: actual.frontier });
      rootId = profile.id;
    } else if (request.mode === 'adopt') {
      if (observed.history) {
        if (observed.history.root.kind !== 'adopt' || observed.history.root.id !== request.profileId) fail('HISTORY_INVALID');
      } else {
        const profile = artifacts.profiles.find(item => item.id === request.profileId);
        const actual = observed.inspections[profile.id];
        if (!actual?.compatible) fail('PRECONDITION_FAILED', 1, actual?.diagnostics ? [actual.diagnostics] : undefined);
        await createHistory(query, schema);
        await record(query, schema, { ordinal: 0, id: profile.id, kind: 'adopt', artifactSha256: profile.descriptor.sha256,
          descriptorSha256: profile.definitionSha256, frontier: actual.frontier, legacyDigest: observed.legacy.digest });
        rootId = profile.id;
      }
    } else {
      if (!observed.history) fail('LEGACY_HISTORY_UNVERIFIED');
      let frontier = observed.history.frontier;
      let ordinal = observed.history.rows.length;
      for (const id of plan.stepIds) {
        const step = artifacts.steps.find(item => item.id === id);
        const expected = advance(step, frontier);
        await query(step.sql.sql);
        const actual = await checkedInspection(inspectSchema, query, schema, step.verifyProfile);
        if (!actual.compatible || canonical(actual.frontier) !== canonical(expected)) fail('POSTCONDITION_FAILED');
        await record(query, schema, { ordinal: ordinal++, id, kind: 'migration', artifactSha256: step.sql.sha256,
          descriptorSha256: step.definitionSha256, frontier: actual.frontier });
        frontier = actual.frontier;
        applied.push(id);
      }
      const lastRecorded = observed.history.rows.at(-1);
      const lastStepId = applied.at(-1) ?? (lastRecorded.kind === 'migration' ? lastRecorded.id : undefined);
      const completionProfile = lastStepId ? artifacts.steps.find(step => step.id === lastStepId).verifyProfile
        : observed.history.profile.completionProfile;
      const final = await checkedInspection(inspectSchema, query, schema, completionProfile);
      if (!final.compatible || canonical(final.frontier) !== canonical(frontier)) fail('POSTCONDITION_FAILED');
    }
    commitAttempted = true;
    const result = await query('COMMIT');
    if (result.command === 'ROLLBACK') { commitAttempted = false; begun = false; fail('MIGRATION_FAILED'); }
    if (result.command !== 'COMMIT') fail('MIGRATION_FAILED');
    begun = false;
    return { outcome: (request.mode === 'apply' && !applied.length)
      || (request.mode === 'adopt' && observed.history) ? 'unchanged' : 'applied',
      state: 'managed', rootId, stepIds: applied };
  } catch (error) {
    // Never promise rollback once COMMIT was sent: transport failure can conceal
    // a successful commit. A later explicit run must inspect the verified ledger.
    if (commitAttempted) throw new MigrationError('COMMIT_OUTCOME_UNKNOWN');
    const connectionUncertain = fault || error?.message === 'Query read timeout'
      || ['ECONNRESET','EPIPE','ETIMEDOUT'].includes(error?.code) || client.connection.stream.destroyed;
    if (begun && !connectionUncertain) {
      try { await query('ROLLBACK'); }
      catch { fault = true; }
    }
    throw error instanceof MigrationError ? error : new MigrationError('MIGRATION_FAILED');
  } finally {
    await client.end().catch(() => {});
  }
}
