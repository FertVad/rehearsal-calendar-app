import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const table = 'native_operation_ip_rate_limits';
const gates = 'native_operation_ip_rate_limit_gates';
const policies = { auth: { limit: 20, window: 60 }, admin_login: { limit: 5, window: 900 } };
const fixtureTables = ['native_users', 'native_projects', 'native_project_members', 'native_rehearsals',
  'native_rehearsal_responses', 'native_user_availability', 'native_push_tokens', 'native_notifications', 'r0_transaction_probe'];

// Invoked only by probe.mjs after owned local-PG marker/schema/migration checks.
// serverRoot override permits preparing this unchanged draft under /private/tmp.
export async function probeIS02({ control, db, http, allowedPorts, serverRoot = new URL('../../', import.meta.url) }) {
  const require = createRequire(new URL('package.json', serverRoot));
  const bcrypt = require('bcrypt');
  const workers = new Set();
  let successful = false;
  let sequence = 0;
  const startWorker = async () => {
    const child = fork(fileURLToPath(new URL('./is02-worker.mjs', import.meta.url)), [serverRoot.href], {
      execPath: process.execPath, execArgv: ['--unhandled-rejections=strict'],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { PATH: '/usr/bin:/bin', TZ: 'UTC', NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL, R0_NONCE: process.env.R0_NONCE,
        JWT_SECRET: process.env.JWT_SECRET, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD },
    });
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error('IS02 worker startup timed out')); }, 8000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`IS02 worker exited before readiness (${code})`)); });
      child.once('message', message => {
        clearTimeout(timeout);
        if (message.type === 'ready') resolve(message);
        else { child.kill(); reject(new Error(`IS02 worker startup failed at ${message.phase || 'unknown phase'}`)); }
      });
    });
    allowedPorts.add(ready.port);
    const worker = {
      child, pid: ready.pid, base: `http://127.0.0.1:${ready.port}`,
      async stats() {
        const id = ++sequence;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { child.off('message', listener); reject(new Error('IS02 worker stats timed out')); }, 3000);
          const listener = message => {
            if (message.type !== 'stats' || message.id !== id) return;
            clearTimeout(timeout); child.off('message', listener); resolve(message);
          };
          child.on('message', listener); child.send({ type: 'stats', id });
        });
      },
      async disconnect() {
        assert.equal((await worker.stats()).deniedConnections, 0);
        const code = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('IS02 disconnected worker did not exit')), 3000);
          child.once('exit', code => { clearTimeout(timeout); resolve(code); });
          child.disconnect();
        });
        assert.equal(code, 1, 'A lost parent connection must terminate the owned worker unsuccessfully');
        allowedPorts.delete(ready.port); workers.delete(worker);
      },
      async stop() {
        if (!workers.has(worker)) return;
        const stats = await worker.stats();
        assert.equal(stats.deniedConnections, 0);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { child.kill(); reject(new Error('IS02 worker shutdown timed out')); }, 3000);
          child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error('IS02 worker shutdown failed')); });
          child.send({ type: 'stop' });
        });
        allowedPorts.delete(ready.port); workers.delete(worker);
      },
    };
    workers.add(worker);
    return worker;
  };
  const request = async (worker, operation, ip, options = {}) => {
    const pathname = operation === 'auth' ? '/api/auth/login' : '/admin/api/login';
    const response = await fetch(worker.base + (options.path || pathname), {
      method: options.method || 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip,
        ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) },
      ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
      signal: AbortSignal.timeout(6000),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null, headers: response.headers };
  };
  const denial = (response, status) => {
    assert.equal(response.status, status);
    assert.equal(typeof response.data?.error, 'string');
    assert.deepEqual(Object.keys(response.data), ['error']);
    assert.ok(!/native_operation|SELECT|UPDATE|INSERT|postgres|password=|R0_|IS02_INJECTED/i.test(response.data.error),
      'Limiter errors expose no storage details or fixture markers');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  };
  const reset = () => control.query(`DELETE FROM ${table}; UPDATE ${gates} SET key_count = 0`);
  const rows = async () => (await control.query(`SELECT * FROM ${table} ORDER BY operation, ip_key`)).rows;
  const gateRows = async () => (await control.query(`SELECT * FROM ${gates} ORDER BY operation`)).rows;
  const budgetSnapshot = async () => ({ rows: await rows(), gates: await gateRows() });
  const businessSnapshot = async () => {
    const snapshot = {};
    for (const name of fixtureTables) snapshot[name] = (await control.query(`SELECT * FROM ${name} ORDER BY id`)).rows;
    return snapshot;
  };
  const assertGates = async () => {
    const actual = (await control.query(`SELECT operation, COUNT(*)::integer AS count FROM ${table} GROUP BY operation`)).rows;
    for (const gate of await gateRows()) {
      assert.equal(gate.key_count, actual.find(row => row.operation === gate.operation)?.count || 0);
      assert.ok(gate.key_count >= 0 && gate.key_count <= 10000);
    }
  };
  const now = async () => Number((await control.query('SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint AS seconds')).rows[0].seconds);
  const businessCalls = async () => Promise.all([...workers].map(async worker => (await worker.stats()).businessCalls));
  const blockerPid = Number((await control.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  const observeWait = async queryFragment => {
    const deadline = performance.now() + 800;
    let blocked;
    do {
      await control.query('SELECT pg_stat_clear_snapshot()');
      blocked = (await control.query(`SELECT pid, query_start FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND $1::integer = ANY(pg_blocking_pids(pid))
          AND wait_event_type = 'Lock' AND query LIKE $2`, [blockerPid, `%${queryFragment}%`])).rows[0];
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
    } while (!blocked && performance.now() < deadline);
    assert.ok(blocked, 'The actual SQL statement must be observed waiting on the owned lock');
    return blocked;
  };
  const settle = promise => promise.then(response => ({ response }), error => ({ error }));
  const unwrap = result => { if (result.error) throw result.error; return result.response; };
  const migration = await readFile(new URL('migrations/009-operation-ip-rate-limits.sql', serverRoot), 'utf8');
  try {
    // Only this diagnostic fixture needs these actual route columns.
    await control.query(`ALTER TABLE native_users
      ADD COLUMN password_hash TEXT, ADD COLUMN timezone TEXT DEFAULT 'UTC',
      ADD COLUMN last_login_at TIMESTAMPTZ, ADD COLUMN phone TEXT, ADD COLUMN avatar_url TEXT,
      ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE, ADD COLUMN week_start_day INTEGER DEFAULT 1,
      ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE`);
    const password = 'is02-positive-fixture';
    await control.query('UPDATE native_users SET password_hash = $1 WHERE id = 1', [await bcrypt.hash(password, 4)]);
    let first = await startWorker();
    let second = await startWorker();
    assert.notEqual(first.pid, second.pid, 'Separate app processes are required for the persistence contract');
    const disconnectProbe = await startWorker();
    await disconnectProbe.disconnect();
    const before = await businessSnapshot();

    // First allocation races across independent process pools, not MemoryStores.
    for (const [operation, policy] of Object.entries(policies)) {
      await reset();
      const started = await now();
      const size = operation === 'auth' ? 32 : 12;
      const burst = await Promise.all(Array.from({ length: size }, (_, index) =>
        request(index % 2 ? first : second, operation, '192.0.2.20')));
      assert.equal(burst.filter(response => response.status === 400).length, policy.limit);
      assert.equal(burst.filter(response => response.status === 429).length, size - policy.limit);
      burst.filter(response => response.status === 429).forEach(response => denial(response, 429));
      const stored = await rows();
      assert.equal(stored.length, 1);
      assert.equal(stored[0].operation, operation);
      assert.equal(stored[0].request_count, policy.limit + 1, 'Counts saturate at the rejection sentinel');
      assert.ok(Number(stored[0].reset_at) >= started + policy.window);
      assert.ok(Number(stored[0].reset_at) <= await now() + policy.window);
      assert.match(stored[0].ip_key, /^[a-f0-9]{64}$/);
      await assertGates();
      const saved = await budgetSnapshot();
      await control.query(migration); await control.query(migration);
      assert.deepEqual(await budgetSnapshot(), saved, 'Reapplying the migration cannot reset budgets');
      const oldPid = first.pid;
      await first.stop(); first = await startWorker();
      assert.notEqual(first.pid, oldPid);
      const calls = await businessCalls();
      denial(await request(first, operation, '192.0.2.20', { body: operation === 'auth'
        ? { email: 'owner@r0.invalid', password }
        : { password: process.env.ADMIN_PASSWORD } }), 429);
      assert.deepEqual(await businessCalls(), calls, 'A cold worker must deny before any account/business SQL');
      assert.deepEqual(await budgetSnapshot(), saved, 'Restart does not recreate or refund the exhausted row');
    }

    // The established-key UPDATE also serializes correctly under contention.
    await reset();
    assert.equal((await request(first, 'auth', '192.0.2.21')).status, 400);
    const originalDeadline = (await rows())[0].reset_at;
    const established = await Promise.all(Array.from({ length: 24 }, (_, index) =>
      request(index % 2 ? first : second, 'auth', '192.0.2.21')));
    assert.equal(established.filter(response => response.status === 400).length, 19);
    assert.equal(established.filter(response => response.status === 429).length, 5);
    assert.equal((await rows())[0].reset_at, originalDeadline, 'Subsequent attempts do not slide the first-request deadline');
    await control.query(`UPDATE ${table} SET reset_at = 0`);
    assert.equal((await request(second, 'auth', '192.0.2.21')).status, 400);
    assert.equal((await rows())[0].request_count, 1, 'An expired row is reused immediately');
    await assertGates();

    // A real gate lock must not block a known key. New-key allocation must
    // wait on that lock and then fail within the scoped 1-second lock timeout.
    await control.query('BEGIN');
    let waiter;
    try {
      await control.query(`SELECT key_count FROM ${gates} WHERE operation = 'auth' FOR UPDATE`);
      assert.equal((await request(first, 'auth', '192.0.2.21')).status, 400);
      const started = performance.now();
      const statesBefore = (await second.stats()).storageSqlStates.length;
      waiter = settle(request(second, 'auth', '192.0.2.22'));
      await observeWait(gates);
      denial(unwrap(await waiter), 503);
      assert.deepEqual((await second.stats()).storageSqlStates.slice(statesBefore), ['55P03'],
        'PostgreSQL must report the actual lock timeout, not an HTTP or statement timeout');
      assert.ok(performance.now() - started < 4500, 'Lock timeout must return before the client transport deadline');
    } finally { await control.query('ROLLBACK'); if (waiter) await waiter; }
    assert.equal((await rows()).length, 1);
    assert.equal((await request(second, 'auth', '192.0.2.22')).status, 400);
    await assertGates();

    // Older UPDATE snapshot waits while a newer deadline/count is installed.
    // It must retain that deadline, increment the committed count, and refuse
    // to reopen a window based on its pre-wait timestamp.
    await reset();
    assert.equal((await request(first, 'auth', '192.0.2.30')).status, 400);
    const oldKey = (await rows())[0].ip_key;
    await control.query(`UPDATE ${table} SET reset_at = 0 WHERE ip_key = $1`, [oldKey]);
    await control.query('BEGIN');
    waiter = undefined;
    let updated;
    try {
      await control.query(`SELECT * FROM ${table} WHERE ip_key = $1 FOR UPDATE`, [oldKey]);
      waiter = settle(request(second, 'auth', '192.0.2.30'));
      await observeWait(`UPDATE ${table}`);
      updated = (await control.query(`UPDATE ${table} SET reset_at =
        FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint + 120, request_count = 19
        WHERE ip_key = $1 RETURNING reset_at`, [oldKey])).rows[0];
      await control.query('COMMIT');
      assert.equal(unwrap(await waiter).status, 400);
    } finally { await control.query('ROLLBACK'); if (waiter) await waiter; }
    const retained = (await rows())[0];
    assert.equal(retained.reset_at, updated.reset_at);
    assert.equal(retained.request_count, 20);
    denial(await request(first, 'auth', '192.0.2.30'), 429);
    await assertGates();

    // DELETE selects an expired version then waits on an uncommitted refresh.
    // Its outer expiry predicate must be rechecked after the row lock resolves.
    await reset();
    assert.equal((await request(first, 'auth', '192.0.2.40')).status, 400);
    const candidate = (await rows())[0].ip_key;
    await control.query(`UPDATE ${table} SET reset_at = 0 WHERE ip_key = $1`, [candidate]);
    await control.query('BEGIN');
    waiter = undefined;
    let refreshed;
    try {
      refreshed = (await control.query(`UPDATE ${table} SET reset_at =
        FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint + 60, request_count = 7
        WHERE ip_key = $1 RETURNING *`, [candidate])).rows[0];
      waiter = settle(request(second, 'auth', '192.0.2.41'));
      await observeWait(`DELETE FROM ${table}`);
      await control.query('COMMIT');
      assert.equal(unwrap(await waiter).status, 400);
    } finally { await control.query('ROLLBACK'); if (waiter) await waiter; }
    assert.deepEqual((await rows()).find(row => row.ip_key === candidate), refreshed,
      'Pruning cannot evict the refreshed row or reset its consumed quota');
    assert.equal((await request(first, 'auth', '192.0.2.40')).status, 400);
    assert.equal((await rows()).find(row => row.ip_key === candidate).request_count, 8);
    await assertGates();

    // Last allocation slot: many distinct keys contend across both pools.
    await reset();
    await control.query(`INSERT INTO ${table}(operation, ip_key, reset_at, request_count)
      SELECT 'auth', LPAD(TO_HEX(id), 64, '0'),
        FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint + 600, 1
      FROM generate_series(1, 9999) AS id;
      UPDATE ${gates} SET key_count = 9999 WHERE operation = 'auth'`);
    const finalSlot = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      request(index % 2 ? first : second, 'auth', `198.51.100.${index + 1}`)));
    assert.equal(finalSlot.filter(response => response.status === 400).length, 1);
    assert.equal(finalSlot.filter(response => response.status === 503).length, 11);
    finalSlot.filter(response => response.status === 503).forEach(response => denial(response, 503));
    await assertGates();
    assert.equal((await gateRows()).find(row => row.operation === 'auth').key_count, 10000);
    const winningIndex = finalSlot.findIndex(response => response.status === 400);
    assert.equal((await request(first, 'auth', `198.51.100.${winningIndex + 1}`)).status, 400,
      'A full namespace still admits an established key within its own quota');
    assert.equal(Number((await control.query(`SELECT COUNT(*) AS count FROM ${table}
      WHERE operation = 'auth' AND ip_key IN (SELECT LPAD(TO_HEX(id),64,'0') FROM generate_series(1,9999) AS id)`)).rows[0].count), 9999,
    'Competing new identities cannot evict an active seeded key');
    // A full auth namespace does not consume admin's independently gated cap.
    assert.equal((await request(second, 'admin_login', '198.51.100.200')).status, 400);
    await assertGates();
    await control.query(`UPDATE ${table} SET reset_at = 0 WHERE operation = 'auth'
      AND ip_key IN (SELECT ip_key FROM ${table} WHERE operation = 'auth' ORDER BY ip_key LIMIT 65)`);
    assert.equal((await request(first, 'auth', '198.51.100.201')).status, 400);
    await assertGates();
    assert.equal((await gateRows()).find(row => row.operation === 'auth').key_count, 10000 - 64 + 1);
    assert.equal(Number((await control.query(`SELECT COUNT(*) AS count FROM ${table} WHERE operation='auth' AND reset_at=0`)).rows[0].count), 1);

    // Force rollback after pruning and insertion, at the final gate increment.
    await reset();
    assert.equal((await request(first, 'auth', '203.0.113.10')).status, 400);
    await control.query(`UPDATE ${table} SET reset_at = 0`);
    const atomicBefore = await budgetSnapshot();
    await control.query(`CREATE FUNCTION is02_reject_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key_count > OLD.key_count THEN RAISE EXCEPTION 'IS02_INJECTED_ALLOCATION'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER is02_reject_allocation BEFORE UPDATE ON ${gates}
      FOR EACH ROW EXECUTE FUNCTION is02_reject_allocation()`);
    try {
      const calls = await businessCalls();
      denial(await request(second, 'auth', '203.0.113.11', { body: { email: 'owner@r0.invalid', password } }), 503);
      assert.deepEqual(await businessCalls(), calls);
      assert.deepEqual(await budgetSnapshot(), atomicBefore, 'Prune, insertion and gate update roll back together');
      assert.equal((await http('/api/health')).status, 200);
    } finally {
      await control.query(`DROP TRIGGER is02_reject_allocation ON ${gates}; DROP FUNCTION is02_reject_allocation()`);
    }
    assert.equal((await request(second, 'auth', '203.0.113.11')).status, 400);
    await assertGates();

    // A slow real SQL trigger is stopped by the scoped statement timeout.
    const timeoutBefore = await budgetSnapshot();
    const activeUpdates = async () => {
      await control.query('SELECT pg_stat_clear_snapshot()');
      return (await control.query(`SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND state = 'active' AND query LIKE $1`, [`%UPDATE ${table}%`])).rows;
    };
    await control.query(`CREATE FUNCTION is02_slow_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(10); RETURN NEW; END $$;
      CREATE TRIGGER is02_slow_update BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION is02_slow_update()`);
    try {
      const started = performance.now();
      const calls = await businessCalls();
      const statesBefore = (await second.stats()).storageSqlStates.length;
      denial(await request(second, 'auth', '203.0.113.11', { body: { email: 'owner@r0.invalid', password } }), 503);
      assert.ok(performance.now() - started < 4500);
      assert.deepEqual((await second.stats()).storageSqlStates.slice(statesBefore), ['57014'],
        'PostgreSQL must cancel the SQL statement before the HTTP fallback deadline');
      assert.deepEqual(await businessCalls(), calls);
      assert.deepEqual(await activeUpdates(), [],
        'The 2-second SQL timeout must finish the actual UPDATE; an HTTP-only timeout is insufficient');
      assert.deepEqual(await budgetSnapshot(), timeoutBefore, 'Canceled SQL must not commit a counter mutation');
    } finally {
      // If the contract failed, cancel only still-running UPDATE statements in
      // this owned disposable database before removing the fault. Never let a
      // late trigger commit hide behind an old READ COMMITTED snapshot.
      for (const { pid } of await activeUpdates()) await control.query('SELECT pg_cancel_backend($1)', [pid]);
      await control.query(`DROP TRIGGER is02_slow_update ON ${table}; DROP FUNCTION is02_slow_update()`);
    }
    assert.deepEqual(await budgetSnapshot(), timeoutBefore,
      'Counter state must remain unchanged after the trigger is removed and all SQL has settled');
    assert.equal((await request(second, 'auth', '203.0.113.11')).status, 400);
    await assertGates();

    // Actual constraints and idempotence are PostgreSQL evidence, not a SQLite
    // translation or hand-coded limiter store standing in for the service.
    for (const [operation, key, deadline, count] of [
      ['unknown', 'a'.repeat(64), 1, 1], ['auth', 'G'.repeat(64), 1, 1],
      ['auth', 'a'.repeat(63), 1, 1], ['auth', 'b'.repeat(64), -1, 1],
      ['auth', 'c'.repeat(64), 1, 22], ['admin_login', 'd'.repeat(64), 1, 7],
    ]) {
      await assert.rejects(control.query(`INSERT INTO ${table}(operation,ip_key,reset_at,request_count) VALUES ($1,$2,$3,$4)`,
        [operation, key, deadline, count]), error => error.code === '23514');
    }
    await assert.rejects(control.query(`UPDATE ${gates} SET key_count = 10001 WHERE operation='auth'`), error => error.code === '23514');
    await assertGates();
    assert.deepEqual(await businessSnapshot(), before, 'Races, denials and store faults preserve every business row');

    // Positive real credentials still issue tokens accepted by existing routes.
    await reset();
    const login = await request(first, 'auth', '203.0.113.100', { body: { email: 'owner@r0.invalid', password } });
    assert.equal(login.status, 200);
    assert.equal(typeof login.data.accessToken, 'string');
    const me = await request(second, 'auth', '203.0.113.101', { path: '/api/auth/me', method: 'GET', token: login.data.accessToken });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.id, 1);
    const admin = await request(second, 'admin_login', '203.0.113.100', { body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(admin.status, 200);
    const listing = await request(first, 'admin_login', '203.0.113.100', { path: '/admin/api/users', method: 'GET', token: admin.data.token });
    assert.equal(listing.status, 200);
    assert.equal(listing.data.total, 3);
    await assertGates();
    successful = true;
    return { outcome: 'PASS', contracts: [
      'owned cold worker exits on parent IPC disconnect; normal/error cleanup cannot silently pass',
      'separate worker processes share exact20 auth/5 admin admissions and saturated counters; cold restart preserves denial',
      'real migration009 idempotence with nonzero rows, checked constraints and exact independent gate counts',
      'established-key contention, anchored DB deadlines and immediate expired-row reuse',
      'gate lock timeout preserves existing-key access and recovers without account SQL',
      'observed row-lock ordering preserves newer deadline/count against an older admission statement',
      'observed prune/refresh lock race retains refreshed key, count and exact cardinality',
      'concurrent final10000th slot, separate namespace capacity and exactly64-of65 expired rows pruned',
      'real trigger failure rolls back prune+allocation+gate; real statement timeout rolls back counter and recovers',
      'all denial/store-fault business snapshots unchanged; valid auth/admin tokens authorize actual routes',
    ] };
  } finally {
    let cleanupFailure;
    for (const worker of [...workers]) {
      try { await worker.stop(); }
      catch (error) {
        cleanupFailure ||= error;
        if (worker.child.exitCode === null && worker.child.signalCode === null) {
          await new Promise(resolve => {
            worker.child.once('exit', resolve);
            worker.child.kill('SIGKILL');
          });
        }
        allowedPorts.delete(Number(new URL(worker.base).port));
        workers.delete(worker);
      }
    }
    // Do not turn a worker's blocked outbound connection or failed shutdown
    // into PASS. Preserve an earlier assertion if cleanup follows a failure.
    if (successful && cleanupFailure) throw cleanupFailure;
  }
}
