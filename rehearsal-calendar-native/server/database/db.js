/** PostgreSQL runtime adapter. SQLite belongs to isolated test fixtures only. */
import pkg from 'pg';

const { Pool } = pkg;
const poolPolicy = Object.freeze({
  max: 10,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 10000,
});
const maximumQueuedAcquisitions = 100;
const probeTimeoutMs = 2000;

let db;
let runtime;
let candidate;
let initializing;
let closing;
let state = 'uninitialized';
export let isPostgres = false;

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Database is temporarily unavailable');
    this.name = 'DatabaseUnavailableError';
    this.code = 'DATABASE_UNAVAILABLE';
  }
}

export function getDatabaseStatus() {
  // This is initialization state, not a cached promise of network availability.
  return Object.freeze({ state });
}

function unavailable() { return new DatabaseUnavailableError(); }

function connectionString(options) {
  if (options === undefined) options = {};
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'connectionString')) throw unavailable();
  const value = Object.hasOwn(options, 'connectionString')
    ? options.connectionString : process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (typeof value !== 'string' || !value.trim()) throw unavailable();
  try {
    const parsed = new URL(value.trim());
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || !parsed.hostname || parsed.pathname.length <= 1) throw unavailable();
  } catch { throw unavailable(); }
  return value.trim();
}

function createRuntime(url) {
  const pool = new Pool({ connectionString: url, ...poolPolicy });
  // pg-pool removes a failed idle client before emitting this event. Observe it
  // without logging driver messages/credentials or crashing the whole app.
  pool.on('error', () => {});
  // pg-pool removes its idle listener before connect() resolves. Keep one
  // observer for the handoff until acquire() can attach its lease listener.
  // The first failed query/disconnect then discards that client normally.
  pool.on('connect', client => client.on('error', () => {}));
  return { pool, accepting: true, leases: new Set(), acquisitions: new Set(), endPromise: undefined };
}

async function acquire(owner) {
  if (!owner.accepting || owner.pool.waitingCount >= maximumQueuedAcquisitions) throw unavailable();
  let client;
  let pending;
  try {
    pending = owner.pool.connect();
    owner.acquisitions.add(pending);
    client = await pending;
  } catch { throw unavailable(); }
  finally { owner.acquisitions.delete(pending); }
  if (!owner.accepting) {
    client.release(true);
    throw unavailable();
  }
  const lease = {
    client,
    active: true,
    release(error) {
      if (!lease.active) return;
      lease.active = false;
      owner.leases.delete(lease);
      client.removeListener('error', onError);
      client.release(error);
    },
  };
  // A checked-out client may fail while the JS callback is between queries.
  // Its error must be observed even when no client.query promise is pending.
  const onError = error => lease.release(error || true);
  client.on('error', onError);
  owner.leases.add(lease);
  return lease;
}

function checkLease(lease) {
  if (!lease.active) throw unavailable();
}

function endRuntime(owner) {
  if (!owner) return Promise.resolve();
  owner.accepting = false;
  // pg-pool may finish end() before its queued-acquisition timers fire. Observe
  // their settlement too; none can publish a new lease after accepting=false.
  owner.endPromise ??= Promise.all([
    owner.pool.end(),
    Promise.allSettled([...owner.acquisitions]),
  ]).then(() => {});
  return owner.endPromise;
}

