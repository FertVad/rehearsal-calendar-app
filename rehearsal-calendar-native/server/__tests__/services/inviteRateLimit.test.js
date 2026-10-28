import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const migration = readFileSync(
  new URL('../../migrations/008-invite-rate-limits.sql', import.meta.url), 'utf8'
);
const initialSeconds = 1800000023;
const windowStart = initialSeconds - initialSeconds % 60;
const secret = 'synthetic-invite-budget-secret';
const digest = (key, signingSecret = secret) => createHmac('sha256', signingSecret).update(key).digest('hex');

async function loadService(db, isPostgres) {
  jest.resetModules();
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres }));
  return import('../../services/inviteRateLimit.js');
}

describe('shared invite budgets using the actual SQLite migration', () => {
  let directory;
  let sessions;
  let adapters;
  let a;
  let b;
  let databaseSeconds;
  const previousSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    directory = mkdtempSync(join(tmpdir(), 'invite-budget-'));
    sessions = [new Database(join(directory, 'fixture.sqlite')), new Database(join(directory, 'fixture.sqlite'))];
    for (const session of sessions) {
      session.pragma('foreign_keys = ON');
      session.function('strftime', (format, instant) => {
        if (format !== '%s' || instant !== 'now') throw new Error('Unexpected DB clock query');
        return String(databaseSeconds);
      });
    }
    sessions[0].exec('CREATE TABLE native_users (id INTEGER PRIMARY KEY)');
    sessions[0].exec(migration);
    sessions[0].exec(migration);
    adapters = sessions.map((session) => {
      const adapter = {
        get: jest.fn((sql, params = []) => session.prepare(sql).get(params)),
        all: jest.fn((sql, params = []) => session.prepare(sql).all(params)),
        async transaction(fn) {
          session.exec('BEGIN');
          try {
            const result = await fn(adapter);
            session.exec('COMMIT');
            return result;
          } catch (error) {
            session.exec('ROLLBACK');
            throw error;
          }
        },
      };
      return adapter;
    });
    a = await loadService(adapters[0], false);
    b = await loadService(adapters[1], false);
  });

  beforeEach(() => {
    databaseSeconds = initialSeconds;
    sessions[0].exec(`DELETE FROM native_users;
      INSERT INTO native_users (id) VALUES (1), (2);
      DELETE FROM native_invite_ip_rate_limits;
      UPDATE native_invite_ip_rate_limit_gate SET key_count = 0 WHERE id = 1;`);
    for (const adapter of adapters) {
      adapter.get.mockClear();
      adapter.all.mockClear();
    }
  });

  afterAll(() => {
    for (const session of sessions ?? []) session.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  function ipRows() {
    return sessions[0].prepare('SELECT * FROM native_invite_ip_rate_limits ORDER BY ip_key').all();
  }

  function fillIps(total, expired = 0) {
    const insert = sessions[0].prepare(`INSERT INTO native_invite_ip_rate_limits
      (ip_key, window_start, request_count) VALUES (?, ?, 21)`);
    sessions[0].transaction(() => {
      for (let index = 0; index < total; index++) {
        insert.run(index.toString(16).padStart(64, '0'), windowStart - (index < expired ? 60 : 0));
      }
      sessions[0].prepare('UPDATE native_invite_ip_rate_limit_gate SET key_count = key_count + ? WHERE id = 1').run(total);
    })();
  }

  it('shares 20 account admissions across instances, saturates at 21, and isolates users', async () => {
    const results = await Promise.all(Array.from({ length: 70 }, (_, index) =>
      (index % 2 ? a : b).consumeInviteAccountBudget(1)
    ));
    expect(results.filter((result) => result.allowed)).toHaveLength(20);
    expect(results.slice(20)).toEqual(Array.from({ length: 50 }, () => ({ allowed: false, retryAfter: 37, remaining: 0 })));
    expect(await b.consumeInviteAccountBudget('2')).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
    expect(sessions[1].prepare('SELECT * FROM native_invite_account_rate_limits ORDER BY user_id').all())
      .toEqual([
        { user_id: 1, window_start: windowStart, request_count: 21 },
        { user_id: 2, window_start: windowStart, request_count: 1 },
      ]);
  });

  it('shares 20 IP admissions across instances and IPv4 mapped aliases without storing the address', async () => {
    const aliases = ['192.0.2.123', '::ffff:192.0.2.123', '::ffff:c000:27b', '0:0:0:0:0:FFFF:C000:027B'];
    const results = [];
    for (let index = 0; index < 45; index++) {
      results.push(await (index % 2 ? a : b).consumeInviteIpBudget(aliases[index % aliases.length]));
    }
    expect(results.filter((result) => result.allowed)).toHaveLength(20);
    expect(ipRows()).toEqual([{ ip_key: digest(aliases[0]), window_start: windowStart, request_count: 21 }]);
    const sqlArguments = JSON.stringify(adapters.flatMap((adapter) => adapter.get.mock.calls));
    for (const alias of aliases) expect(sqlArguments).not.toContain(alias);
    expect(sessions[0].prepare('SELECT key_count FROM native_invite_ip_rate_limit_gate').get().key_count).toBe(1);
    expect(await b.consumeInviteIpBudget('192.0.2.124')).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
  });

  it('groups equivalent IPv6 spellings and rotating addresses within the same /56', async () => {
    const aliases = ['2001:db8:abcd:1200::1', '2001:DB8:ABCD:12FF:0:0:0:2', '2001:db8:abcd:12ab::ffff'];
    for (let index = 0; index < 21; index++) await a.consumeInviteIpBudget(aliases[index % aliases.length]);
    expect(await b.consumeInviteIpBudget('2001:db8:abcd:12f0:aaaa::abcd')).toEqual({ allowed: false, retryAfter: 37, remaining: 0 });
    expect(await b.consumeInviteIpBudget('2001:db8:abcd:1300::1')).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
    expect(ipRows()).toHaveLength(2);
    expect(ipRows().find((row) => row.ip_key === digest('2001:db8:abcd:1200::/56')).request_count).toBe(21);
  });

  it('resets both budgets in place from DB time, with monotonic windows under an older clock', async () => {
    for (let index = 0; index < 21; index++) {
      await a.consumeInviteIpBudget('192.0.2.1');
      await a.consumeInviteAccountBudget(1);
    }
    const appClock = jest.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Application clock used'); });
    try {
      databaseSeconds += 60;
      expect(await b.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
      expect(await b.consumeInviteAccountBudget(1)).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
      for (let index = 1; index < 21; index++) {
        await a.consumeInviteIpBudget('192.0.2.1');
        await a.consumeInviteAccountBudget(1);
      }
      databaseSeconds -= 60;
      expect(await b.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: false, retryAfter: 60, remaining: 0 });
      expect(await b.consumeInviteAccountBudget(1)).toEqual({ allowed: false, retryAfter: 60, remaining: 0 });
    } finally {
      appClock.mockRestore();
    }
    expect(ipRows()[0]).toMatchObject({ window_start: windowStart + 60, request_count: 21 });
    expect(sessions[0].prepare('SELECT * FROM native_invite_account_rate_limits').get())
      .toMatchObject({ window_start: windowStart + 60, request_count: 21 });
  });

  it('caps IP keys at 10000, fails closed on a new key, and preserves every active key', async () => {
    await a.consumeInviteIpBudget('192.0.2.1');
    fillIps(9999);
    await expect(b.consumeInviteIpBudget('192.0.2.2')).rejects.toThrow(/capacity unavailable/);
    expect(ipRows()).toHaveLength(10000);
    expect(await b.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: true, retryAfter: 37, remaining: 18 });
    expect(sessions[0].prepare('SELECT key_count FROM native_invite_ip_rate_limit_gate').get().key_count).toBe(10000);
    expect(ipRows().filter((row) => row.request_count === 21)).toHaveLength(9999);
  });

  it('prunes at most 64 expired rows on allocation and updates the gate without evicting active rows', async () => {
    fillIps(10000, 65);
    expect(await b.consumeInviteIpBudget('192.0.2.3')).toEqual({ allowed: true, retryAfter: 37, remaining: 19 });
    expect(ipRows()).toHaveLength(9937);
    expect(ipRows().filter((row) => row.window_start < windowStart)).toHaveLength(1);
    expect(ipRows().filter((row) => row.window_start === windowStart && row.request_count === 21)).toHaveLength(9935);
    expect(sessions[0].prepare('SELECT key_count FROM native_invite_ip_rate_limit_gate').get().key_count).toBe(9937);
    expect(adapters[1].all).toHaveBeenCalledTimes(1);
    expect(adapters[1].all.mock.calls[0][0]).toMatch(/\) AND window_start </);
  });

  it('ties account cardinality to native users and cascades user deletion', async () => {
    await a.consumeInviteAccountBudget(1);
    await expect(b.consumeInviteAccountBudget(999)).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
    sessions[0].prepare('DELETE FROM native_users WHERE id = 1').run();
    expect(sessions[1].prepare('SELECT * FROM native_invite_account_rate_limits').all()).toEqual([]);
  });

  it('enforces the portable schema constraints and idempotent gate initialization', () => {
    const insert = sessions[0].prepare(`INSERT INTO native_invite_ip_rate_limits
      (ip_key, window_start, request_count) VALUES (?, ?, ?)`);
    for (const key of ['f'.repeat(63), 'g'.repeat(64), 'A'.repeat(64), null]) {
      expect(() => insert.run(key, windowStart, 1)).toThrow();
    }
    for (const [window, count] of [[-60, 1], [1, 1], [windowStart, 0], [windowStart, 22]]) {
      expect(() => insert.run('a'.repeat(64), window, count)).toThrow(/CHECK constraint/);
    }
    const accountInsert = sessions[0].prepare(`INSERT INTO native_invite_account_rate_limits
      (user_id, window_start, request_count) VALUES (1, ?, ?)`);
    for (const [window, count] of [[-60, 1], [1, 1], [windowStart, 0], [windowStart, 22]]) {
      expect(() => accountInsert.run(window, count)).toThrow(/CHECK constraint/);
    }
    for (const count of [-1, 10001]) {
      expect(() => sessions[0].prepare('UPDATE native_invite_ip_rate_limit_gate SET key_count = ?').run(count)).toThrow(/CHECK constraint/);
    }
    expect(() => sessions[0].prepare('INSERT INTO native_invite_ip_rate_limit_gate VALUES (2, 0)').run()).toThrow(/CHECK constraint/);
    fillIps(3);
    sessions[0].exec(migration);
    expect(sessions[0].prepare('SELECT key_count FROM native_invite_ip_rate_limit_gate').get().key_count).toBe(3);
  });
});

