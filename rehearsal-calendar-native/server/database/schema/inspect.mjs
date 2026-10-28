import { createHash } from 'node:crypto';
import descriptor from './catalog.json' with { type: 'json' };

const profiles = new Set([
  'rehearsly-pg-current-v1', 'rehearsly-pg-domain13-v1',
  'rehearsly-pg-domain13-pre-import-key-v1',
]);
const budgetGroups = {
  '007': ['native_member_availability_rate_limits'],
  '008': ['native_invite_account_rate_limits', 'native_invite_ip_rate_limits', 'native_invite_ip_rate_limit_gate'],
  '009': ['native_operation_ip_rate_limits', 'native_operation_ip_rate_limit_gates'],
  '010': ['native_email_identities', 'native_email_codes'],
  '011': ['native_push_tickets'],
  '012': ['native_idempotency_keys'],
};
export const schemaTableNames = Object.freeze(descriptor.tables?.map(table => table.name) || []);
const retiredTables = new Set(['native_subscription_plans', 'native_user_subscriptions',
  'native_payment_transactions', 'native_allpay_webhook_events', 'native_rehearsal_participants', 'native_activity_log']);
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const signature = value => JSON.stringify(canonical(value));
const sorted = values => values.slice().sort((a, b) => signature(a).localeCompare(signature(b), 'en'));
const unique = values => sorted([...new Map(values.map(value => [signature(value), value])).values()]);
const digest = value => createHash('sha256').update(signature(value)).digest('hex');

function validateSchema(schema) {
  if (typeof schema !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(schema) || schema.startsWith('pg_')) {
    throw Object.assign(new Error('Schema identifier is invalid'), { code: 'SCHEMA_IDENTIFIER_INVALID' });
  }
}

function normalizedDefault(column) {
  if (column.generatedIdentity) return 'owned-int4-generator';
  if (column.defaultExpression === 'now()' || column.defaultExpression === 'CURRENT_TIMESTAMP'
      || column.defaultExpression === 'transaction_timestamp()') return 'transaction-timestamp';
  return column.defaultExpression;
}

