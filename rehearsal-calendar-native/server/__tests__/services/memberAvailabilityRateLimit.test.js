import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const migration = readFileSync(
  new URL('../../migrations/007-member-availability-rate-limit.sql', import.meta.url), 'utf8'
);
const limits = JSON.parse(readFileSync(
  new URL('../../../shared/contracts/memberAvailabilityLimits.json', import.meta.url), 'utf8'
));

async function loadService(db, isPostgres) {
  jest.resetModules();
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres }));
  return (await import('../../services/memberAvailabilityRateLimit.js')).consumeMemberAvailabilityBudget;
}

describe('shared member availability budget, real SQLite storage', () => {
  let directory;
  let sessions;
  let consumeA;
  let consumeB;
  // Deterministic database time keeps a minute boundary from making tests
  // flaky. SQL still derives the window and retry from its clock function.
  const databaseSeconds = 1800000023;
  const windowStart = databaseSeconds - databaseSeconds % 60;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'member-availability-budget-'));
    const filename = join(directory, 'fixture.sqlite');
    sessions = [new Database(filename), new Database(filename)];
    for (const session of sessions) {
      session.pragma('foreign_keys = ON');
      session.function('strftime', (format, instant) => {
        if (format !== '%s' || instant !== 'now') throw new Error('Unexpected clock query');
        return String(databaseSeconds);
      });
    }
    sessions[0].exec('CREATE TABLE native_users (id INTEGER PRIMARY KEY)');
    sessions[0].exec(migration);
    sessions[0].exec(migration);

    // Two independently imported service instances have different connections
    // to the same file. No shared JavaScript counter participates in admission.
    const adapters = sessions.map((session) => ({
      get: (sql, params) => session.prepare(sql).get(params),
    }));
    consumeA = await loadService(adapters[0], false);
    consumeB = await loadService(adapters[1], false);
  });

  beforeEach(() => {
    sessions[0].exec('DELETE FROM native_users');
    sessions[0].exec('INSERT INTO native_users (id) VALUES (1), (2)');
  });

  afterAll(() => {
    for (const session of sessions ?? []) session.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('shares exactly 60 admissions between independent instances and caps rejected attempts', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) =>
      (index % 2 ? consumeA : consumeB)(1)
    ));

    expect(limits.requestsPerMinute).toBe(60);
    expect(results.filter((result) => result.allowed)).toHaveLength(limits.requestsPerMinute);
    expect(results.slice(60)).toEqual(Array.from({ length: 40 }, () => ({
      allowed: false, retryAfter: 60 - databaseSeconds % 60,
    })));
    expect(sessions[1].prepare('SELECT * FROM native_member_availability_rate_limits').all())
      .toEqual([{ user_id: 1, window_start: windowStart, request_count: 61 }]);
  });

  it('keeps another authenticated user independent', async () => {
    for (let index = 0; index < 61; index++) await consumeA(1);
    expect(await consumeB('2')).toEqual({ allowed: true, retryAfter: 37 });
    expect(await consumeB(1)).toEqual({ allowed: false, retryAfter: 37 });
    expect(sessions[0].prepare('SELECT COUNT(*) AS total FROM native_member_availability_rate_limits').get().total)
      .toBe(2);
  });

  it('resets an expired row in place and bases retry time on the database clock', async () => {
    await consumeA(1);
    sessions[0].prepare(`UPDATE native_member_availability_rate_limits
      SET window_start = window_start - 60, request_count = 61 WHERE user_id = 1`).run();
    const applicationClock = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Application wall clock must not be consulted');
    });
    try {
      expect(await consumeB(1)).toEqual({ allowed: true, retryAfter: 37 });
    } finally {
      applicationClock.mockRestore();
    }
    expect(sessions[1].prepare('SELECT * FROM native_member_availability_rate_limits').all())
      .toEqual([{ user_id: 1, window_start: windowStart, request_count: 1 }]);
  });

  it('does not let an older statement reopen a newer exhausted window', async () => {
    sessions[0].prepare(`INSERT INTO native_member_availability_rate_limits
      (user_id, window_start, request_count) VALUES (1, ?, 61)`).run(windowStart + 60);
    expect(await consumeB(1)).toEqual({ allowed: false, retryAfter: 60 });
    expect(sessions[1].prepare('SELECT window_start FROM native_member_availability_rate_limits').get().window_start)
      .toBe(windowStart + 60);
  });

  it('bounds row lifetime and cardinality to real native users', async () => {
    await consumeA(1);
    // The root and server runners use different Jest versions; a native
    // SqliteError can cross their VM Error realms. Assert its driver code.
    await expect(consumeB(999)).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
    sessions[0].prepare('DELETE FROM native_users WHERE id = 1').run();
    expect(sessions[1].prepare('SELECT * FROM native_member_availability_rate_limits').all()).toEqual([]);
  });

  it('enforces the portable migration constraints', () => {
    const insert = sessions[0].prepare(`INSERT INTO native_member_availability_rate_limits
      (user_id, window_start, request_count) VALUES (1, ?, ?)`);
    for (const [window, count] of [[-60, 1], [1, 1], [windowStart, 0], [windowStart, 62]]) {
      expect(() => insert.run(window, count)).toThrow(/CHECK constraint/);
    }
  });
});

