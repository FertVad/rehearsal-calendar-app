import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcrypt';
import { connect,timeFixture,emailFixture,rows,cases,quote } from './fixture.mjs';
import { applyDraft } from '../forward/draftTransition.mjs';
const sqls=Object.fromEntries(['fm01-utc-instants-v1','fm02-email-backfill-v1'].map((file,i)=>[
  `fm0${i+1}`,readFileSync(new URL(`../forward/${file}.sql`,import.meta.url),'utf8')]));
const tests=cases();
const client=await connect();
const apply=(c,schema,kind,options={})=>applyDraft(c,{schema,kind,sql:sqls[kind],...options});
const setSchema=(c,s)=>c.query(`SET search_path TO ${quote(s)}`);
const cleanTime=records=>records.map(({starts_at,ends_at,...source})=>source);
async function catalog(c) {
  return (await c.query(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull
    FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND a.attnum>0 AND NOT a.attisdropped
    AND c.relkind='r' ORDER BY c.relname,a.attnum`)).rows;
}
async function noHistory(c) { assert.equal((await c.query("SELECT to_regclass('fm_draft_history') IS NULL AS absent")).rows[0].absent,true); }
const expectCode=(fn,code)=>assert.rejects(fn,error=>error.code===code);
const latch=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function observeLock(pid) {
  const until=Date.now()+3000;
  while(Date.now()<until) {
    const result=await client.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[pid]);
    if(result.rows[0]?.wait_event_type==='Lock') return;
    await new Promise(r=>setTimeout(r,20));
  }
  throw new Error('LOCK_BARRIER_NOT_OBSERVED');
}
try {
  for(const [index,zone] of ['UTC','Asia/Jerusalem','America/Los_Angeles'].entries()) {
    await tests.run(`FM01 explicit SQL preserves UTC epochs/source/precision under ${zone}`,async()=>{
      const schema=`fm_after_zone_${index}`;
      await timeFixture(client,schema,index===2);
      await client.query("SELECT set_config('TimeZone',$1,false)",[zone]);
      const beforeR=cleanTime(await rows(client,'native_rehearsals'));
      const beforeA=cleanTime(await rows(client,'native_user_availability'));
      assert.deepEqual(await apply(client,schema,'fm01'),{outcome:'applied'});
      assert.deepEqual(cleanTime(await rows(client,'native_rehearsals')),beforeR);
      assert.deepEqual(cleanTime(await rows(client,'native_user_availability')),beforeA);
      assert.deepEqual((await client.query(`SELECT
        (SELECT starts_at=TIMESTAMPTZ '2026-09-10 10:00:00.123456Z' AND ends_at=TIMESTAMPTZ '2026-09-10 12:30:00.654321Z' FROM native_rehearsals WHERE id=1) AS precise,
        (SELECT starts_at=TIMESTAMPTZ '2026-01-10 06:30Z' FROM native_rehearsals WHERE id=2) AS rehearsal_flag,
        (SELECT starts_at=TIMESTAMPTZ '2026-03-08 00:00Z' AND ends_at=TIMESTAMPTZ '2026-03-08 23:59Z' FROM native_user_availability WHERE id=2) AS day,
        (SELECT starts_at=TIMESTAMPTZ '2026-11-01 00:00Z' AND ends_at=TIMESTAMPTZ '2026-11-01 23:59Z' FROM native_user_availability WHERE id=3) AS ignored_source_clocks`)).rows,
        [{precise:true,rehearsal_flag:true,day:true,ignored_source_clocks:true}]);
      // Current consumer column shape: new writes supply only instants, not legacy fields.
      await client.query(`INSERT INTO native_rehearsals(id,starts_at,ends_at,title) VALUES(90,'2026-10-01T10:00Z','2026-10-01T12:00Z','synthetic new');
        INSERT INTO native_user_availability(id,user_id,starts_at,ends_at,is_all_day) VALUES(90,1,'2026-10-01T10:00Z','2026-10-01T12:00Z',false);
        UPDATE native_rehearsals SET starts_at='2026-09-10T14:00Z',ends_at='2026-09-10T15:00Z' WHERE id=1;`);
      const edited=await rows(client,'native_rehearsals');
      assert.deepEqual(await apply(client,schema,'fm01'),{outcome:'unchanged'});
      assert.deepEqual(await rows(client,'native_rehearsals'),edited);
      assert.equal(edited.find(r=>r.id===90).date,null);
    });
  }
  await client.query("SET TimeZone='UTC'");
  for(const [label,change,code] of [
    ['start_filled',"UPDATE native_rehearsals SET starts_at='2026-09-10T10:00Z' WHERE id=1",'LEGACY_TARGET_ALREADY_POPULATED'],
    ['end_filled',"UPDATE native_user_availability SET ends_at='2026-09-10T12:00Z' WHERE id=1",'LEGACY_TARGET_ALREADY_POPULATED'],
    ['both_filled',"UPDATE native_rehearsals SET starts_at='2026-09-10T10:00:00.123456Z',ends_at='2026-09-10T12:30:00.654321Z'",'LEGACY_TARGET_ALREADY_POPULATED'],
    ['bad_type','ALTER TABLE native_rehearsals ALTER date TYPE TEXT USING date::TEXT','LEGACY_TIME_LAYOUT_UNSUPPORTED'],
    ['equal_time',"UPDATE native_rehearsals SET end_time=start_time WHERE id=1",'LEGACY_SOURCE_INVALID'],
    ['null_flag','ALTER TABLE native_user_availability ALTER is_all_day DROP NOT NULL; UPDATE native_user_availability SET is_all_day=NULL WHERE id=1','LEGACY_SOURCE_INVALID'],
    ['infinite',"UPDATE native_rehearsals SET date='infinity' WHERE id=1",'LEGACY_SOURCE_INVALID'],
    ['hour24',"UPDATE native_rehearsals SET end_time='24:00' WHERE id=1",'LEGACY_SOURCE_INVALID']
  ]) {
    await tests.run(`FM01 ${label} refuses unchanged`,async()=>{
      const schema=`fm_reject_${label}`;
      await timeFixture(client,schema,true);
      await client.query(change);
      const before={r:await rows(client,'native_rehearsals'),a:await rows(client,'native_user_availability'),c:await catalog(client)};
      await expectCode(()=>apply(client,schema,'fm01'),code);
      assert.deepEqual({r:await rows(client,'native_rehearsals'),a:await rows(client,'native_user_availability'),c:await catalog(client)},before);
      await noHistory(client);
    });
  }
  await tests.run('FM01 data and DDL roll back on post-SQL pre-history failure',async()=>{
    const schema='fm_time_rollback';await timeFixture(client,schema);
    const before={r:await rows(client,'native_rehearsals'),a:await rows(client,'native_user_availability'),c:await catalog(client)};
    await expectCode(()=>apply(client,schema,'fm01',{afterSql:c=>c.query('SELECT 1/0')}),'MIGRATION_FAILED');
    assert.deepEqual({r:await rows(client,'native_rehearsals'),a:await rows(client,'native_user_availability'),c:await catalog(client)},before);
    await noHistory(client);
    assert.deepEqual(await apply(client,schema,'fm01'),{outcome:'applied'});
  });
  await tests.run('FM01 source mutation detected and rolled back by SQL preservation check',async()=>{
    const schema='fm_time_source_changed';await timeFixture(client,schema);
    await client.query(`CREATE FUNCTION fm_mutate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.title='changed synthetic'; RETURN NEW; END $$;
      CREATE TRIGGER fm_source_mutation BEFORE UPDATE ON native_rehearsals FOR EACH ROW EXECUTE FUNCTION fm_mutate()`);
    const before=await rows(client,'native_rehearsals');
    await expectCode(()=>apply(client,schema,'fm01'),'LEGACY_SOURCE_CHANGED');
    assert.deepEqual(await rows(client,'native_rehearsals'),before);await noHistory(client);
  });
  await tests.run('FM01 missing target schema drift is not silently repaired after history',async()=>{
    const schema='fm_time_drift';await timeFixture(client,schema);await apply(client,schema,'fm01');
    await client.query('ALTER TABLE native_rehearsals ALTER starts_at DROP NOT NULL');
    await expectCode(()=>apply(client,schema,'fm01'),'POSTCONDITION_FAILED');
  });
  await tests.run('FM02 real password bytes, existing registry and OAuth identities preserved; repeat does not heal unlink',async()=>{
    const schema='fm_email_positive';await emailFixture(client,schema);
    const hash=await bcrypt.hash('fm-only-synthetic-test',4);
    await client.query('UPDATE native_users SET password_hash=$1 WHERE id=1',[hash]);
    await client.query(`INSERT INTO native_auth_providers(user_id,provider_type,provider_email,provider_metadata,created_at,updated_at,last_used_at)
      VALUES(2,'email',NULL,'synthetic preserved exact text','2025-02-01Z','2025-02-02Z','2025-02-03Z')`);
    const usersBefore=await rows(client,'native_users'),providersBefore=await rows(client,'native_auth_providers');
    assert.deepEqual(await apply(client,schema,'fm02'),{outcome:'applied'});
    assert.deepEqual(await rows(client,'native_users'),usersBefore);
    const after=await rows(client,'native_auth_providers');
    for(const p of providersBefore) assert.deepEqual(after.find(r=>r.id===p.id),p);
    const added=after.filter(p=>!providersBefore.some(o=>o.id===p.id));
    assert.equal(added.length,1);assert.equal(added[0].user_id,1);
    assert.equal(added[0].last_used_at,null);assert.equal(added[0].provider_metadata,null);
    assert.equal(added[0].provider_user_id,null);assert.equal(added[0].created_at,added[0].updated_at);
    assert.equal(await bcrypt.compare('fm-only-synthetic-test',usersBefore[0].password_hash),true);
    assert.deepEqual(await apply(client,schema,'fm02'),{outcome:'unchanged'});
    assert.deepEqual(await rows(client,'native_auth_providers'),after);
    await client.query("DELETE FROM native_auth_providers WHERE user_id=1 AND provider_type='email'");
    const deliberatelyUnlinked=await rows(client,'native_auth_providers');
    assert.deepEqual(await apply(client,schema,'fm02'),{outcome:'unchanged'});
    assert.deepEqual(await rows(client,'native_auth_providers'),deliberatelyUnlinked);
  });
  for(const [label,change,code] of [
    ['duplicates',"INSERT INTO native_auth_providers(user_id,provider_type,created_at,updated_at) VALUES(1,'email',NOW(),NOW()),(1,'email',NOW(),NOW())",'EMAIL_PROVIDER_DUPLICATES'],
    ['subject',"INSERT INTO native_auth_providers(user_id,provider_type,provider_user_id,created_at,updated_at) VALUES(1,'email','synthetic-unexpected',NOW(),NOW())",'EMAIL_PROVIDER_SOURCE_INCONSISTENT'],
    ['stale',"INSERT INTO native_auth_providers(user_id,provider_type,created_at,updated_at) VALUES(3,'email',NOW(),NOW())",'EMAIL_PROVIDER_SOURCE_INCONSISTENT'],
    ['mismatch',"INSERT INTO native_auth_providers(user_id,provider_type,provider_email,created_at,updated_at) VALUES(1,'email','different@example.invalid',NOW(),NOW())",'EMAIL_PROVIDER_SOURCE_INCONSISTENT'],
    ['wrong_index','CREATE INDEX native_auth_providers_one_email_per_user ON native_auth_providers(user_id)','EMAIL_PROVIDER_KEY_DRIFT'],
    ['long_email',"UPDATE native_users SET email=repeat('x',256) WHERE id=1",'EMAIL_PROVIDER_SOURCE_UNREPRESENTABLE']
  ]) {
    await tests.run(`FM02 ${label} refuses with full pre-state preserved`,async()=>{
      const schema=`fm_email_${label}`;await emailFixture(client,schema);await client.query(change);
      const before={u:await rows(client,'native_users'),p:await rows(client,'native_auth_providers'),c:await catalog(client)};
      await expectCode(()=>apply(client,schema,'fm02'),code);
      assert.deepEqual({u:await rows(client,'native_users'),p:await rows(client,'native_auth_providers'),c:await catalog(client)},before);
      await noHistory(client);
    });
  }
  await tests.run('FM02 index, inserted rows and history roll back together and recover',async()=>{
    const schema='fm_email_rollback';await emailFixture(client,schema);
    const before=await rows(client,'native_auth_providers');
    await expectCode(()=>apply(client,schema,'fm02',{afterSql:c=>c.query('SELECT 1/0')}),'MIGRATION_FAILED');
    assert.deepEqual(await rows(client,'native_auth_providers'),before);await noHistory(client);
    assert.equal((await client.query("SELECT to_regclass('native_auth_providers_one_email_per_user') IS NULL AS absent")).rows[0].absent,true);
    assert.deepEqual(await apply(client,schema,'fm02'),{outcome:'applied'});
  });
  await tests.run('FM02 two migration callers serialize and explicit busy retry is unchanged',async()=>{
    const schema='fm_email_two_runners';await emailFixture(client,schema);
    const c1=await connect(),c2=await connect(),entered=latch(),release=latch();let first;
    try {
      first=apply(c1,schema,'fm02',{beforeSql:async()=>{entered.resolve();await release.promise;}});
      await entered.promise;await expectCode(()=>apply(c2,schema,'fm02'),'MIGRATION_BUSY');
      release.resolve();assert.deepEqual(await first,{outcome:'applied'});
      assert.deepEqual(await apply(c2,schema,'fm02'),{outcome:'unchanged'});
      await setSchema(client,schema);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM fm_draft_history')).rows[0].n,1);
    } finally {release.resolve();await first?.catch(()=>{});await c1.end();await c2.end();}
  });
  await tests.run('FM02 index arbitrates actual INSERT races without migration advisory lock',async()=>{
    const schema='fm_email_insert_race';await emailFixture(client,schema);await apply(client,schema,'fm02');
    await client.query("DELETE FROM native_auth_providers WHERE provider_type='email'");
    const insert=sqls.fm02.match(/INSERT INTO native_auth_providers[\s\S]*?DO NOTHING;/)[0];
    const c1=await connect(),c2=await connect();let second;
    try {
      await c1.query('BEGIN');await c2.query('BEGIN');await setSchema(c1,schema);await setSchema(c2,schema);
      assert.equal((await c1.query(insert)).rowCount,2);
      second=c2.query(insert);second.catch(()=>{});
      await observeLock(c2.processID);await c1.query('COMMIT');assert.equal((await second).rowCount,0);await c2.query('COMMIT');
      assert.deepEqual((await client.query("SELECT user_id,count(*)::int AS n FROM native_auth_providers WHERE provider_type='email' GROUP BY user_id ORDER BY user_id")).rows,[{user_id:1,n:1},{user_id:2,n:1}]);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM native_auth_providers WHERE user_id=1 AND provider_type='google'")).rows[0].n,2);
    } finally {await c1.query('ROLLBACK').catch(()=>{});await c2.query('ROLLBACK').catch(()=>{});await second?.catch(()=>{});await c1.end();await c2.end();}
  });
  await tests.run('FM02 locks user writes through postcondition and commit, then releases them',async()=>{
    const schema='fm_email_writer';await emailFixture(client,schema);
    const c1=await connect(),c2=await connect(),entered=latch(),release=latch();let first,writer;
    try {
      first=apply(c1,schema,'fm02',{beforeSql:async()=>{entered.resolve();await release.promise;}});
      await entered.promise;await setSchema(c2,schema);
      writer=c2.query("UPDATE native_users SET password_hash='synthetic-later-password' WHERE id=1");writer.catch(()=>{});
      await observeLock(c2.processID);release.resolve();assert.deepEqual(await first,{outcome:'applied'});assert.equal((await writer).rowCount,1);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM native_auth_providers WHERE user_id=1 AND provider_type='email'")).rows[0].n,1);
    } finally {release.resolve();await first?.catch(()=>{});await writer?.catch(()=>{});await c1.end();await c2.end();}
  });
  await tests.run('FM01 held writer causes bounded lock refusal with no target/history writes',async()=>{
    const schema='fm_time_lock_timeout';await timeFixture(client,schema);const holder=await connect();
    try {
      await holder.query('BEGIN');await setSchema(holder,schema);await holder.query("UPDATE native_rehearsals SET title='synthetic held writer' WHERE id=1");
      const start=Date.now();await expectCode(()=>apply(client,schema,'fm01'),'MIGRATION_LOCK_TIMEOUT');
      assert.ok(Date.now()-start<2000);await noHistory(client);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='native_rehearsals'::regclass AND attname='starts_at'")).rows[0].n,0);
    } finally {await holder.query('ROLLBACK');await holder.end();}
  });
} finally {await client.end();}
tests.finish();