/** Built-in catalog reads through the supplied client; no migration SQL or DDL. */
export async function readCatalog(query, { schema }) {
  validateSchema(schema);
  const version = Number((await query("SELECT current_setting('server_version_num')::integer AS version")).rows[0].version);
  if (version < 150000) throw Object.assign(new Error('PostgreSQL 15 or later is required by the schema inspector'), { code: 'UNSUPPORTED_PG_VERSION' });
  const relations = (await query(`SELECT c.oid, c.relname AS name, c.relkind AS kind,
      c.relpersistence AS persistence, c.relrowsecurity AS "rowSecurity", c.relforcerowsecurity AS "forceRowSecurity",
      c.relispartition AS partition, EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
        WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS inheritance,
      EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS "userTriggers",
      EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid = c.oid AND t.tgisinternal
        AND t.tgenabled NOT IN ('O','A')) AS "disabledInternalTriggers",
      EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite r WHERE r.ev_class = c.oid) AS rules
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname`, [schema])).rows;
  const columns = (await query(`SELECT c.relname AS "table", a.attname AS name,
      t.typname AS type, tn.nspname AS "typeSchema", a.atttypmod AS modifier,
      a.attnotnull AS "notNull", a.attgenerated AS generated, a.attidentity AS identity,
      pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "defaultExpression",
      cn.nspname AS "collationSchema", co.collname AS collation,
      s.seqtypid = 'pg_catalog.int4'::regtype AND s.seqincrement = 1
        AND s.seqmin = 1 AND s.seqmax = 2147483647 AND NOT s.seqcycle
        AND (a.attidentity = 'd' OR (a.attidentity = ''
          AND pg_catalog.pg_get_expr(d.adbin,d.adrelid) ~ '^nextval\\(''.*''::regclass\\)$'
          AND EXISTS (SELECT 1 FROM pg_catalog.pg_depend dd
            WHERE dd.classid = 'pg_catalog.pg_attrdef'::regclass AND dd.objid = d.oid
              AND dd.refclassid = 'pg_catalog.pg_class'::regclass AND dd.refobjid = seq.oid))) AS "generatedIdentity"
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_catalog.pg_type t ON t.oid = a.atttypid JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation
    LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace
    LEFT JOIN pg_catalog.pg_depend ownership ON ownership.refclassid = 'pg_catalog.pg_class'::regclass
      AND ownership.refobjid = c.oid AND ownership.refobjsubid = a.attnum
      AND ownership.classid = 'pg_catalog.pg_class'::regclass AND ownership.deptype IN ('a','i')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_class owned WHERE owned.oid=ownership.objid AND owned.relkind='S')
    LEFT JOIN pg_catalog.pg_class seq ON seq.oid = ownership.objid AND seq.relkind = 'S'
    LEFT JOIN pg_catalog.pg_sequence s ON s.seqrelid = seq.oid
    WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname, a.attname`, [schema])).rows;
  const constraints = (await query(`SELECT c.relname AS "table", con.conname AS name,
      con.contype AS kind, con.convalidated AS validated, con.condeferrable AS deferrable,
      con.condeferred AS deferred, con.connoinherit AS "noInherit",
      ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(num,ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
      CASE WHEN rn.nspname = $1 THEN '@target' ELSE rn.nspname END AS "foreignSchema",
      rc.relname AS "foreignTable",
      ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(num,ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum=k.num ORDER BY k.ord) AS "foreignColumns",
      con.confupdtype AS "onUpdate", con.confdeltype AS "onDelete", con.confmatchtype AS "matchType",
      pg_catalog.pg_get_expr(con.conbin, con.conrelid) AS expression
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_class rc ON rc.oid = con.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rc.relnamespace
    WHERE n.nspname=$1 ORDER BY c.relname, con.conname`, [schema])).rows;
  const indexes = (await query(`SELECT c.relname AS "table", ic.relname AS name, am.amname AS method,
      i.indisunique AS unique, i.indisprimary AS primary, i.indimmediate AS immediate,
      i.indisvalid AS valid, i.indisready AS ready, i.indnullsnotdistinct AS "nullsNotDistinct",
      pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,
      ARRAY(SELECT pg_catalog.pg_get_indexdef(i.indexrelid,k,true)
        FROM generate_series(1,i.indnkeyatts) k ORDER BY k) AS keys,
      ARRAY(SELECT i.indoption[k]::integer FROM generate_series(0,i.indnkeyatts-1) k ORDER BY k) AS options,
      ARRAY(SELECT ns.nspname || '.' || op.opcname FROM generate_series(0,i.indnkeyatts-1) k
        JOIN pg_catalog.pg_opclass op ON op.oid=i.indclass[k]
        JOIN pg_catalog.pg_namespace ns ON ns.oid=op.opcnamespace ORDER BY k) AS "operatorClasses",
      ARRAY(SELECT CASE WHEN col.oid IS NULL THEN NULL ELSE ns.nspname || '.' || col.collname END
        FROM generate_series(0,i.indnkeyatts-1) k
        LEFT JOIN pg_catalog.pg_collation col ON col.oid=i.indcollation[k]
        LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=col.collnamespace ORDER BY k) AS collations,
      ARRAY(SELECT pg_catalog.pg_get_indexdef(i.indexrelid,k,true)
        FROM generate_series(i.indnkeyatts+1,i.indnatts) k ORDER BY k) AS included
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_catalog.pg_am am ON am.oid=ic.relam WHERE n.nspname=$1 ORDER BY c.relname,ic.relname`, [schema])).rows;
  return relations.map(({ oid, name, ...shape }) => ({
    name, ...shape,
    columns: columns.filter(column => column.table === name).map(({ table, identity, generatedIdentity, ...column }) => {
      const result = { ...column, defaultExpression: normalizedDefault({ ...column, generatedIdentity: generatedIdentity === true }) };
      if (identity && generatedIdentity !== true) result.unsupportedIdentity = identity;
      return result;
    }),
    // Indexes separately establish immediate conflict-target guarantees. A
    // same-key UNIQUE index/constraint is equivalent for this application.
    constraints: unique(constraints.filter(value => value.table === name && value.kind !== 'u')
      .map(({ table, name: ignored, ...constraint }) => constraint)),
    indexes: unique(indexes.filter(value => value.table === name).map(({ table, name: ignored, ...index }) => index)),
  }));
}

