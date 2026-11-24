/**
 * T-294: the server records the days someone uses the app, with its build, and
 * how far each invitation gets — through the real app and its routes, over the
 * SQLite integration fixture with migration 016's own DDL. The same writes run
 * on PostgreSQL in __tests__/postgres/t294Usage.mjs.
 *
 * "Now" is 04:30 UTC on 24 November 2026: still the evening of the 23rd in
 * Mazatlán (UTC-7), where the signed-in person lives.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

const NOW = Date.parse('2026-11-24T04:30:00.000Z');
const H = 60 * 60 * 1000;
const CODE = 'ABCDEFGH';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

let db;
let data;
let request;
let server;
let runtime;
let logger;
let tokens;
let clock;

// What a server instance remembers — the day it wrote for each person, when it
// last purged, that 016 is missing — lives for the process. Every test seeds
// people with new ids, and the tests that need the instance to purge again or
// to look for 016 again move the clock on, as time would.
beforeAll(async () => {
  clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres: false }));
  jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Never load .env in tests'); });
  request = (await import('supertest')).default;
  ({ logger } = await import('../../utils/logger.js'));
  const { createApp } = await import('../../app.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  runtime = { ensureInitialized: jest.fn(async () => true), checkReady: jest.fn(async () => true) };
  server = await new Promise((resolve) => {
    const listener = createApp({ databaseRuntime: runtime }).listen(0, '127.0.0.1', () => resolve(listener));
  });
  tokens = (id) => generateTokens(id, 1).accessToken;
});

beforeEach(async () => {
  db.run('DELETE FROM native_usage_days');
  db.run('DELETE FROM native_invite_counts');
  db.run('DELETE FROM native_invite_account_rate_limits');
  db.run('DELETE FROM native_invite_ip_rate_limits');
  db.run('UPDATE native_invite_ip_rate_limit_gate SET key_count = 0 WHERE id = 1');
  db.run('DELETE FROM native_project_members');
  db.run('DELETE FROM native_projects');
  db.run('DELETE FROM native_email_identities');
  db.run('DELETE FROM native_users');
  data = await seedTestData(db);
  db.run("UPDATE native_users SET timezone = 'America/Mazatlan' WHERE id = ?", [data.adminId]);
  db.run('UPDATE native_projects SET invite_code = ? WHERE id = ?', [CODE, data.projectId]);
  clock.mockReturnValue(NOW);
  runtime.ensureInitialized.mockImplementation(async () => true);
  delete process.env.MIN_IOS_BUILD;
});

afterAll(async () => {
  jest.restoreAllMocks();
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  closeIntegrationDb();
  delete process.env.MIN_IOS_BUILD;
});

const days = () => db.all('SELECT user_id, CAST(day AS TEXT) AS day, app_build FROM native_usage_days ORDER BY user_id, day');
const counts = () => db.all('SELECT project_id, CAST(day AS TEXT) AS day, page_opens, app_opens, joins FROM native_invite_counts ORDER BY project_id, day');
const app = (path, { user, build, method = 'get', token } = {}) => {
  let call = request(server)[method](path);
  if (user !== undefined || token !== undefined) call = call.set('Authorization', `Bearer ${token ?? tokens(user)}`);
  if (build !== undefined) call = call.set('X-App-Build', String(build));
  return call;
};
const usageWrites = (spy) => spy.mock.calls.filter(([sql]) => /INSERT INTO native_usage_days/.test(sql)).length;

// The page is counted after it is sent: wait for it (Date.now is fixed here).
async function until(check, ms = 2000) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('condition not reached');
}

describe('the day someone uses the app', () => {
  test('a request in a session records the day in the person\'s own zone, not UTC', async () => {
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
    // 04:30 UTC on the 24th is 21:30 on the 23rd in Mazatlán.
    expect(days()).toEqual([{ user_id: data.adminId, day: '2026-11-23', app_build: 41 }]);
  });

  test('a person without a stored zone is counted in UTC', async () => {
    db.run('UPDATE native_users SET timezone = NULL WHERE id = ?', [data.memberId]);
    await app('/api/native/projects', { user: data.memberId, build: 41 }).expect(200);
    expect(days()).toEqual([{ user_id: data.memberId, day: '2026-11-24', app_build: 41 }]);
  });

  test('a second request the same day writes nothing more', async () => {
    const get = jest.spyOn(db, 'get');
    try {
      await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
      await app('/api/auth/me', { user: data.adminId, build: 41 }).expect(200);
      await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
      expect(usageWrites(get)).toBe(1);
    } finally {
      get.mockRestore();
    }
    expect(days()).toHaveLength(1);
  });

  test('the row keeps the last build of the day; a request naming none keeps it', async () => {
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
    await app('/api/native/projects', { user: data.adminId, build: 42 }).expect(200);
    await app('/api/native/projects', { user: data.adminId }).expect(200);
    expect(days()).toEqual([{ user_id: data.adminId, day: '2026-11-23', app_build: 42 }]);
  });

  test('no build header: the build is empty', async () => {
    await app('/api/native/projects', { user: data.memberId }).expect(200);
    expect(days()).toEqual([{ user_id: data.memberId, day: '2026-11-24', app_build: null }]);
  });

  test('deleting the account deletes its days', async () => {
    await app('/api/native/projects', { user: data.memberId, build: 41 }).expect(200);
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
    expect(days()).toHaveLength(2);
    // The fixture's SQLite enforces foreign keys only when asked; PostgreSQL
    // always does (t294Usage.mjs deletes an account there too).
    db.run('PRAGMA foreign_keys = ON');
    try {
      await app('/api/auth/me', { user: data.memberId, method: 'delete' }).expect(200);
    } finally {
      db.run('PRAGMA foreign_keys = OFF');
    }
    expect(days()).toEqual([{ user_id: data.adminId, day: '2026-11-23', app_build: 41 }]);
  });

  test('refused requests record nothing: 401, 403 and 426', async () => {
    await app('/api/native/projects').expect(401);
    await app('/api/native/projects', { token: 'not-a-token' }).expect(401);
    db.run("INSERT INTO native_email_identities (user_id, email, status) VALUES (?, 'member@test.com', 'pending')", [data.memberId]);
    await app('/api/native/projects', { user: data.memberId, build: 41 }).expect(403);
    process.env.MIN_IOS_BUILD = '42';
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(426);
    expect(days()).toEqual([]);
  });

  test('a failing write does not fail the request: one line in the log, no stack', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const original = db.get;
    const get = jest.spyOn(db, 'get').mockImplementation((sql, params) => {
      if (/INSERT INTO native_usage_days/.test(sql)) throw Object.assign(new Error('disk full\n    at somewhere'), { code: '53100' });
      return original(sql, params);
    });
    try {
      await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]).toEqual(['[Usage] App day not recorded: disk full']);
      expect(error).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

});

describe('the invitation, counted per project and day', () => {
  test('the page opened in a browser is counted after it is sent', async () => {
    const page = await app(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
    expect(page.text).toContain('apple-itunes-app');
    await until(() => counts().length === 1);
    expect(counts()).toEqual([{ project_id: data.projectId, day: '2026-11-24', page_opens: 1, app_opens: 0, joins: 0 }]);
  });

  test.each([
    ['Telegram', 'TelegramBot (like TwitterBot)'],
    ['WhatsApp', 'WhatsApp/2.23.20.0'],
    ['iMessage', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0'],
    ['Slack', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['Discord', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
    ['no user agent', ''],
  ])('a link preview (%s) is not counted', async (_name, agent) => {
    await app(`/invite/${CODE}`).set('User-Agent', agent).expect(200);
    await app(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
    await until(() => counts().length === 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counts()[0].page_opens).toBe(1);
  });

  test('HEAD, a code of the wrong shape and an unknown code count nothing', async () => {
    const get = jest.spyOn(db, 'all');
    try {
      await request(server).head(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
      await app('/invite/not-a-code!').set('User-Agent', SAFARI).expect(200);
      await app('/invite/ZZZZZZZZ').set('User-Agent', SAFARI).expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Only the unknown code of the right shape reached the database: one
      // INSERT … SELECT that found no project and wrote nothing.
      expect(get.mock.calls.filter(([sql]) => /native_invite_counts/.test(sql))).toHaveLength(1);
      expect(counts()).toEqual([]);
    } finally {
      get.mockRestore();
    }
  });

  test('the page goes out when the database is down, and nothing is read before it', async () => {
    const all = jest.spyOn(db, 'all');
    const get = jest.spyOn(db, 'get');
    runtime.ensureInitialized.mockImplementation(async () => { throw new Error('database unavailable'); });
    try {
      const page = await app(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
      expect(page.text).toContain('Open invitation');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(all).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      runtime.ensureInitialized.mockImplementation(async () => false);
      await app(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(all).not.toHaveBeenCalled();
    } finally {
      all.mockRestore();
      get.mockRestore();
    }
    expect(counts()).toEqual([]);
  });

  test('the invitation opened in the app is counted, an expired one too', async () => {
    await app(`/api/native/invite/${CODE}`).expect(200);
    db.run('UPDATE native_projects SET invite_expires_at = ? WHERE id = ?', ['2026-01-01T00:00:00.000Z', data.projectId]);
    await app(`/api/native/invite/${CODE}`).expect(410);
    await app('/api/native/invite/ZZZZZZZZ').expect(404);
    expect(counts()).toEqual([{ project_id: data.projectId, day: '2026-11-24', page_opens: 0, app_opens: 2, joins: 0 }]);
  });

  test('a join is counted with the membership', async () => {
    db.run('DELETE FROM native_project_members WHERE user_id = ?', [data.memberId]);
    await app(`/api/native/invite/${CODE}/join`, { user: data.memberId, method: 'post' }).expect(200);
    expect(counts()).toEqual([{ project_id: data.projectId, day: '2026-11-24', page_opens: 0, app_opens: 0, joins: 1 }]);
  });

  test('a join that does not happen is not counted: already a member, or the transaction failing', async () => {
    await app(`/api/native/invite/${CODE}/join`, { user: data.memberId, method: 'post' }).expect(400);
    db.run('DELETE FROM native_project_members WHERE user_id = ?', [data.memberId]);
    // The transaction that writes the membership fails at its end — after
    // everything in it ran — as a COMMIT the database refuses would.
    const original = db.transaction;
    let refused = 0;
    const transaction = jest.spyOn(db, 'transaction').mockImplementation((work) => original.call(db, async (tx) => {
      let joins = false;
      const watched = { ...tx, run: (sql, params) => {
        if (/native_project_members/.test(sql)) joins = true;
        return tx.run(sql, params);
      } };
      const result = await work(watched);
      if (joins) {
        refused += 1;
        throw new Error('commit refused');
      }
      return result;
    }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await app(`/api/native/invite/${CODE}/join`, { user: data.memberId, method: 'post' }).expect(500);
      expect(refused).toBe(1);
    } finally {
      transaction.mockRestore();
      error.mockRestore();
    }
    expect(db.get('SELECT COUNT(*) AS n FROM native_project_members WHERE user_id = ?', [data.memberId]).n).toBe(0);
    expect(counts()).toEqual([]);
  });
});

describe('13 months', () => {
  const OLD = '2025-10-23';   // 13 months and a day before 24 Nov 2026
  const KEPT = '2025-10-24';  // exactly 13 months before

  function seedOld() {
    db.run('INSERT INTO native_usage_days (user_id, day, app_build) VALUES (?, ?, 30), (?, ?, 31)',
      [data.memberId, OLD, data.memberId, KEPT]);
    db.run('INSERT INTO native_invite_counts (project_id, day, page_opens) VALUES (?, ?, 5), (?, ?, 6)',
      [data.projectId, OLD, data.projectId, KEPT]);
  }

  test('a write deletes what is older than 13 months', async () => {
    // Two hours on: the instance last purged on the file's first write.
    clock.mockReturnValue(NOW + 2 * H); // 23:30 on the 23rd in Mazatlán
    seedOld();
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
    expect(days().map((row) => row.day)).toEqual(['2026-11-23', KEPT]);
    expect(counts().map((row) => row.day)).toEqual([KEPT]);
  });

  test('the purge on writes runs at most once an hour on an instance', async () => {
    clock.mockReturnValue(NOW + 4 * H); // 01:30 on the 24th in Mazatlán
    await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
    seedOld();
    await app('/api/native/projects', { user: data.memberId, build: 41 }).expect(200);
    expect(days()).toEqual([
      { user_id: data.adminId, day: '2026-11-24', app_build: 41 },
      { user_id: data.memberId, day: OLD, app_build: 30 },
      { user_id: data.memberId, day: KEPT, app_build: 31 },
      { user_id: data.memberId, day: '2026-11-24', app_build: 41 },
    ]);
  });
});

// Last: it leaves this instance knowing 016 is missing.
describe('before migration 016 is applied', () => {
  test('everything works as before, said once in the log', async () => {
    clock.mockReturnValue(NOW + 6 * H);
    // Recorded while 016 was there: the member's day is in this instance's memory.
    await app('/api/native/projects', { user: data.memberId, build: 41 }).expect(200);
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    db.run('ALTER TABLE native_usage_days RENAME TO usage_days_away');
    db.run('ALTER TABLE native_invite_counts RENAME TO invite_counts_away');
    try {
      await app('/api/native/projects', { user: data.adminId, build: 41 }).expect(200);
      await app(`/invite/${CODE}`).set('User-Agent', SAFARI).expect(200);
      await app(`/api/native/invite/${CODE}`).expect(200);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('Migration 016 is not applied');
      // Minutes later the instance looks for 016 again: the join's own count
      // is tried, and undone alone by its savepoint — the membership commits.
      clock.mockReturnValue(NOW + 6 * H + 6 * 60 * 1000);
      db.run('DELETE FROM native_project_members WHERE user_id = ?', [data.memberId]);
      const run = jest.spyOn(db, 'run');
      try {
        await app(`/api/native/invite/${CODE}/join`, { user: data.memberId, method: 'post' }).expect(200);
        expect(run.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining(['ROLLBACK TO SAVEPOINT invite_count']));
      } finally {
        run.mockRestore();
      }
      expect(db.get('SELECT status FROM native_project_members WHERE user_id = ?', [data.memberId]).status).toBe('active');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      db.run('ALTER TABLE usage_days_away RENAME TO native_usage_days');
      db.run('ALTER TABLE invite_counts_away RENAME TO native_invite_counts');
      warn.mockRestore();
    }
  });
});
