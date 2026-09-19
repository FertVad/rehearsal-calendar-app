// Runs only inside the R0 runner's owned, separate PostgreSQL fixture process.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';

export async function runAdapterContracts({ connectionString, control }) {
  const target = new URL(connectionString);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/r0_test');
  assert.equal(target.username, 'r0_owner');
  assert.match(process.env.R0_NONCE || '', /^[a-f0-9]{24}$/);
  assert.equal((await control.query('SELECT nonce FROM public.r0_owned_database')).rows[0].nonce, process.env.R0_NONCE);
  assert.equal((await control.query('SELECT current_schema() AS name')).rows[0].name, 'r0_fixture');
  await control.query('CREATE TABLE rows_probe(id SERIAL PRIMARY KEY, note TEXT NOT NULL UNIQUE, flag INTEGER NOT NULL DEFAULT 0)');
  target.searchParams.set('options', '-c search_path=r0_fixture');
  target.searchParams.set('application_name', 'r2-adapter-' + process.env.R0_NONCE);
  const previousUrl = process.env.DATABASE_URL;
  const previousPostgresUrl = process.env.POSTGRES_URL;
  let connected = 0;
  const connect = net.Socket.prototype.connect;
  const OriginalPool = pg.Pool;
  const clientQuery = pg.Client.prototype.query;
  let database;
  try {
    // Keep the caller's network allowlist; this observer only counts sockets.
    net.Socket.prototype.connect = function (...args) { connected++; return connect.apply(this, args); };
    const pools = [];
    const clients = new Set();
    const releases = [];
    let pauseNextClient;
    pg.Pool = class ObservedActualPool extends OriginalPool {
      constructor(options) {
        super(options);
        pools.push(this);
        this.on('connect', client => {
          if (pauseNextClient) {
            const pause = pauseNextClient;
            pauseNextClient = undefined;
            pause(client);
          }
        });
        this.on('acquire', client => clients.add(client));
        this.on('release', (error, client) => releases.push({ error: Boolean(error), client }));
      }
    };
    const sqlObserved = [];
    let probeBarrier;
    pg.Client.prototype.query = function (...args) {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      sqlObserved.push(text);
      if (probeBarrier && text === 'SELECT 1' && this !== control) {
        const barrier = probeBarrier;
        probeBarrier = undefined;
        barrier.enter();
        return barrier.wait.then(() => clientQuery.apply(this, args));
      }
      return clientQuery.apply(this, args);
    };
    const connectionsBeforeImport = connected;
    database = await import(new URL('../../database/db.js', import.meta.url));
    assert.equal(connected, connectionsBeforeImport, 'Import opened a connection');
    let failures = 0;
    const contracts = [];
    async function check(name, work) {
      try { await work(); contracts.push(name); console.log(JSON.stringify({ check: name, result: 'PASS' })); }
      catch (error) {
        failures++;
        console.log(JSON.stringify({ check: name, result: 'FAIL', errorCode: error.code || error.name }));
      }
    }
    const deferred = () => {
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      return { promise, resolve };
    };
    async function until(predicate, label, limit = 4000) {
      const end = Date.now() + limit;
      while (!predicate()) {
        assert.ok(Date.now() < end, label);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    const rows = async () => (await control.query('SELECT note,flag FROM rows_probe ORDER BY note')).rows;

    process.env.DATABASE_URL = target.href;
    delete process.env.POSTGRES_URL;

    await check('pure import, invalid config, no local file and inert state', async () => {
      assert.deepEqual(database.getDatabaseStatus(), { state: 'uninitialized' });
      assert.ok(Object.isFrozen(database.getDatabaseStatus()));
      assert.equal(database.default, undefined);
      delete process.env.DATABASE_URL;
      const before = connected;
      for (const options of [undefined, { connectionString: '' }, { connectionString: 'https://synthetic.invalid/secret' }]) {
        await assert.rejects(database.initDatabase(options), error =>
          error.code === 'DATABASE_UNAVAILABLE' && error.message === 'Database is temporarily unavailable'
          && error.cause === undefined);
      }
      assert.equal(connected, before);
      assert.equal(existsSync(path.join(process.cwd(), 'server/database/data.sqlite')), false);
      process.env.DATABASE_URL = target.href;
    });
    await check('configured PostgreSQL connection failure closes candidate without fallback', async () => {
      const failed = new URL(target);
      failed.pathname = `/r2_missing_${process.env.R0_NONCE}`;
      const before = connected;
      await assert.rejects(database.initDatabase({ connectionString: failed.href }), error =>
        error.code === 'DATABASE_UNAVAILABLE' && error.message === 'Database is temporarily unavailable'
        && error.cause === undefined);
      assert.ok(connected > before, 'The real driver did not attempt the owned PostgreSQL connection');
      assert.equal(pools.at(-1).totalCount, 0);
      assert.equal(pools.at(-1).waitingCount, 0);
      assert.equal(database.default, undefined);
      assert.equal(database.isPostgres, false);
      assert.equal(existsSync(path.join(process.cwd(), 'server/database/data.sqlite')), false);
    });
    await check('actual in-flight SELECT1 read timeout discards candidate and permits retry', async () => {
      const entered = deferred();
      let paused;
      pauseNextClient = client => {
        paused = client;
        // Authenticated socket: writes still reach PG, but its actual SELECT1
        // result is held by the transport until the client read timer expires.
        client.connection.stream.pause();
        entered.resolve();
      };
      const started = Date.now();
      const initialization = database.initDatabase()
        .then(() => ({ okay: true }), error => ({ error }));
      try {
        await entered.promise;
        let observed = false;
        while (Date.now() - started < 1500) {
          const result = await control.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1 AND query='SELECT 1' AND state='idle'",
            [paused.processID]
          );
          if (result.rows[0].n === 1) { observed = true; break; }
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        assert.equal(observed, true, 'Independent PG observer did not see the actual probe');
        assert.equal(database.default, undefined);
        assert.equal(database.isPostgres, false);
        const outcome = await initialization;
        const elapsed = Date.now() - started;
        assert.equal(outcome.error?.code, 'DATABASE_UNAVAILABLE');
        assert.ok(elapsed >= 1800 && elapsed < 4000, 'Probe read deadline outside expected bound');
        assert.equal(paused.connection.stream.destroyed, true);
        assert.equal(pools.at(-1).totalCount, 0);
        assert.equal(pools.at(-1).waitingCount, 0);
        assert.deepEqual(database.getDatabaseStatus(), { state: 'unavailable' });
        console.log(JSON.stringify({ observation: 'owned PG SELECT1 response withheld after execution',
          independentlyObserved: observed, elapsedMs: elapsed, socketDestroyed: true }));
      } finally {
        pauseNextClient = undefined;
        paused?.connection.stream.resume();
        paused?.connection.stream.destroy();
        await initialization;
      }
    });
    await check('simultaneous init shares actual candidate pool and published adapter', async () => {
      const before = pools.length;
      const first = database.initDatabase();
      const second = database.initDatabase();
      assert.equal(first, second);
      assert.equal(database.default, undefined);
      const [a, b] = await Promise.all([first, second]);
      assert.equal(a, b);
      assert.equal(pools.length, before + 1);
      assert.equal(pools.at(-1).totalCount, 1);
      assert.equal(database.isPostgres, true);
      assert.equal(await database.initDatabase(), a);
      assert.deepEqual(database.getDatabaseStatus(), { state: 'ready' });
      await database.testConnection();
    });
    let db = database.default;
    await check('ordinary run reports affected rows for insert/update/delete0/conflict0', async () => {
      await control.query('TRUNCATE rows_probe RESTART IDENTITY');
      const inserted = await db.run("INSERT INTO rows_probe(note) VALUES ('one'),('two'),('three')");
      const updated = await db.run("UPDATE rows_probe SET flag=1 WHERE note IN ('one','two')");
      const single = await db.run("UPDATE rows_probe SET flag=2 WHERE note='three'");
      const absent = await db.run('DELETE FROM rows_probe WHERE id=-1');
      const conflict = await db.run("INSERT INTO rows_probe(note) VALUES ('one') ON CONFLICT(note) DO NOTHING");
      assert.equal((await rows()).length, 3);
      assert.equal((await rows()).filter(row => row.flag === 1).length, 2);
      console.log(JSON.stringify({ observation: 'ordinary affected rows', independentUpdated: 2,
        reportedUpdated: updated.changes ?? null, reportedAbsent: absent.changes ?? null }));
      assert.equal(inserted.lastInsertId, 1);
      assert.equal(inserted.changes, 3);
      assert.equal(updated.changes, 2);
      assert.equal(single.changes, 1);
      assert.equal(absent.changes, 0);
      assert.equal(conflict.changes, 0);
    });
    await check('scoped run reports exact update/delete count on the real transaction', async () => {
      await control.query('TRUNCATE rows_probe RESTART IDENTITY');
      await control.query("INSERT INTO rows_probe(note) VALUES ('one'),('two'),('three')");
      const result = await db.transaction(async tx => {
        const changed = await tx.run('UPDATE rows_probe SET flag=7');
        const deleted = await tx.run("DELETE FROM rows_probe WHERE note='one'");
        const zero = await tx.run('DELETE FROM rows_probe WHERE id=-1');
        const inserted = await tx.run("INSERT INTO rows_probe(note) VALUES ('scoped')");
        const conflict = await tx.run("INSERT INTO rows_probe(note) VALUES ('scoped') ON CONFLICT(note) DO NOTHING");
        return { changed, deleted, zero, inserted, conflict };
      });
      assert.deepEqual(await rows(), [{ note: 'scoped', flag: 0 }, { note: 'three', flag: 7 }, { note: 'two', flag: 7 }]);
      console.log(JSON.stringify({ observation: 'transaction affected rows', independentUpdated: 3,
        reportedUpdated: result.changed.changes ?? null, reportedDeleted: result.deleted.changes ?? null }));
      assert.equal(result.changed.changes, 3);
      assert.equal(result.deleted.changes, 1);
      assert.equal(result.zero.changes, 0);
      assert.equal(result.inserted.changes, 1);
      assert.equal(result.inserted.lastInsertId, 4);
      assert.equal(result.conflict.changes, 0);
    });

    await check('real socket failure during acquire handoff cannot be unhandled', async () => {
      const pool = pools.at(-1);
      let observerCount;
      let victim;
      pool.once('acquire', client => {
        victim = client;
        process.nextTick(() => {
          observerCount = client.listenerCount('error');
          client.connection.stream.destroy(new Error('Synthetic owned socket handoff failure'));
        });
      });
      await assert.rejects(db.get('SELECT 1'));
      assert.ok(observerCount >= 1, 'Client handoff had no error observer');
      const recovered = await db.get('SELECT pg_backend_pid() AS pid');
      assert.notEqual(recovered.pid, victim.processID);
      console.log(JSON.stringify({ observation: 'actual socket handoff failure', permanentObserversAtHandoff: observerCount }));
    });
    await check('rollback and expired handle; caught statement error never becomes success', async () => {
      const before = await rows();
      let captured;
      await assert.rejects(db.transaction(async tx => {
        captured = tx;
        await tx.run("INSERT INTO rows_probe(note) VALUES ('rollback')");
        throw new Error('Synthetic callback failure');
      }));
      assert.deepEqual(await rows(), before);
      const sqlBefore = sqlObserved.length;
      await assert.rejects(captured.get('SELECT 1'), { code: 'DATABASE_TRANSACTION_CLOSED' });
      assert.equal(sqlObserved.length, sqlBefore);
      await assert.rejects(db.transaction(async tx => {
        try { await tx.run("INSERT INTO rows_probe(note) VALUES ('two')"); } catch { /* desired catch test */ }
        return 'must not report success';
      }), /did not commit/);
      assert.deepEqual(await rows(), before);
    });
    await check('failed rollback discards actual closed connection and recovers', async () => {
      const before = await rows();
      let victim;
      const start = sqlObserved.length;
      await assert.rejects(db.transaction(async tx => {
        const pid = (await tx.get('SELECT pg_backend_pid() AS pid')).pid;
        victim = [...clients].find(client => client.processID === pid);
        assert.ok(victim);
        await tx.run("INSERT INTO rows_probe(note) VALUES ('rollback-closed')");
        await victim.end();
        throw new Error('Synthetic failure after closing owned connection');
      }));
      assert.ok(sqlObserved.slice(start).includes('ROLLBACK'), 'Actual rollback was attempted');
      assert.ok(releases.some(item => item.client === victim && item.error));
      assert.deepEqual(await rows(), before);
      const recovered = await db.get('SELECT pg_backend_pid() AS pid');
      assert.notEqual(recovered.pid, victim.processID);
    });
    await check('leased idle backend failure is observed and releases once', async () => {
      const entered = deferred();
      const resume = deferred();
      let pid;
      const work = db.transaction(async tx => {
        pid = (await tx.get('SELECT pg_backend_pid() AS pid')).pid;
        entered.resolve();
        await resume.promise;
        await tx.get('SELECT 1');
      });
      const observed = work.then(() => ({ okay: true }), error => ({ error }));
      await entered.promise;
      const victim = [...clients].find(client => client.processID === pid);
      const releasesBefore = releases.filter(item => item.client === victim).length;
      assert.equal((await control.query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated, true);
      await until(() => releases.filter(item => item.client === victim).length > releasesBefore, 'Leased error was not released');
      resume.resolve();
      assert.equal((await observed).error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(releases.filter(item => item.client === victim).length, releasesBefore + 1);
      await db.get('SELECT 1');
    });
    await check('real max10/queue100/acquisition2s removes waiters with no late write', async () => {
      const resume = deferred();
      let entered = 0;
      const holders = Array.from({ length: 10 }, () => db.transaction(async tx => {
        await tx.get('SELECT pg_backend_pid() AS pid');
        entered++;
        await resume.promise;
      }));
      try {
        await until(() => entered === 10, 'Ten actual leases did not start');
        const pool = pools.at(-1);
        assert.equal(pool.totalCount, 10);
        const started = Date.now();
        const queued = Array.from({ length: 100 }, (_, i) => db.run('INSERT INTO rows_probe(note) VALUES (?)', [`queued-${i}`])
          .then(() => ({ okay: true }), error => ({ error })));
        assert.equal(pool.waitingCount, 100);
        await assert.rejects(db.run("INSERT INTO rows_probe(note) VALUES ('overflow')"), { code: 'DATABASE_UNAVAILABLE' });
        assert.equal(pool.waitingCount, 100);
        const outcomes = await Promise.all(queued);
        const elapsed = Date.now() - started;
        assert.ok(outcomes.every(result => result.error?.code === 'DATABASE_UNAVAILABLE'));
        assert.ok(elapsed >= 1800 && elapsed < 4000, 'Queue acquisition deadline outside expected bound');
        assert.equal(pool.waitingCount, 0);
        console.log(JSON.stringify({ observation: 'actual pg-pool saturation', maxClients: pool.totalCount,
          rejectedWaiters: outcomes.length, queueAfter: pool.waitingCount, elapsedMs: elapsed }));
      } finally { resume.resolve(); await Promise.allSettled(holders); }
      assert.equal((await control.query("SELECT count(*)::int AS n FROM rows_probe WHERE note LIKE 'queued-%' OR note='overflow'")).rows[0].n, 0);
      await db.get('SELECT 1');
    });
    await check('close stops new calls, drains issued transaction, expires old handles, reinitializes', async () => {
      const entered = deferred();
      const resume = deferred();
      let txHandle;
      const old = db;
      const transaction = old.transaction(async tx => {
        txHandle = tx;
        await tx.get('SELECT 1');
        entered.resolve();
        await resume.promise;
        // Services choose their dialect from this live export between awaits.
        // Closing must stop new admissions without changing an issued lease.
        assert.equal(database.isPostgres, true);
        const dialect = database.isPostgres
          ? 'SELECT current_database() AS name'
          : 'SELECT name FROM pragma_database_list LIMIT 1';
        assert.equal((await tx.get(dialect)).name, 'r0_test');
        await tx.run("INSERT INTO rows_probe(note) VALUES ('graceful-close')");
        return 'committed';
      });
      await entered.promise;
      let done = false;
      const close = database.closeDatabase();
      assert.equal(database.closeDatabase(), close);
      close.then(() => { done = true; });
      assert.deepEqual(database.getDatabaseStatus(), { state: 'closing' });
      assert.equal(database.default, undefined);
      assert.equal(database.isPostgres, true);
      await assert.rejects(old.get('SELECT 1'), { code: 'DATABASE_UNAVAILABLE' });
      assert.equal(done, false);
      resume.resolve();
      assert.equal(await transaction, 'committed');
      await close;
      assert.equal(database.isPostgres, false);
      assert.ok((await rows()).some(row => row.note === 'graceful-close'));
      assert.deepEqual(database.getDatabaseStatus(), { state: 'uninitialized' });
      await assert.rejects(txHandle.get('SELECT 1'), { code: 'DATABASE_TRANSACTION_CLOSED' });
      db = await database.initDatabase();
      assert.notEqual(db, old);
      await assert.rejects(old.get('SELECT 1'), { code: 'DATABASE_UNAVAILABLE' });
      await db.get('SELECT 1');
    });
    await check('close waits for queued acquisition refusal after issued leases finish', async () => {
      const resume = deferred();
      let entered = 0;
      const holders = Array.from({ length: 10 }, () => db.transaction(async tx => {
        await tx.get('SELECT 1');
        entered++;
        await resume.promise;
      }));
      try {
        await until(() => entered === 10, 'Ten leases did not start before close');
        const pool = pools.at(-1);
        const queued = db.run("INSERT INTO rows_probe(note) VALUES ('queued-close')")
          .then(() => ({ okay: true }), error => ({ error }));
        assert.equal(pool.waitingCount, 1);
        const started = Date.now();
        let finished = false;
        const closing = database.closeDatabase();
        closing.then(() => { finished = true; });
        resume.resolve();
        await Promise.all(holders);
        assert.ok(Date.now() - started < 1500, 'Holders were not released before queue deadline');
        assert.equal(finished, false, 'Close did not await pending acquisition settlement');
        assert.equal((await queued).error.code, 'DATABASE_UNAVAILABLE');
        await closing;
        assert.equal(pool.waitingCount, 0);
        assert.equal(pool.totalCount, 0);
        assert.equal((await control.query("SELECT count(*)::int AS n FROM rows_probe WHERE note='queued-close'")).rows[0].n, 0);
      } finally { resume.resolve(); await Promise.allSettled(holders); }
      db = await database.initDatabase();
    });
    await check('close before init and during pre-probe lease never publishes stale state', async () => {
      await database.closeDatabase();
      const before = pools.length;
      const first = database.initDatabase();
      const firstOutcome = first.then(() => ({ okay: true }), error => ({ error }));
      await database.closeDatabase();
      assert.equal((await firstOutcome).error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(pools.length, before);
      const entered = deferred();
      const resume = deferred();
      probeBarrier = { enter: entered.resolve, wait: resume.promise };
      const second = database.initDatabase();
      const secondOutcome = second.then(() => ({ okay: true }), error => ({ error }));
      await entered.promise;
      const closing = database.closeDatabase();
      assert.equal(database.default, undefined);
      resume.resolve();
      await closing;
      assert.equal((await secondOutcome).error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(database.isPostgres, false);
      assert.deepEqual(database.getDatabaseStatus(), { state: 'uninitialized' });
      db = await database.initDatabase();
      await database.testConnection();
    });
    await database.closeDatabase();
    await database.closeDatabase();
    assert.ok(pools.every(pool => pool.totalCount === 0 && pool.waitingCount === 0));
    assert.equal(failures, 0, 'One or more actual adapter contracts failed');
    return { outcome: 'PASS', contracts };
  } finally {
    try { await database?.closeDatabase?.(); } finally {
      pg.Pool = OriginalPool;
      pg.Client.prototype.query = clientQuery;
      net.Socket.prototype.connect = connect;
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
      if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = previousPostgresUrl;
    }
  }
}
