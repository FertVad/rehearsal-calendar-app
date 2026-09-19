// Isolated worker: no checkout server.js/.env, migration runner or real credentials.
// R2_STARTUP executes only an owned source copy with a synthetic environment.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import bcrypt from 'bcrypt';

const scenario = process.argv[2];
assert.ok(['controls', 'A02', 'B02', 'B03', 'B04', 'D01', 'F01', 'H04', 'IS02', 'R2_ADAPTER', 'R2_STARTUP', 'F05'].includes(scenario));
assert.equal(process.env.NODE_ENV, 'production'); // quieter logger, real production JWT guard
assert.equal(process.env.POSTGRES_URL, undefined);
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/r0_test');
assert.equal(target.username, 'r0_owner');
assert.ok(/^\d+$/.test(target.port) && Number(target.port) > 1024);
assert.match(process.env.R0_NONCE || '', /^[a-f0-9]{24}$/);

// Fail closed on any connection outside this worker's DB and HTTP listeners.
// Native handlers/services remain real, including notification persistence.
// The fixture contains zero device tokens; transport calls would fail this gate.
const allowedPorts = new Set([Number(target.port)]);
let deniedConnections = 0;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof values[0] === 'object' ? values[0] : { port: values[0], host: values[1] };
  if (options.host !== '127.0.0.1' || !allowedPorts.has(Number(options.port)) || options.path) {
    deniedConnections++;
    throw new Error('R0 blocked an unexpected outbound connection');
  }
  return connect.apply(this, args);
};

const control = new pg.Client({ connectionString: target.href, connectionTimeoutMillis: 3000 });
await control.connect();
// Runner-created marker must match before any schema mutation is allowed.
const marker = await control.query('SELECT nonce FROM public.r0_owned_database');
assert.equal(marker.rows[0].nonce, process.env.R0_NONCE);
await control.query('DROP SCHEMA IF EXISTS r0_fixture CASCADE');
await control.query('CREATE SCHEMA r0_fixture');
await control.query('SET search_path TO r0_fixture');

if (scenario === 'F01') {
  await control.query('BEGIN');
  let failure;
  try {
    await control.query(await readFile(new URL('../../database/init-native-schema.sql', import.meta.url), 'utf8'));
  } catch (error) { failure = error; }
  await control.query('ROLLBACK');
  assert.equal(failure?.code, '42601', 'F01 baseline should reject the current mixed SQL dialect');
  assert.match(failure.message, /AUTOINCREMENT/);
  console.log(JSON.stringify({ scenario, outcome: 'KNOWN_DEFECT_REPRODUCED', sqlState: failure.code,
    expectation: 'Production bootstrap must work on PostgreSQL; current file fails at AUTOINCREMENT' }));
  await control.end();
  process.exit(0);
}

await control.query(await readFile(new URL('./fixture.sql', import.meta.url), 'utf8'));
// Auth/admin admission uses its actual shared schema in every normal fixture.
// This never changes the explicit F01 mixed-dialect bootstrap probe above.
const operationBudgetMigration = await readFile(
  new URL('../../migrations/009-operation-ip-rate-limits.sql', import.meta.url), 'utf8');