function isImportedKey(index) {
  return index.unique && !index.primary && index.keys.join('|') === 'user_id|external_event_id|source';
}
// Group 013 (R4: G01) is a key, not a table: native_push_tokens unique on the
// token alone. Without it the table has its predecessor's shape — unique on
// (user_id, device_token) with a plain index on the token — and nothing else.
function isPushOwnerKey(index) {
  return index.unique && !index.primary && index.keys.join('|') === 'device_token';
}
function pushTokenPredecessorIndexes(expected) {
  const key = expected.indexes.find(isPushOwnerKey);
  return [...expected.indexes.filter(index => !isPushOwnerKey(index)), { ...key, unique: false },
    { ...key, keys: ['user_id', 'device_token'], options: [0, ...key.options],
      operatorClasses: ['pg_catalog.int4_ops', ...key.operatorClasses], collations: [null, ...key.collations] }];
}
function equivalentIndex(actual, expected) {
  if (signature(actual) === signature(expected)) return true;
  // A valid unique index on exactly the same keys also serves a redundant
  // non-unique lookup index. No prefix/predicate/expression approximation.
  return !expected.unique && actual.unique && !actual.primary
    && signature({ ...actual, unique: false }) === signature(expected);
}

export function createSchemaInspector(expectedDescriptor) {
  if (!Array.isArray(expectedDescriptor.tables) || expectedDescriptor.formatVersion !== 1) {
    throw new Error('Schema descriptor is invalid');
  }
  return async function inspect(query, { schema, profile }) {
    validateSchema(schema);
    if (!profiles.has(profile)) throw Object.assign(new Error('Schema profile is unsupported'), { code: 'PROFILE_UNSUPPORTED' });
    const actual = await readCatalog(query, { schema });
    const byName = new Map(actual.map(table => [table.name, table]));
    const expectedByName = new Map(expectedDescriptor.tables.map(table => [table.name, table]));
    const issues = [];
    const add = (code, objectId) => issues.push({ code, objectId });
    const presentGroups = [];
    const checkedNames = [];
    for (const [group, names] of Object.entries(budgetGroups)) {
      const count = names.filter(name => byName.has(name)).length;
      if (count && count !== names.length) add('BUDGET_GROUP_PARTIAL', group);
      else if (count) { presentGroups.push(group); checkedNames.push(...names); }
      else if (profile === 'rehearsly-pg-current-v1') add('BUDGET_GROUP_MISSING', group);
    }
    checkedNames.push(...expectedDescriptor.tables.map(table => table.name)
      .filter(name => !Object.values(budgetGroups).flat().includes(name)));
    const pushOwnerKey = expectedByName.get('native_push_tokens').indexes.find(isPushOwnerKey);
    const hasPushOwnerKey = byName.get('native_push_tokens')?.indexes
      .some(index => equivalentIndex(index, pushOwnerKey)) === true;
    if (hasPushOwnerKey) presentGroups.push('013');
    else if (profile === 'rehearsly-pg-current-v1') add('BUDGET_GROUP_MISSING', '013');
    const expectedIndexes = (name, expected) => name === 'native_push_tokens' && !hasPushOwnerKey
      ? pushTokenPredecessorIndexes(expected) : expected.indexes;
    const availability = byName.get('native_user_availability');
    const importedKey = expectedByName.get('native_user_availability').indexes.find(isImportedKey);
    const hasImportedKey = availability?.indexes.some(index => equivalentIndex(index, importedKey)) === true;
    const preImported = profile === 'rehearsly-pg-domain13-pre-import-key-v1';
    if (preImported && hasImportedKey) add('PREDECESSOR_ALREADY_SATISFIED', 'native_user_availability.imported-key');
    const incoming = (await query(`SELECT rn.nspname AS "sourceSchema", r.relname AS "sourceTable",
        t.relname AS "targetTable", con.confdeltype AS "onDelete", con.confupdtype AS "onUpdate"
      FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class r ON r.oid=con.conrelid
      JOIN pg_catalog.pg_namespace rn ON rn.oid=r.relnamespace JOIN pg_catalog.pg_class t ON t.oid=con.confrelid
      JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace
      WHERE con.contype='f' AND tn.nspname=$1 AND t.relname=ANY($2::text[])
        AND NOT (rn.nspname=$1 AND r.relname=ANY($2::text[]))`, [schema, [...expectedByName.keys()]])).rows;
    for (const edge of incoming) add('INCOMING_FOREIGN_KEY_UNRECOGNIZED', `${edge.targetTable}.incoming.${digest(edge).slice(0,12)}`);
    // Index names otherwise do not define compatibility, but this one is a
    // reserved forward-repair destination. A colliding relation must fail at
    // preflight, rather than after an adoption has been planned.
    const reserved = (await query(`SELECT tn.nspname AS "tableSchema", t.relname AS "tableName",
        am.amname AS method, i.indisunique AS unique, i.indisprimary AS primary, i.indimmediate AS immediate,
        i.indisvalid AS valid, i.indisready AS ready, i.indnullsnotdistinct AS "nullsNotDistinct",
        pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,
        ARRAY(SELECT pg_catalog.pg_get_indexdef(i.indexrelid,k,true) FROM generate_series(1,i.indnkeyatts) k ORDER BY k) AS keys,
        ARRAY(SELECT i.indoption[k]::integer FROM generate_series(0,i.indnkeyatts-1) k ORDER BY k) AS options,
        ARRAY(SELECT ns.nspname || '.' || op.opcname FROM generate_series(0,i.indnkeyatts-1) k
          JOIN pg_catalog.pg_opclass op ON op.oid=i.indclass[k] JOIN pg_catalog.pg_namespace ns ON ns.oid=op.opcnamespace ORDER BY k) AS "operatorClasses",
        ARRAY(SELECT CASE WHEN col.oid IS NULL THEN NULL ELSE ns.nspname || '.' || col.collname END
          FROM generate_series(0,i.indnkeyatts-1) k LEFT JOIN pg_catalog.pg_collation col ON col.oid=i.indcollation[k]
          LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=col.collnamespace ORDER BY k) AS collations,
        ARRAY(SELECT pg_catalog.pg_get_indexdef(i.indexrelid,k,true) FROM generate_series(i.indnkeyatts+1,i.indnatts) k ORDER BY k) AS included
      FROM pg_catalog.pg_class named JOIN pg_catalog.pg_namespace n ON n.oid=named.relnamespace
      LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=named.oid LEFT JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
      LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace LEFT JOIN pg_catalog.pg_am am ON am.oid=named.relam
      WHERE n.nspname=$1 AND named.relname='idx_availability_imported_event'`, [schema])).rows;
    for (const { tableSchema, tableName, ...index } of reserved) {
      if (tableSchema !== schema || tableName !== 'native_user_availability' || !equivalentIndex(index, importedKey)) {
        add('RESERVED_OBJECT_CONFLICT', 'idx_availability_imported_event');
      }
    }
    for (const name of checkedNames) {
      const expected = expectedByName.get(name);
      const table = byName.get(name);
      if (!table) { add('DOMAIN_TABLE_MISSING', name); continue; }
      // convalidated does not change when a superuser disables PostgreSQL's
      // internal referential-integrity triggers. Metadata alone is insufficient.
      if (table.disabledInternalTriggers) add('FOREIGN_KEY_ENFORCEMENT_DISABLED', name);
      for (const key of ['kind', 'persistence', 'rowSecurity', 'forceRowSecurity', 'partition', 'inheritance', 'userTriggers', 'rules']) {
        if (table[key] !== expected[key]) add('RELATION_POLICY_MISMATCH', `${name}.${key}`);
      }
      const columns = new Map(table.columns.map(column => [column.name, column]));
      for (const column of expected.columns) {
        const received = columns.get(column.name);
        if (!received) add('COLUMN_MISSING', `${name}.${column.name}`);
        else if (signature(received) !== signature(column)) add('COLUMN_SHAPE_MISMATCH', `${name}.${column.name}`);
      }
      for (const column of columns.keys()) {
        if (!expected.columns.some(value => value.name === column)) add('COLUMN_UNEXPECTED', `${name}.${column}`);
      }
      for (const constraint of expected.constraints) {
        if (!table.constraints.some(value => signature(value) === signature(constraint))) add('REQUIRED_CONSTRAINT_MISSING', `${name}.${constraint.kind}.${digest(constraint).slice(0,12)}`);
      }
      for (const constraint of table.constraints) {
        if (!expected.constraints.some(value => signature(value) === signature(constraint))) add('UNKNOWN_RESTRICTIVE_OBJECT', `${name}.constraint.${digest(constraint).slice(0,12)}`);
      }
      const indexes = expectedIndexes(name, expected);
      for (const index of indexes) {
        if (preImported && name === 'native_user_availability' && isImportedKey(index)) continue;
        if (!table.indexes.some(value => equivalentIndex(value, index))) add(isImportedKey(index) && name === 'native_user_availability'
          ? 'CONFLICT_TARGET_MISSING' : 'REQUIRED_INDEX_MISSING', `${name}.index.${digest(index).slice(0,12)}`);
      }
      for (const index of table.indexes) {
        if (!index.valid || !index.ready) add('INDEX_NOT_USABLE', `${name}.index.${digest(index).slice(0,12)}`);
        if (index.unique && !indexes.some(value => value.unique && equivalentIndex(index, value))) {
          add('UNKNOWN_RESTRICTIVE_OBJECT', `${name}.unique.${digest(index).slice(0,12)}`);
        } else if (!index.unique && !indexes.some(value => equivalentIndex(index, value))) {
          // An arbitrary expression/predicate/operator class can also change
          // writes. Accept only the named profile's reviewed index semantics.
          add('INDEX_UNEXPECTED', `${name}.index.${digest(index).slice(0,12)}`);
        }
      }
    }
    for (const table of actual) {
      if (table.name.startsWith('native_') && !expectedByName.has(table.name) && !retiredTables.has(table.name)
        && !['native_schema_history','native_migrations'].includes(table.name)) add('TABLE_UNEXPECTED', table.name);
    }

    // Only use a data query after this table's entire column/relation shape is
    // verified. Values returned by aggregates are used internally, never echoed.
    let duplicateGroups;
    if (availability && !issues.some(issue => issue.objectId.startsWith('native_user_availability')
      && ['RELATION_POLICY_MISMATCH','COLUMN_MISSING','COLUMN_SHAPE_MISMATCH','COLUMN_UNEXPECTED'].includes(issue.code))) {
      duplicateGroups = Number((await query(`SELECT count(*) AS count FROM (
        SELECT 1 FROM ${quote(schema)}.native_user_availability WHERE external_event_id IS NOT NULL
        GROUP BY user_id, external_event_id, source HAVING count(*) > 1) duplicates`)).rows[0].count);
      if (duplicateGroups > 0) add('IMPORTED_EVENT_DUPLICATES', 'native_user_availability');
    }
    for (const group of ['008','009']) {
      if (!presentGroups.includes(group) || issues.some(issue => budgetGroups[group].some(name => issue.objectId.startsWith(name)))) continue;
      const rows = group === '008'
        ? (await query(`SELECT g.id, g.key_count, (SELECT count(*) FROM ${quote(schema)}.native_invite_ip_rate_limits) AS actual
            FROM ${quote(schema)}.native_invite_ip_rate_limit_gate g`)).rows
        : (await query(`SELECT g.operation, g.key_count, (SELECT count(*) FROM ${quote(schema)}.native_operation_ip_rate_limits r
            WHERE r.operation = g.operation) AS actual FROM ${quote(schema)}.native_operation_ip_rate_limit_gates g ORDER BY g.operation`)).rows;
      const validKeys = group === '008' ? rows.length === 1 && rows[0].id === 1
        : rows.length === 2 && rows.map(row => row.operation).join('|') === 'admin_login|auth';
      if (!validKeys || rows.some(row => Number(row.key_count) !== Number(row.actual))) add('GATE_COUNT_MISMATCH', group);
    }
    const onlyMissingImportedKey = issues.length > 0 && issues.every(issue => issue.code === 'CONFLICT_TARGET_MISSING'
      || issue.code === 'BUDGET_GROUP_MISSING');
    const normalized = actual.filter(table => expectedByName.has(table.name)).map(table => ({ ...table,
      // Ignore redundant duplicate indexes and their names/OIDs. Counters and
      // gate values are deliberately absent from this durable fingerprint.
      indexes: unique(table.indexes), constraints: unique(table.constraints),
    }));
    return { compatible: issues.length === 0, issues: unique(issues),
      evidenceSha256: digest({ profile, tables: normalized, incoming: unique(incoming) }),
      frontier: { domain: 'v1', availabilityConflictKey: hasImportedKey, budgets: presentGroups },
      repairCandidates: !hasImportedKey && duplicateGroups === 0 && (onlyMissingImportedKey || (preImported && !issues.length))
        ? [{ id: 'availability-conflict-key-v1', profileId: 'rehearsly-pg-domain13-pre-import-key-v1' }] : [],
    };
  };
}

export async function inspectSchema(query, options) {
  return createSchemaInspector(descriptor)(query, options);
}
