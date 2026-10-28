import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const migration = readFileSync(new URL('../../migrations/009-operation-ip-rate-limits.sql', import.meta.url), 'utf8');
const initialSeconds = 1800000023;
const savedEnvironment = Object.fromEntries(['JWT_SECRET', 'NODE_ENV', 'DATABASE_URL', 'POSTGRES_URL']
  .map(key => [key, process.env[key]]));
async function loadService(db, isPostgres = false) {
  jest.resetModules();
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres }));
  return import('../../services/operationIpRateLimit.js');
}

describe('operation IP budgets with real SQLite storage and independent connections', () => {
  let directory;
  let sessions;
  let adapters;
  let a;
  let b;
  let databaseSeconds;
  const statements = [];

  beforeAll(async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.POSTGRES_URL).toBeUndefined();
    process.env.JWT_SECRET = 'is02-service-isolated-signing-secret';
    directory = mkdtempSync(join(tmpdir(), 'operation-budget-'));
    sessions = [new Database(join(directory, 'fixture.sqlite')), new Database(join(directory, 'fixture.sqlite'))];
    for (const session of sessions) {
      session.function('strftime', (format, instant) => {
        if (format !== '%s' || instant !== 'now') throw new Error('Unexpected fixture clock query');
        return String(databaseSeconds);
      });
    }
    sessions[0].exec(migration);
    adapters = sessions.map(session => {
      const adapter = Object.fromEntries(['get', 'all', 'run'].map(method => [method, (sql, params = []) => {
        statements.push({ sql, params });
        return session.prepare(sql)[method](params);
      }]));
      adapter.transaction = async callback => {
        session.exec('BEGIN');
        try {
          const result = await callback(adapter);
          session.exec('COMMIT');
          return result;
        } catch (error) { session.exec('ROLLBACK'); throw error; }
      };
      return adapter;
    });
    a = await loadService(adapters[0]);
    b = await loadService(adapters[1]);
  });
  beforeEach(() => {
    databaseSeconds = initialSeconds;
    sessions[0].exec('DELETE FROM native_operation_ip_rate_limits; UPDATE native_operation_ip_rate_limit_gates SET key_count = 0');
    statements.length = 0;
  });
  afterAll(() => {
    for (const session of sessions ?? []) session.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const rows = () => sessions[0].prepare('SELECT * FROM native_operation_ip_rate_limits ORDER BY operation, ip_key').all();
  const gate = operation => sessions[0].prepare('SELECT key_count FROM native_operation_ip_rate_limit_gates WHERE operation = ?').get(operation).key_count;
  function fill(operation, count, expired = 0) {
    const insert = sessions[0].prepare('INSERT INTO native_operation_ip_rate_limits VALUES (?, ?, ?, ?)');
    sessions[0].transaction(() => {
      for (let index = 0; index < count; index++) insert.run(operation, index.toString(16).padStart(64, '0'),
        initialSeconds + (index < expired ? -1 : 900), operation === 'auth' ? 21 : 6);
      sessions[0].prepare('UPDATE native_operation_ip_rate_limit_gates SET key_count = key_count + ? WHERE operation = ?').run(count, operation);
    })();
  }

  test.each([['auth', 20, 60], ['admin_login', 5, 900]])('%s shares exact admissions, saturates counts and survives a fresh module instance', async (operation, limit, windowSeconds) => {
    const results = [];
    // SQLite's single-writer transaction model is exercised sequentially here;
    // exact concurrent distribution is independently tested on PostgreSQL.
    for (let index = 0; index < limit + 10; index++) {
      results.push(await (index % 2 ? a : b).consumeOperationIpBudget(operation, '192.0.2.10'));
    }
    expect(results.filter(result => result.allowed)).toHaveLength(limit);
    expect(results[0]).toEqual({ allowed: true, remaining: limit - 1, retryAfter: windowSeconds, limit, windowSeconds });
    expect(results.at(-1)).toEqual({ allowed: false, remaining: 0, retryAfter: windowSeconds, limit, windowSeconds });
    expect(rows()).toEqual([expect.objectContaining({ operation, request_count: limit + 1, reset_at: initialSeconds + windowSeconds })]);
    expect(gate(operation)).toBe(1);
    const reloaded = await loadService(adapters[1]);
    expect((await reloaded.consumeOperationIpBudget(operation, '192.0.2.10')).allowed).toBe(false);
    expect(rows()).toHaveLength(1);
  });

  test('operation namespaces and canonical IPs are domain-separated without raw addresses in SQL', async () => {
    const aliases = ['192.0.2.10', '::ffff:192.0.2.10', '::ffff:c000:20a', '0:0:0:0:0:FFFF:C000:020A'];
    for (const ip of aliases) await a.consumeOperationIpBudget('auth', ip);
    await b.consumeOperationIpBudget('admin_login', aliases[0]);
    expect(rows()).toHaveLength(2);
    expect(new Set(rows().map(row => row.ip_key)).size).toBe(2);
    expect(rows().find(row => row.operation === 'auth').request_count).toBe(4);
    for (const row of rows()) expect(row.ip_key).toMatch(/^[a-f0-9]{64}$/);
    for (const ip of aliases) expect(JSON.stringify(statements)).not.toContain(ip);
  });

  test.each([['auth', 20, 60], ['admin_login', 5, 900]])('%s deadlines stay first-request anchored, reset at expiry and reject older-clock reopening', async (operation, limit, windowSeconds) => {
    await a.consumeOperationIpBudget(operation, '192.0.2.10');
    const deadline = rows()[0].reset_at;
    databaseSeconds += 7;
    const appClock = jest.spyOn(Date, 'now').mockImplementation(() => { throw new Error('App clock used by storage'); });
    try {
      expect((await b.consumeOperationIpBudget(operation, '192.0.2.10')).retryAfter).toBe(windowSeconds - 7);
      expect(rows()[0].reset_at).toBe(deadline);
      databaseSeconds = deadline;
      expect(await a.consumeOperationIpBudget(operation, '192.0.2.10')).toEqual({ allowed: true, remaining: limit - 1,
        retryAfter: windowSeconds, limit, windowSeconds });
      for (let index = 0; index < limit; index++) await a.consumeOperationIpBudget(operation, '192.0.2.10');
      databaseSeconds = initialSeconds;
      expect((await b.consumeOperationIpBudget(operation, '192.0.2.10')).allowed).toBe(false);
      expect((await b.consumeOperationIpBudget(operation, '192.0.2.10')).retryAfter).toBe(windowSeconds);
      expect(rows()[0]).toMatchObject({ request_count: limit + 1, reset_at: deadline + windowSeconds });
    } finally { appClock.mockRestore(); }
  });

  test('capacity rejects new identities without evicting active keys or exhausting the other namespace', async () => {
    await a.consumeOperationIpBudget('auth', '192.0.2.10');
    fill('auth', 9999);
    const before = rows();
    await expect(b.consumeOperationIpBudget('auth', '192.0.2.11')).rejects.toThrow(/capacity/);
    expect(rows()).toEqual(before);
    expect(gate('auth')).toBe(10000);
    expect((await b.consumeOperationIpBudget('auth', '192.0.2.10')).remaining).toBe(18);
    expect((await b.consumeOperationIpBudget('admin_login', '192.0.2.11')).allowed).toBe(true);
    expect(gate('admin_login')).toBe(1);
  });

  test('allocation prunes at most 64 expired rows and leaves every active row intact', async () => {
    fill('auth', 10000, 65);
    expect((await b.consumeOperationIpBudget('auth', '192.0.2.12')).allowed).toBe(true);
    expect(rows()).toHaveLength(9937);
    expect(rows().filter(row => row.reset_at < initialSeconds)).toHaveLength(1);
    expect(rows().filter(row => row.request_count === 21 && row.reset_at > initialSeconds)).toHaveLength(9935);
    expect(gate('auth')).toBe(9937);
    expect(statements.some(({ sql }) => /COUNT\s*\(/i.test(sql))).toBe(false);
  });

  test('a trigger failure after allocation rolls back pruning, insertion and the gate', async () => {
    fill('auth', 3, 2);
    const before = rows();
    sessions[0].exec(`CREATE TRIGGER operation_insert_failure AFTER INSERT ON native_operation_ip_rate_limits
      BEGIN SELECT RAISE(ABORT, 'synthetic allocation failure'); END;`);
    try {
      // The native driver can retain a constructor from a previous Jest VM.
      // Check the actual trigger rejection rather than realm-sensitive Error
      // identity; rollback and recovery remain independently asserted below.
      await expect(a.consumeOperationIpBudget('auth', '192.0.2.13')).rejects.toMatchObject({
        code: 'SQLITE_CONSTRAINT_TRIGGER', message: 'synthetic allocation failure',
      });
      expect(rows()).toEqual(before);
      expect(gate('auth')).toBe(3);
    } finally { sessions[0].exec('DROP TRIGGER operation_insert_failure'); }
    expect((await a.consumeOperationIpBudget('auth', '192.0.2.13')).allowed).toBe(true);
    expect(gate('auth')).toBe(2);
  });

  test('a missing gate fails closed without creating an orphan counter', async () => {
    sessions[0].prepare('DELETE FROM native_operation_ip_rate_limit_gates WHERE operation = ?').run('auth');
    try {
      await expect(a.consumeOperationIpBudget('auth', '192.0.2.14')).rejects.toThrow(/gate storage/);
      expect(rows()).toEqual([]);
    } finally { sessions[0].exec(migration); }
    expect((await a.consumeOperationIpBudget('auth', '192.0.2.14')).allowed).toBe(true);
  });

  test('the actual migration rejects invalid namespaces, digests, integral counters and deadlines', async () => {
    const insert = sessions[0].prepare('INSERT INTO native_operation_ip_rate_limits VALUES (?, ?, ?, ?)');
    for (const values of [
      ['other', 'a'.repeat(64), 1, 1], ['auth', 'a'.repeat(63), 1, 1], ['auth', 'G'.repeat(64), 1, 1],
      ['auth', 'a'.repeat(64), -1, 1], ['auth', 'a'.repeat(64), 1.5, 1],
      ['auth', 'a'.repeat(64), 1, 0], ['auth', 'a'.repeat(64), 1, 22], ['auth', 'a'.repeat(64), 1, 1.5],
      ['admin_login', 'a'.repeat(64), 1, 7],
    ]) expect(() => insert.run(...values)).toThrow();
    const update = sessions[0].prepare('UPDATE native_operation_ip_rate_limit_gates SET key_count = ? WHERE operation = ?');
    for (const count of [-1, 10001, 1.5]) expect(() => update.run(count, 'auth')).toThrow();
    expect(() => sessions[0].prepare('INSERT INTO native_operation_ip_rate_limit_gates VALUES (?, ?)').run('other', 0)).toThrow();
    await a.consumeOperationIpBudget('auth', '192.0.2.10');
    const before = rows();
    sessions[0].exec(migration);
    sessions[0].exec(migration);
    expect(rows()).toEqual(before);
    expect(gate('auth')).toBe(1);
  });

  test.each([undefined, null, '', 'not-an-ip', 'fe80::1%eth0', {}, 3])('invalid IP %p cannot allocate a key', async ip => {
    await expect(a.consumeOperationIpBudget('auth', ip)).rejects.toThrow();
    expect(rows()).toEqual([]);
    expect(statements).toEqual([]);
  });

  test.each(['__proto__', '/api/auth', 'login', undefined, {}])('unknown operation %p cannot allocate a key', async operation => {
    await expect(a.consumeOperationIpBudget(operation, '192.0.2.10')).rejects.toThrow(/Unknown operation/);
    expect(statements).toEqual([]);
  });
});

describe('storage adapter boundary', () => {
  test.each([
    null, {}, { request_count: 0, retry_after: 1 }, { request_count: 22, retry_after: 1 },
    { request_count: '1', retry_after: 1 }, { request_count: 1.5, retry_after: 1 },
    { request_count: 1, retry_after: 0 }, { request_count: 1, retry_after: 61 },
    { request_count: 1, retry_after: '1' },
  ])('malformed returned row %p is never interpreted as admission', async row => {
    const get = jest.fn().mockResolvedValue(row);
    const transaction = jest.fn(callback => callback({ get, all: jest.fn() }));
    const service = await loadService({ transaction });
    await expect(service.consumeOperationIpBudget('auth', '192.0.2.10')).rejects.toThrow(/storage result/);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('uninitialized adapter is importable but cannot admit a request', async () => {
    const service = await loadService({});
    expect(service.getOperationIpPolicy('auth').limit).toBe(20);
    await expect(service.consumeOperationIpBudget('auth', '192.0.2.10')).rejects.toThrow(/unavailable/);
  });
});