await control.query(operationBudgetMigration);
await control.query(operationBudgetMigration);
if (scenario === 'A02') {
  // The diagnostic subset needs these real columns to reach availability's
  // preprocessing and to authorize the admin users listing after bcrypt login.
  await control.query(`ALTER TABLE native_users
    ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN last_login_at TIMESTAMPTZ`);
}
if (scenario === 'B03') {
  await control.query("ALTER TABLE native_users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
  // Apply only B03's actual additive migration, twice, against this owned
  // fixture. Never import the migration runner, its ledger or its environment.
  const migration = await readFile(new URL('../../migrations/007-member-availability-rate-limit.sql', import.meta.url), 'utf8');
  await control.query(migration);
  await control.query(migration);
}
if (scenario === 'B04') {
  await control.query("ALTER TABLE native_users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
  await control.query('ALTER TABLE native_projects ADD COLUMN invite_created_by INTEGER REFERENCES native_users(id)');
  // Only the checked-in B04 additive migration, on the owned synthetic
  // fixture. No migration runner, production schema or ledger is consulted.
  const migration = await readFile(new URL('../../migrations/008-invite-rate-limits.sql', import.meta.url), 'utf8');
  await control.query(migration);
  await control.query(migration);
}
target.searchParams.set('options', '-c search_path=r0_fixture');
process.env.DATABASE_URL = target.href;
// Lifecycle and actual copied-entrypoint contracts need an uninitialized
// adapter. They run in the same owned database/process/network boundary before
// the ordinary route fixture below acquires its own adapter or HTTP listener.
if (scenario === 'R2_ADAPTER' || scenario === 'R2_STARTUP') {
  try {
    const result = scenario === 'R2_ADAPTER'
      ? await (await import('./adapterContract.mjs')).runAdapterContracts({ connectionString: target.href, control })
      : await (await import('./r2Startup.mjs')).probeR2Startup({ connectionString: target.href, control, allowedPorts });
    assert.equal(deniedConnections, 0, 'A foundation contract attempted an external connection');
    console.log(JSON.stringify({ scenario, ...result, externalConnections: deniedConnections }));
  } finally {
    await control.end();
  }
  process.exit(0);
}
const database = await import('../../database/db.js');
await database.initDatabase();
assert.equal(database.isPostgres, true, 'Never accept a SQLite fallback as a PG test');
const db = database.default;
const { createApp } = await import('../../app.js');
const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
async function listenApp() {
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  return server;
}
const server = await listenApp();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const tokens = new Map([1, 2, 3].map(id => [id, generateTokens(id, 1).accessToken]));
async function http(path, { user = 1, method = 'GET', body, token = tokens.get(user), baseUrl = base, ip } = {}) {
  const response = await fetch(baseUrl + path, {
    method, headers: { 'Content-Type': 'application/json',
      ...(token == null ? {} : { Authorization: 'Bearer ' + token }),
      ...(ip == null ? {} : { 'X-Forwarded-For': ip }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(scenario === 'IS02' ? 6000 : 3000),
  });
  const text = await response.text();
  return { status: response.status,
    data: text && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text,
    headers: response.headers };
}
const rehearsal = participant => ({ title: 'R0 rehearsal', startsAt: '2030-09-17T12:00:00Z',
  endsAt: '2030-09-17T13:00:00Z', participant_ids: [participant] });
const count = async (table, where = 'TRUE') => Number((await control.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
let result;

if (scenario === 'controls') {
  assert.equal((await http('/api/health')).status, 200);
  assert.equal((await http('/api/native/projects')).status, 200);
  const created = await http('/api/native/projects', { method: 'POST', body: { name: 'R0 valid project' } });
  assert.equal(created.status, 201);
  assert.equal(await count('native_project_members', `project_id = ${Number(created.data.project.id)} AND user_id = 1`), 1);
  const denied = await http('/api/native/projects/1/rehearsals', { user: 2, method: 'POST', body: rehearsal(2) });
  assert.equal(denied.status, 403);
  assert.equal(await count('native_rehearsals'), 0);
  assert.equal((await http('/api/native/projects/1/rehearsals', { method: 'POST', body: rehearsal(2) })).status, 201);
  assert.equal(await count('native_user_availability', 'user_id = 2'), 1);
  assert.equal(await count('native_notifications', 'user_id = 2'), 1);
  // The production adapter's own transaction, checked from a second connection.
  await assert.rejects(db.transaction(async tx => {
    await tx.run('INSERT INTO r0_transaction_probe(value) VALUES ($1)', ['rollback']);
    throw new Error('R0_TRANSACTION_ABORT');
  }), /R0_TRANSACTION_ABORT/);
  assert.equal(await count('r0_transaction_probe'), 0);
  await db.transaction(tx => tx.run('INSERT INTO r0_transaction_probe(value) VALUES ($1)', ['commit']));
  assert.equal(await count('r0_transaction_probe'), 1);
  const page = await fetch(base + '/admin/');
  assert.equal(page.status, 200);
  assert.ok(!page.headers.get('content-security-policy').includes("'unsafe-inline'"));
  for (const asset of ['dashboard.js', 'dashboard.css']) assert.equal((await fetch(base + '/admin/' + asset)).status, 200);
  result = { outcome: 'PASS', controls: ['health', 'project+owner', 'member403/no write', 'valid roster+busy+inbox',
    'adapter rollback and commit checked on independent connection', 'admin CSP/assets'], externalConnections: deniedConnections };
} else if (scenario === 'B02') {
  await control.query(`CREATE FUNCTION reject_second_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'R0_INJECTED_SECOND_WRITE'; END $$;
    CREATE TRIGGER reject_second_write BEFORE INSERT ON native_project_members
    FOR EACH ROW EXECUTE FUNCTION reject_second_write()`);
  const response = await http('/api/native/projects', { method: 'POST', body: { name: 'R0 orphan candidate' } });
  assert.equal(response.status, 500);
  const projects = await count('native_projects', "name = 'R0 orphan candidate'");
  assert.equal(projects, 1, 'Baseline B02: first write survives second-write failure');
  assert.equal(await count('native_project_members', 'project_id != 1'), 0);
  result = { outcome: 'KNOWN_DEFECT_REPRODUCED', status: response.status, orphanProjects: projects,
    expectation: 'Failed project creation must roll back its first write' };
} else if (scenario === 'D01') {
  assert.equal(await count('native_project_members', 'user_id = 3'), 0);
  const response = await http('/api/native/projects/1/rehearsals', { method: 'POST', body: rehearsal(3) });
  assert.equal(response.status, 201);
  assert.equal(await count('native_rehearsal_responses', 'user_id = 3'), 1);
  assert.equal(await count('native_user_availability', 'user_id = 3'), 1);
  result = { outcome: 'KNOWN_DEFECT_REPRODUCED', status: response.status, outsiderInvitations: 1, outsiderBusyRows: 1,
    expectation: 'Reject a participant outside the project before any write' };
} else if (scenario === 'B03') {
  const { probeB03 } = await import('./b03.mjs');
  result = await probeB03({ control, db, http, listenApp, allowedPorts });
  result.externalConnections = deniedConnections;
} else if (scenario === 'B04') {
  const { probeB04 } = await import('./b04.mjs');
  result = await probeB04({ control, db, http, listenApp, allowedPorts });
  result.externalConnections = deniedConnections;
} else if (scenario === 'H04') {
  const { probeH04 } = await import('./h04.mjs');
  result = await probeH04({ control, db, http });
  result.externalConnections = deniedConnections;
} else if (scenario === 'IS02') {
  const { probeIS02 } = await import('./is02.mjs');
  result = await probeIS02({ control, db, http, allowedPorts });
  result.externalConnections = deniedConnections;
} else if (scenario === 'F05') {
  const { probeF05 } = await import('./f05.mjs');
  result = await probeF05({ control, http });
  result.externalConnections = deniedConnections;
} else if (scenario === 'A02') {
  const snapshot = async () => {
    const tables = ['native_users', 'native_projects', 'native_project_members', 'native_rehearsals',
      'native_rehearsal_responses', 'native_user_availability', 'native_push_tokens',
      'native_notifications', 'r0_transaction_probe'];
    const rows = {};
    for (const table of tables) rows[table] = (await control.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    return rows;
  };
  const assertGenericFailure = response => {
    assert.equal(response.status, 500);
    assert.deepEqual(response.data, { error: 'Internal server error' }, 'No SQL, stack or details may reach the client');
  };

  assert.equal((await http('/api/native/projects')).status, 200);
  const beforeAuthFault = await snapshot();
  await control.query('ALTER TABLE native_users RENAME TO users_unavailable');
  try {
    // Both read and write routes must finish within http()'s timeout, without
    // killing this strict-rejection worker or reaching the business handler.
    assertGenericFailure(await http('/api/native/projects'));
    assertGenericFailure(await http('/api/native/projects', {
      method: 'POST', body: { name: 'A02 must never be written' },
    }));
    assert.equal((await http('/api/health')).status, 200, 'Process remains alive while the DB read is failing');
  } finally {
    await control.query('ALTER TABLE users_unavailable RENAME TO native_users');
  }
  assert.deepEqual(await snapshot(), beforeAuthFault, 'Failed auth must leave all application rows unchanged');
  assert.equal((await http('/api/native/projects')).status, 200, 'Authorized traffic recovers after the DB is restored');

  const beforeRouteFault = await snapshot();
  await control.query('ALTER TABLE native_users RENAME COLUMN timezone TO timezone_unavailable');
  try {
    assertGenericFailure(await http('/api/native/availability/bulk', {
      method: 'POST', body: { entries: [{ startsAt: '2030-09-17T12:00:00Z', type: 'busy' }] },
    }));
    assert.equal((await http('/api/health')).status, 200);
  } finally {
    await control.query('ALTER TABLE native_users RENAME COLUMN timezone_unavailable TO timezone');
  }
  assert.deepEqual(await snapshot(), beforeRouteFault, 'Pre-transaction route failure must leave all rows unchanged');
  assert.equal((await http('/api/native/projects')).status, 200);
  for (const path of ['/api/native/availability/bulk', '/api/availability/bulk']) {
    for (const entries of [[null], [{ startsAt: 17, type: 'busy' }]]) {
      const response = await http(path, { method: 'POST', body: { entries } });
      assert.equal(response.status, 400, 'Malformed entries must be rejected before database work');
      assert.deepEqual(Object.keys(response.data), ['error']);
      assert.equal(typeof response.data.error, 'string');
    }
  }
  assert.equal((await http('/api/health')).status, 200);

  // Use bcrypt itself, with a synthetic password and generated hash; no mocks
  // or deployment secrets. A malformed password must never reach bcrypt.
  const password = 'a02-synthetic-admin-password';
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(password, 4);
  for (const body of [{}, { password: null }, { password: 17 }, { password: { value: password } }]) {
    const response = await http('/admin/api/login', { method: 'POST', body });
    assert.equal(response.status, 400, 'Missing/non-string admin password must be rejected as a bad request');
    assert.deepEqual(Object.keys(response.data), ['error']);
    assert.equal(typeof response.data.error, 'string');
    assert.equal((await http('/api/health')).status, 200);
  }
  // A second app now shares the first one's quota. This independent bcrypt
  // scenario uses another synthetic client IP; IS02 verifies that a new app
  // cannot reset the same IP's allowance. The actual limiter remains enabled.
  const adminServer = await listenApp();
  const adminBase = `http://127.0.0.1:${adminServer.address().port}`;
  try {
    const wrong = await http('/admin/api/login', {
      baseUrl: adminBase, ip: '198.51.100.202', method: 'POST', body: { password: 'wrong-a02-password' },
    });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.data, { error: 'Invalid password' });
    const login = await http('/admin/api/login', {
      baseUrl: adminBase, ip: '198.51.100.202', method: 'POST', body: { password },
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.data.token, 'string');
    assert.ok(login.data.token.length > 0);
    const authorized = await http('/admin/api/users', { baseUrl: adminBase, token: login.data.token });
    assert.equal(authorized.status, 200, 'bcrypt-issued token must authorize a real admin route');
    assert.equal(authorized.data.total, 3);
  } finally {
    const adminPort = adminServer.address().port;
    await new Promise(resolve => adminServer.close(resolve));
    allowedPorts.delete(adminPort);
    delete process.env.ADMIN_PASSWORD_HASH;
  }
  assert.deepEqual(await snapshot(), beforeAuthFault, 'A02 read/login scenarios must not change application data');
  result = { outcome: 'PASS', contracts: ['auth DB rejection returns bounded generic 500 for GET/POST',
    'health survives DB fault; authorized traffic recovers', 'no application row changes during failures',
    'pre-try availability DB failure returns bounded generic 500; process alive',
    'malformed availability entries400 through both public mounts',
    'real bcrypt malformed passwords400/wrong401/correct200+usable admin token'], externalConnections: deniedConnections };
}

assert.equal(deniedConnections, 0, 'A service attempted an external connection');
console.log(JSON.stringify({ scenario, ...result }));
await new Promise(resolve => server.close(resolve));
await database.closeDatabase();
await control.end();
process.exit(0);
