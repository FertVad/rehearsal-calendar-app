import { canonical, sha256, validateFrontier, advance, stepsForRoot } from './artifacts.mjs';
import { fail } from './errors.mjs';

export const quote = value => `"${value.replaceAll('"', '""')}"`;
const historyName = schema => `${quote(schema)}.native_schema_history`;
const legacyName = schema => `${quote(schema)}.native_migrations`;
const expectedChecks = [
  'CHECK ((ordinal >= 0))',
  "CHECK ((kind = ANY (ARRAY['fresh'::text, 'adopt'::text, 'migration'::text])))",
  "CHECK ((artifact_sha256 ~ '^[0-9a-f]{64}$'::text))",
  "CHECK ((descriptor_sha256 ~ '^[0-9a-f]{64}$'::text))",
  "CHECK ((legacy_evidence_sha256 ~ '^[0-9a-f]{64}$'::text))",
  "CHECK ((((ordinal = 0) AND (kind = ANY (ARRAY['fresh'::text, 'adopt'::text]))) OR ((ordinal > 0) AND (kind = 'migration'::text))))",
  "CHECK ((((kind = 'adopt'::text) AND (legacy_evidence_sha256 IS NOT NULL)) OR ((kind <> 'adopt'::text) AND (legacy_evidence_sha256 IS NULL))))",
].sort();

