// Separate-process application fixture. No server.js, dotenv or external calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import net from 'node:net';

// A killed/timed-out parent cannot run its finally. Never orphan this owned
// HTTP listener or adapter pool if that parent loses the IPC connection.
process.on('disconnect', () => process.exit(1));

const serverRoot = new URL(process.argv[2]);
assert.equal(serverRoot.protocol, 'file:');
assert.equal(process.env.NODE_ENV, 'production');
assert.equal(process.env.POSTGRES_URL, undefined);
assert.match(process.env.R0_NONCE || '', /^[a-f0-9]{24}$/);
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/r0_test');
assert.equal(target.username, 'r0_owner');
assert.equal(target.searchParams.get('options'), '-c search_path=r0_fixture');
assert.ok(/^\d+$/.test(target.port) && Number(target.port) > 1024);
const require = createRequire(new URL('package.json', serverRoot));
const { Client } = require('pg');
let deniedConnections = 0;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof values[0] === 'object' ? values[0] : { port: values[0], host: values[1] };
  if (options.host !== '127.0.0.1' || Number(options.port) !== Number(target.port) || options.path) {
    deniedConnections++;
    throw new Error('IS02 worker blocked a non-fixture connection');
  }
  return connect.apply(this, args);
};

let phase = 'ownership';
try {
  const control = new Client({ connectionString: target.href, connectionTimeoutMillis: 3000 });
  await control.connect();
  try {
    const marker = await control.query('SELECT nonce FROM public.r0_owned_database');
    assert.equal(marker.rows[0]?.nonce, process.env.R0_NONCE);
  } finally { await control.end(); }
  phase = 'adapter';
  const database = await import(new URL('database/db.js', serverRoot));
  await database.initDatabase();
  assert.equal(database.isPostgres, true, 'A worker cannot substitute SQLite for PostgreSQL');
  const db = database.default;
  let businessCalls = 0;
  const storageSqlStates = [];
  const trace = (object, method) => {
    const original = object[method];
    return async function (sql, params = []) {
      if (/\bnative_(?:users|auth_providers|projects|project_members|rehearsals|rehearsal_responses|user_availability|push_tokens|notifications)\b/i.test(sql)) businessCalls++;
      try { return await original.call(object, sql, params); }
      catch (error) {
        if (/\bnative_operation_ip_rate_limit(?:s|_gates)\b/.test(sql)
          && /^[A-Z0-9]{5}$/.test(error.code || '')) storageSqlStates.push(error.code);
        throw error;
      }
    };
  };
  // Record real call-through work, including the transaction-scoped handle.
  const transaction = db.transaction.bind(db);
  for (const method of ['get', 'all', 'run']) db[method] = trace(db, method);
  db.transaction = fn => transaction(scoped => fn(Object.fromEntries(
    ['get', 'all', 'run'].map(method => [method, trace(scoped, method)]),
  )));
  phase = 'application';
  const { createApp } = await import(new URL('app.js', serverRoot));
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  process.on('message', async message => {
    if (message?.type === 'stats') {
      process.send({ type: 'stats', id: message.id, businessCalls, deniedConnections, storageSqlStates });
    } else if (message?.type === 'stop') {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      process.exit(deniedConnections === 0 ? 0 : 1);
    }
  });
  process.send({ type: 'ready', port: server.address().port, pid: process.pid });
} catch {
  // Never echo a connection string, SQL error, credential or driver message.
  process.send?.({ type: 'failed', phase });
  process.exit(1);
}
