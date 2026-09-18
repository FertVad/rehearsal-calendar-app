// Isolated worker: no server.js, dotenv, migrations or real credentials.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';

const scenario = process.argv[2];
assert.ok(['controls', 'A02', 'B02', 'D01', 'F01'].includes(scenario));
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
target.searchParams.set('options', '-c search_path=r0_fixture');
process.env.DATABASE_URL = target.href;
const database = await import('../../database/db.js');
// The current adapter can fall back to SQLite (F03/R2). The runner uses a fresh
// temp cwd with no server/database directory, so fallback cannot touch the repo.
await database.initDatabase();
assert.equal(database.isPostgres, true, 'Never accept a SQLite fallback as a PG test');
const db = database.default;
const { createApp } = await import('../../app.js');
const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
const app = createApp();
const server = await new Promise((resolve, reject) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  listener.once('error', reject);
});
const port = server.address().port;
allowedPorts.add(port);
const base = `http://127.0.0.1:${port}`;
const tokens = new Map([1, 2, 3].map(id => [id, generateTokens(id, 1).accessToken]));
async function http(path, { user = 1, method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.get(user) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(3000),
  });
  return { status: response.status, data: await response.json() };
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
} else if (scenario === 'A02') {
  assert.equal((await http('/api/native/projects')).status, 200);
  await control.query('ALTER TABLE native_users RENAME TO users_unavailable');
  // Strict unhandled-rejection mode terminates THIS disposable worker. The
  // parent requires both this marker and the real PG error before accepting it.
  console.log('R0_A02_DISPATCH_AFTER_REAL_DB_FAULT');
  await http('/api/native/projects');
  throw new Error('A02 baseline did not terminate on the rejected auth DB read');
}

assert.equal(deniedConnections, 0, 'A service attempted an external connection');
console.log(JSON.stringify({ scenario, ...result }));
await new Promise(resolve => server.close(resolve));
await control.end();
// db.js currently exposes no close hook. Each probe lives in its own process;
// terminating it closes the production adapter pool without altering R2 code.
process.exit(0);