describe('PostgreSQL service boundary and fail-closed behavior', () => {
  let get;
  let consume;

  beforeEach(async () => {
    get = jest.fn().mockResolvedValue({ request_count: 1, retry_after: 23 });
    consume = await loadService({ get }, true);
  });

  it('uses one atomic UPSERT with the database clock and no process state', async () => {
    const secondGet = jest.fn().mockResolvedValue({ request_count: 61, retry_after: 23 });
    const secondInstance = await loadService({ get: secondGet }, true);
    expect(await consume(7)).toEqual({ allowed: true, retryAfter: 23 });
    expect(await secondInstance(7)).toEqual({ allowed: false, retryAfter: 23 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(secondGet).toHaveBeenCalledTimes(1);
    const [sql, params] = get.mock.calls[0];
    expect(sql).toContain('statement_timestamp()');
    expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(sql).toContain('RETURNING request_count');
    expect(sql).not.toContain('strftime');
    expect(params).toEqual([7, 61]);
  });

  it.each([
    undefined, null, {},
    { request_count: 0, retry_after: 1 },
    { request_count: 62, retry_after: 1 },
    { request_count: 1.5, retry_after: 1 },
    { request_count: '1', retry_after: 1 },
    { request_count: 1, retry_after: 0 },
    { request_count: 1, retry_after: 61 },
    { request_count: 1, retry_after: '1' },
    { request_count: 1, retry_after: NaN },
  ])('rejects malformed storage result %p', async (row) => {
    get.mockResolvedValue(row);
    await expect(consume(7)).rejects.toThrow(/storage result/);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('propagates unavailable storage without a permissive fallback', async () => {
    get.mockRejectedValue(new Error('fixture storage unavailable'));
    await expect(consume(7)).rejects.toThrow('fixture storage unavailable');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each(['DATABASE_URL', 'POSTGRES_URL'])(
    'refuses an adapter SQLite fallback when %s configures PostgreSQL', async (variable) => {
      const original = process.env[variable];
      const fallbackConsume = await loadService({ get }, false);
      process.env[variable] = 'postgresql://synthetic.invalid/never-connected';
      try {
        await expect(fallbackConsume(7)).rejects.toThrow(/Configured PostgreSQL is unavailable/);
        expect(get).not.toHaveBeenCalled();
      } finally {
        if (original === undefined) delete process.env[variable];
        else process.env[variable] = original;
      }
    }
  );

  it.each([undefined, null, false, 0, -1, 1.5, '', '7/project/1', {}, Number.MAX_SAFE_INTEGER + 1])(
    'does not create caller-derived buckets for invalid identity %p', async (userId) => {
      await expect(consume(userId)).rejects.toThrow(/authenticated user ID/);
      expect(get).not.toHaveBeenCalled();
    }
  );
});
