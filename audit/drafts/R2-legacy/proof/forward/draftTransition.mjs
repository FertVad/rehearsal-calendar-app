// TMP-only integration harness. Production manifest/catalog/history integration
// remains separate; fm_draft_history is deliberately not native_schema_history.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const quote = schema => { assert.match(schema,/^fm_[a-z0-9_]+$/); return `"${schema}"`; };
const codes = new Set(['LEGACY_TIME_LAYOUT_UNSUPPORTED','LEGACY_TARGET_ALREADY_POPULATED','LEGACY_SOURCE_INVALID',
  'LEGACY_ROUNDTRIP_MISMATCH','LEGACY_SOURCE_CHANGED','EMAIL_PROVIDER_DUPLICATES','EMAIL_PROVIDER_SOURCE_INCONSISTENT',
  'EMAIL_PROVIDER_SOURCE_UNREPRESENTABLE','EMAIL_PROVIDER_KEY_DRIFT','EMAIL_PROVIDER_POSTCONDITION_FAILED','EMAIL_PROVIDER_SOURCE_CHANGED']);
export async function applyDraft(client,{schema,kind,sql,afterSql,beforeSql}) {
  assert.ok(['fm01','fm02'].includes(kind));
  assert.equal(typeof sql,'string');
  const hash=createHash('sha256').update(sql).digest('hex');
  let committing=false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='500ms'; SET LOCAL statement_timeout='10s'");
    await client.query("SELECT set_config('search_path',$1,true)",[quote(schema)]);
    if(!(await client.query('SELECT pg_try_advisory_xact_lock(711013,22002) AS locked')).rows[0].locked) throw new Error('MIGRATION_BUSY');
    const tables=kind==='fm01'?['native_rehearsals','native_user_availability','native_users']:['native_auth_providers','native_users'];
    await client.query(`LOCK TABLE ${tables.map(t=>`${quote(schema)}."${t}"`).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    await client.query('CREATE TABLE IF NOT EXISTS fm_draft_history(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL)');
    const done=(await client.query('SELECT sha256 FROM fm_draft_history WHERE id=$1',[kind])).rows[0];
    if(done) {
      if(done.sha256!==hash) throw new Error('CHECKSUM_MISMATCH');
      await verifyDraftStructure(client,kind);
      committing=true; await client.query('COMMIT');
      return {outcome:'unchanged'};
    }
    if(beforeSql) await beforeSql(client);
    await client.query(sql);
    await verifyDraftStructure(client,kind);
    if(afterSql) await afterSql(client);
    await client.query('INSERT INTO fm_draft_history VALUES($1,$2)',[kind,hash]);
    committing=true; await client.query('COMMIT');
    return {outcome:'applied'};
  } catch(error) {
    if(!committing) await client.query('ROLLBACK');
    const code=committing?'COMMIT_OUTCOME_UNKNOWN':codes.has(error.message)||['MIGRATION_BUSY','CHECKSUM_MISMATCH','POSTCONDITION_FAILED'].includes(error.message)
      ?error.message:error.code==='55P03'?'MIGRATION_LOCK_TIMEOUT':'MIGRATION_FAILED';
    const safe=new Error(code); safe.code=code; throw safe;
  }
}
async function verifyDraftStructure(client,kind) {
  if(kind==='fm01') {
    for(const table of ['native_rehearsals','native_user_availability']) {
      const {rows}=await client.query(`SELECT attname,atttypid='timestamptz'::regtype AS instant,attnotnull
        FROM pg_attribute WHERE attrelid=$1::regclass AND NOT attisdropped
        AND attname IN('date','start_time','end_time','starts_at','ends_at')`,[table]);
      if(rows.length!==5||rows.some(r=>r.attname.endsWith('_at')?(!r.instant||!r.attnotnull):r.attnotnull)) throw new Error('POSTCONDITION_FAILED');
      const check=(await client.query(`SELECT 1 FROM pg_constraint WHERE conrelid=$1::regclass AND contype='c' AND convalidated
        AND pg_get_constraintdef(oid)='CHECK ((ends_at > starts_at))'`,[table])).rowCount;
      if(!check) throw new Error('POSTCONDITION_FAILED');
    }
  } else {
    const key=(await client.query(`SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('native_auth_providers_one_email_per_user')
      AND indrelid='native_auth_providers'::regclass AND indisunique AND indisready AND indisvalid AND indimmediate
      AND indnkeyatts=1 AND indnatts=1 AND indexprs IS NULL
      AND indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid='native_auth_providers'::regclass AND attname='user_id')
      AND regexp_replace(pg_get_expr(indpred,indrelid),'[()[:space:]]','','g')='provider_type::text=''email''::text'`)).rowCount;
    if(!key) throw new Error('POSTCONDITION_FAILED');
  }
}