function transform(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function methods(query) {
  return {
    async run(sql, params = []) {
      let statement = sql.trim();
      if (/^insert\s+/i.test(statement) && !/returning/i.test(statement)) statement += ' RETURNING id';
      const result = await query(transform(statement), params);
      return { lastInsertId: result.rows[0]?.id, changes: result.rowCount };
    },
    async get(sql, params = []) {
      return (await query(transform(sql), params)).rows[0];
    },
    async all(sql, params = []) {
      return (await query(transform(sql), params)).rows;
    },
  };
}

function createAdapter(owner) {
  const query = async (sql, params) => {
    const lease = await acquire(owner);
    try {
      checkLease(lease);
      return await lease.client.query(sql, params);
    } catch (error) {
      lease.release(error || true);
      throw error;
    } finally {
      lease.release();
    }
  };
  return {
    ...methods(query),
    async transaction(callback) {
      if (typeof callback !== 'function') throw new TypeError('Transaction callback is required');
      const lease = await acquire(owner);
      let begun = false;
      let scopeOpen = true;
      let discard;
      const scoped = methods((sql, params) => {
        if (!scopeOpen) {
          const error = new Error('Database transaction is closed');
          error.code = 'DATABASE_TRANSACTION_CLOSED';
          return Promise.reject(error);
        }
        checkLease(lease);
        return lease.client.query(sql, params);
      });
      try {
        checkLease(lease);
        await lease.client.query('BEGIN');
        begun = true;
        let result;
        try { result = await callback(scoped); }
        finally { scopeOpen = false; }
        checkLease(lease);
        const commit = await lease.client.query('COMMIT');
        // PostgreSQL answers ROLLBACK for COMMIT on an aborted transaction.
        // A callback catching a failed statement cannot manufacture success.
        if (commit.command !== 'COMMIT') throw new Error('Database transaction did not commit');
        return result;
      } catch (error) {
        if (begun && lease.active) {
          try { await lease.client.query('ROLLBACK'); }
          catch (rollbackError) { discard = rollbackError || true; }
        } else {
          discard = error || true;
        }
        throw error;
      } finally {
        scopeOpen = false;
        lease.release(discard);
      }
    },
  };
}

async function probe(owner) {
  const lease = await acquire(owner);
  try {
    checkLease(lease);
    await lease.client.query({ text: 'SELECT 1', query_timeout: probeTimeoutMs });
  } catch {
    // A client-side read timeout does not promise server cancellation. Never
    // return that client to circulation after an uncertain probe result.
    lease.release(true);
    throw unavailable();
  } finally {
    lease.release();
  }
}

export function initDatabase(options) {
  if (closing) return Promise.reject(unavailable());
  if (runtime) return Promise.resolve(db);
  if (initializing) return initializing;
  let url;
  try { url = connectionString(options); }
  catch {
    state = 'unavailable';
    return Promise.reject(unavailable());
  }
  state = 'initializing';
  // Begin after assigning the shared promise, even if Pool construction fails.
  const attempt = Promise.resolve().then(async () => {
    let owned;
    try {
      // closeDatabase may have invalidated this attempt before this microtask.
      if (state !== 'initializing') throw unavailable();
      owned = createRuntime(url);
      candidate = owned;
      await probe(owned);
      if (!owned.accepting || state !== 'initializing') throw unavailable();
      runtime = owned;
      db = createAdapter(owned);
      isPostgres = true;
      state = 'ready';
      return db;
    } catch {
      try { await endRuntime(owned); } catch { /* Generic failure below. */ }
      if (state !== 'closing') state = 'unavailable';
      throw unavailable();
    } finally {
      if (candidate === owned) candidate = undefined;
    }
  });
  initializing = attempt;
  // Observe settlement without creating an unhandled finally() rejection.
  attempt.then(
    () => { if (initializing === attempt) initializing = undefined; },
    () => { if (initializing === attempt) initializing = undefined; }
  );
  return attempt;
}

export async function testConnection() {
  const owner = runtime;
  if (!owner || state !== 'ready') throw unavailable();
  await probe(owner);
}

export function closeDatabase() {
  if (closing) return closing;
  const owners = [...new Set([runtime, candidate].filter(Boolean))];
  const attempt = initializing;
  state = 'closing';
  db = undefined;
  runtime = undefined;
  // Existing scoped operations still use this live engine flag to choose SQL.
  // Keep their PostgreSQL identity until every issued lease has drained.
  // Stop new admissions immediately. Issued leases and their transaction
  // callbacks drain; scoped handles still expire when the callback returns.
  // Arbitrary JavaScript callbacks cannot be safely cancelled.
  for (const owner of owners) owner.accepting = false;
  const completion = Promise.resolve().then(async () => {
    const results = await Promise.allSettled([
      ...owners.map(endRuntime),
      ...(attempt ? [attempt.catch(() => {})] : []),
    ]);
    if (results.some(result => result.status === 'rejected')) throw unavailable();
  });
  closing = completion;
  completion.then(
    () => { if (closing === completion) { closing = undefined; isPostgres = false; state = 'uninitialized'; } },
    () => { if (closing === completion) { closing = undefined; isPostgres = false; state = 'unavailable'; } }
  );
  return completion;
}

export { db as default };