describe('invite store PostgreSQL boundary and failure guards', () => {
  let get;
  let all;
  let transaction;
  let service;

  beforeEach(async () => {
    get = jest.fn().mockResolvedValue({ request_count: 1, retry_after: 23 });
    all = jest.fn().mockResolvedValue([]);
    const db = { get, all };
    transaction = jest.fn((fn) => fn(db));
    db.transaction = transaction;
    service = await loadService(db, true);
  });

  it('uses a DB-clock atomic UPDATE for existing IP keys without taking the gate', async () => {
    expect(await service.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: true, retryAfter: 23, remaining: 19 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
    const [sql, params] = get.mock.calls[0];
    expect(sql).toContain('statement_timestamp()');
    expect(sql).toContain('UPDATE native_invite_ip_rate_limits');
    expect(sql).toContain('WHEN request_count < 21 THEN request_count + 1');
    expect(params).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
  });

  it('locks the singleton and rechecks after concurrent allocation', async () => {
    get.mockReset()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ key_count: 8 })
      .mockResolvedValueOnce({ request_count: 21, retry_after: 12 });
    expect(await service.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: false, retryAfter: 12, remaining: 0 });
    expect(get.mock.calls[1][0]).toContain('WHERE id = 1 FOR UPDATE');
    expect(get.mock.calls[2][0]).toContain('UPDATE native_invite_ip_rate_limits');
    expect(all).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('performs bounded prune, insert and counter increment on the transaction handle', async () => {
    get.mockReset()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ key_count: 8 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ key_count: 7 })
      .mockResolvedValueOnce({ request_count: 1, retry_after: 23 })
      .mockResolvedValueOnce({ key_count: 8 });
    all.mockResolvedValue([{ ip_key: 'a'.repeat(64) }]);
    expect(await service.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: true, retryAfter: 23, remaining: 19 });
    expect(all.mock.calls[0][0]).toContain('LIMIT 64');
    expect(all.mock.calls[0][0]).toMatch(/\) AND window_start </);
    expect(all.mock.calls[0][0]).toContain('RETURNING ip_key');
    expect(get.mock.calls[3][1]).toEqual([1, 1]);
    expect(get.mock.calls[5][0]).toContain('key_count < 10000');
  });

  it.each([
    null, {}, { request_count: 0, retry_after: 1 }, { request_count: 22, retry_after: 1 },
    { request_count: 1.5, retry_after: 1 }, { request_count: '1', retry_after: 1 },
    { request_count: 1, retry_after: 0 }, { request_count: 1, retry_after: 61 },
    { request_count: 1, retry_after: '1' }, { request_count: 1, retry_after: NaN },
  ])('fails closed on malformed budget result %p', async (row) => {
    get.mockResolvedValue(row);
    await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/storage result/);
    await expect(service.consumeInviteAccountBudget(1)).rejects.toThrow(/storage result/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { key_count: -1 }, { key_count: 10001 }, { key_count: '1' }, { key_count: 1.5 }])(
    'fails closed on malformed singleton state %p', async (row) => {
      get.mockReset().mockResolvedValueOnce(undefined).mockResolvedValueOnce(row);
      await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/gate storage result/);
      expect(all).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, null, {}, [null], [{ ip_key: 'raw-address' }], Array.from({ length: 65 }, () => ({ ip_key: 'a'.repeat(64) })), [{ ip_key: 'a'.repeat(64) }, { ip_key: 'a'.repeat(64) }]])(
    'fails closed on malformed prune output %p', async (rows) => {
      get.mockReset().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ key_count: 8 }).mockResolvedValueOnce(undefined);
      all.mockResolvedValue(rows);
      await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/prune storage result/);
      expect(get).toHaveBeenCalledTimes(3);
    }
  );

  it('propagates missing tables/unavailable storage and permits retry after recovery', async () => {
    get.mockRejectedValueOnce(new Error('fixture unavailable'));
    await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow('fixture unavailable');
    get.mockRejectedValueOnce(new Error('fixture table missing'));
    await expect(service.consumeInviteAccountBudget(1)).rejects.toThrow('fixture table missing');
    expect(await service.consumeInviteIpBudget('192.0.2.1')).toEqual({ allowed: true, retryAfter: 23, remaining: 19 });
    expect(await service.consumeInviteAccountBudget(1)).toEqual({ allowed: true, retryAfter: 23, remaining: 19 });
  });

  it.each(['DATABASE_URL', 'POSTGRES_URL'])('refuses SQLite fallback when %s configures PostgreSQL', async (variable) => {
    const previous = process.env[variable];
    service = await loadService({ get, all, transaction }, false);
    process.env[variable] = 'postgresql://synthetic.invalid/never-connected';
    try {
      await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/Configured PostgreSQL is unavailable/);
      await expect(service.consumeInviteAccountBudget(1)).rejects.toThrow(/Configured PostgreSQL is unavailable/);
      expect(get).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env[variable];
      else process.env[variable] = previous;
    }
  });

  it.each([undefined, null, false, 0, -1, 1.5, '', '1/route', {}, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid account identity %p before storage', async (id) => {
      await expect(service.consumeInviteAccountBudget(id)).rejects.toThrow(/authenticated user ID/);
      expect(get).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, null, false, 1, '', '127.0.0.1:80', '127.000.0.1', '999.0.0.1', '192.0.2.1/24', '::gggg', 'arbitrary-key', 'fe80::1%eth0']) (
    'rejects invalid/scoped IP identity %p before storage', async (ip) => {
      await expect(service.consumeInviteIpBudget(ip)).rejects.toThrow(/valid IP address/);
      expect(get).not.toHaveBeenCalled();
    }
  );

  it('requires the existing JWT secret in production and uses the auth fallback only locally', async () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousMode = process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/JWT_SECRET is required/);
      expect(get).not.toHaveBeenCalled();
      process.env.JWT_SECRET = '  ';
      await expect(service.consumeInviteIpBudget('192.0.2.1')).rejects.toThrow(/JWT_SECRET is required/);
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      await service.consumeInviteIpBudget('192.0.2.1');
      expect(get.mock.calls[0][1]).toEqual([digest('192.0.2.1', 'dev-only-insecure-secret-change-immediately')]);
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
    }
  });
});