async function relation(query, schema, name) {
  const rows = (await query(`SELECT c.oid::text, c.relkind,c.relpersistence,c.relispartition,c.relrowsecurity,c.relforcerowsecurity,
    EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid) AS inherited
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`, [schema, name])).rows;
  if (!rows.length) return undefined;
  if (rows.length !== 1 || rows[0].relkind !== 'r' || rows[0].relpersistence !== 'p'
    || rows[0].relispartition || rows[0].inherited || rows[0].relrowsecurity || rows[0].relforcerowsecurity) fail('HISTORY_INVALID');
  return rows[0];
}
async function shape(query, relationId, expected) {
  const columns = (await query(`SELECT a.attname, t.typname, a.attnotnull FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_type t ON t.oid=a.atttypid WHERE a.attrelid=$1::oid
    AND t.typnamespace='pg_catalog'::regnamespace
    AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [relationId])).rows;
  if (canonical(columns.map(row => [row.attname, row.typname, row.attnotnull])) !== canonical(expected)) fail('HISTORY_INVALID');
}

export async function inspectLegacy(query, schema, artifacts) {
  const table = await relation(query, schema, 'native_migrations');
  if (!table) return { present: false, digest: sha256(canonical({ present: false })), count: 0 };
  await shape(query, table.oid, [['filename', 'text', true], ['applied_at', 'timestamptz', true]]);
  const rows = (await query(`SELECT filename,pg_catalog.isfinite(applied_at) AS finite,
    to_char(applied_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS applied_at
    FROM ${legacyName(schema)} ORDER BY filename LIMIT 1001`)).rows;
  if (rows.length > 1000 || new Set(rows.map(row => row.filename)).size !== rows.length
    || rows.some(row => !row.finite || !artifacts.legacyFilenames.includes(row.filename))) fail('LEGACY_HISTORY_UNVERIFIED');
  return { present: true, digest: sha256(canonical({ present: true, rows: rows.map(({ filename, applied_at }) => ({ filename, applied_at })) })), count: rows.length };
}

export async function inspectHistory(query, schema, artifacts, legacy) {
  const table = await relation(query, schema, 'native_schema_history');
  if (!table) return undefined;
  await shape(query, table.oid, [['ordinal', 'int4', true], ['id', 'text', true], ['kind', 'text', true],
    ['artifact_sha256', 'text', true], ['descriptor_sha256', 'text', true], ['frontier', 'jsonb', true],
    ['legacy_evidence_sha256', 'text', false], ['recorded_at', 'timestamptz', true]]);
  const definitions = (await query(`SELECT a.attname,a.attidentity,a.attgenerated,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=$1::oid AND a.attnum>0 AND NOT a.attisdropped`, [table.oid])).rows;
  if (definitions.some(row => row.attidentity || row.attgenerated
    || row.default_expression !== (row.attname === 'recorded_at' ? 'clock_timestamp()' : null))) fail('HISTORY_INVALID');
  const dangerous = (await query(`SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=$1::oid AND NOT tgisinternal)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class=$1::oid) AS present`, [table.oid])).rows[0].present;
  if (dangerous) fail('HISTORY_INVALID');
  const constraints = (await query(`SELECT c.contype,c.convalidated,c.condeferrable,c.conindid::text AS index_id,pg_catalog.pg_get_constraintdef(c.oid) AS definition,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns
    FROM pg_catalog.pg_constraint c WHERE c.conrelid=$1::oid`, [table.oid])).rows;
  if (constraints.some(row => !row.convalidated || row.condeferrable || !['p','u','c'].includes(row.contype))
    || constraints.filter(row => row.contype === 'p' && canonical(row.columns) === '["ordinal"]').length !== 1
    || constraints.filter(row => row.contype === 'u' && canonical(row.columns) === '["id"]').length !== 1
    || constraints.filter(row => row.contype === 'p' || row.contype === 'u').length !== 2
    || canonical(constraints.filter(row => row.contype === 'c').map(row => row.definition).sort()) !== canonical(expectedChecks)) fail('HISTORY_INVALID');
  const indexes = (await query(`SELECT indexrelid::text AS id,indisvalid,indisready,indimmediate,
    indexprs IS NULL AND indpred IS NULL AS plain FROM pg_catalog.pg_index
    WHERE indrelid=$1::oid AND indisunique`, [table.oid])).rows;
  const expectedIndexes = constraints.filter(row => ['p','u'].includes(row.contype)).map(row => row.index_id).sort();
  if (canonical(indexes.map(row => row.id).sort()) !== canonical(expectedIndexes)
    || indexes.some(row => !row.indisvalid || !row.indisready || !row.indimmediate || !row.plain)) fail('HISTORY_INVALID');
  const rows = (await query(`SELECT ordinal,id,kind,artifact_sha256,descriptor_sha256,frontier,
    legacy_evidence_sha256 FROM ${historyName(schema)} ORDER BY ordinal LIMIT 102`)).rows;
  if (!rows.length || rows.length > 101) fail('HISTORY_INVALID');
  const root = rows[0];
  const profile = artifacts.profiles.find(item => item.id === root.id);
  if (!profile || root.ordinal !== 0 || !['fresh', 'adopt'].includes(root.kind)
    || (root.kind === 'fresh' ? !profile.fresh : !profile.adopt)
    || root.descriptor_sha256 !== profile.definitionSha256
    || root.artifact_sha256 !== (root.kind === 'fresh' ? profile.bootstrap.sha256 : profile.descriptor.sha256)
    || (root.kind === 'fresh' ? (root.legacy_evidence_sha256 !== null || legacy.present)
      : root.legacy_evidence_sha256 !== legacy.digest)) fail('HISTORY_INVALID');
  let frontier = validateFrontier(root.frontier);
  const seen = new Set();
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const step = artifacts.steps.find(item => item.id === row.id);
    const next = stepsForRoot(artifacts, root.id).find(item => item.when.missingAvailabilityKey
      ? !frontier.availabilityConflictKey : !frontier.budgets.includes(item.when.missingBudget));
    if (!step || row.ordinal !== index || row.kind !== 'migration' || seen.has(row.id)
      || next?.id !== row.id
      || row.legacy_evidence_sha256 !== null || row.artifact_sha256 !== step.sql.sha256
      || row.descriptor_sha256 !== step.definitionSha256) fail('HISTORY_INVALID');
    seen.add(row.id);
    frontier = advance(step, frontier);
    if (canonical(frontier) !== canonical(validateFrontier(row.frontier))) fail('HISTORY_INVALID');
  }
  return { rows, root, profile, frontier };
}

export async function createHistory(query, schema) {
  await query(`CREATE TABLE ${historyName(schema)} (
    ordinal INTEGER PRIMARY KEY CHECK (ordinal >= 0), id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('fresh','adopt','migration')),
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    descriptor_sha256 TEXT NOT NULL CHECK (descriptor_sha256 ~ '^[0-9a-f]{64}$'),
    frontier JSONB NOT NULL,
    legacy_evidence_sha256 TEXT CHECK (legacy_evidence_sha256 ~ '^[0-9a-f]{64}$'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK ((ordinal=0 AND kind IN ('fresh','adopt')) OR (ordinal>0 AND kind='migration')),
    CHECK ((kind='adopt' AND legacy_evidence_sha256 IS NOT NULL) OR
      (kind<>'adopt' AND legacy_evidence_sha256 IS NULL)))`);
}

export async function record(query, schema, row) {
  const result = await query(`INSERT INTO ${historyName(schema)}
    (ordinal,id,kind,artifact_sha256,descriptor_sha256,frontier,legacy_evidence_sha256)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ordinal,id,kind,artifact_sha256,descriptor_sha256,frontier,legacy_evidence_sha256`, [row.ordinal, row.id, row.kind, row.artifactSha256,
    row.descriptorSha256, JSON.stringify(row.frontier), row.legacyDigest ?? null]);
  const expected = { ordinal: row.ordinal, id: row.id, kind: row.kind, artifact_sha256: row.artifactSha256,
    descriptor_sha256: row.descriptorSha256, frontier: row.frontier, legacy_evidence_sha256: row.legacyDigest ?? null };
  if (result.rowCount !== 1 || canonical(result.rows) !== canonical([expected])) fail('HISTORY_RECORD_FAILED');
}

export async function isEmpty(query, schema) {
  const exists = (await query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1', [schema])).rows.length;
  if (!exists) fail('SCHEMA_UNRECOGNIZED');
  const result = await query(`SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relkind IN ('r','p','v','m','S','f','c')
    UNION ALL SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
    UNION ALL SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname=$1 AND t.typtype IN ('d','e','r','m','c')
  ) AS occupied`, [schema]);
  return !result.rows[0].occupied;
}
