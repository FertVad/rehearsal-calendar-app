import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let db, data, request, app, token;
beforeAll(async () => {
  db = await setupIntegrationDb();
  data = await seedTestData(db);
  jest.unstable_mockModule('../../database/db.js', () => ({ default: db, isPostgres: false }));
  jest.unstable_mockModule('../../config/env.js', () => { throw new Error('Never load .env in tests'); });
  request = (await import('supertest')).default;
  const { createApp } = await import('../../app.js');
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  token = generateTokens(data.adminId, 1).accessToken;
  app = await new Promise(resolve => {
    const server = createApp().listen(0, '127.0.0.1', () => resolve(server));
  });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  app?.closeAllConnections();
  if (app) await new Promise(resolve => app.close(resolve));
  closeIntegrationDb();
});

const query = params => request(app)
  .get(`/api/native/projects/${data.projectId}/members/availability`)
  .set('Authorization', `Bearer ${token}`).query(params);

test('rejects the original 0001..9999 attack before expanding dates', async () => {
  // Safely reproduce the old ordering without allocating millions of strings.
  // Old code reaches this tripwire and returns 500; repaired code needs only
  // two ISO round-trips to validate the bounds and returns 400.
  const original = Date.prototype.toISOString;
  let conversions = 0;
  jest.spyOn(Date.prototype, 'toISOString').mockImplementation(function () {
    if (++conversions > 100) throw new Error('B03_SAFE_EXPANSION_TRIPWIRE');
    return original.call(this);
  });
  const all = jest.spyOn(db, 'all');
  const response = await query({ startDate: '0001-01-01', endDate: '9999-12-31' });
  expect(response.status).toBe(400);
  expect(conversions).toBeLessThanOrEqual(2);
  expect(all).not.toHaveBeenCalled();
  expect((await request(app).get('/api/health')).status).toBe(200);
});

test.each([
  { startDate: '2026-03-02', endDate: '2026-03-01' },
  { date: '2026-02-30' },
  { date: '2026-2-01' },
  { date: '0000-01-01' },
  { date: ['2026-01-01', '2026-01-02'] },
  { date: '2026-01-01', startDate: '2026-01-01', endDate: '2026-01-02' },
  { date: '2026-01-01', userIds: '1garbage' },
  { date: '2026-01-01', userIds: ['1', '2'] },
  { date: '2026-01-01', userIds: '2147483648' },
  { date: '2026-01-01', excludeRehearsalId: '9007199254740991' },
  { date: '2026-01-01', excludeRehearsalId: { id: '1' } },
])('rejects ambiguous/malformed input %p before business reads', async params => {
  const all = jest.spyOn(db, 'all');
  const response = await query(params);
  expect(response.status).toBe(400);
  expect(all).not.toHaveBeenCalled();
});

test('denies inactive membership before roster reads or date expansion', async () => {
  db.run("UPDATE native_project_members SET status = 'inactive' WHERE user_id = ?", [data.adminId]);
  const all = jest.spyOn(db, 'all');
  const dates = jest.spyOn(Date.prototype, 'toISOString');
  try {
    const response = await query({ startDate: '2026-01-01', endDate: '2026-03-31' });
    expect(response.status).toBe(403);
    expect(all).not.toHaveBeenCalled();
    expect(dates).toHaveBeenCalledTimes(2); // Validation only, no expansion.
  } finally {
    db.run("UPDATE native_project_members SET status = 'active' WHERE user_id = ?", [data.adminId]);
  }
});

test('accepts the inclusive 90-day boundary and rejects day 91', async () => {
  expect((await query({ startDate: '2026-01-01', endDate: '2026-03-31' })).status).toBe(200);
  expect((await query({ startDate: '2026-01-01', endDate: '2026-04-01' })).status).toBe(400);
  expect((await query({ date: '2024-02-29' })).status).toBe(200);
  expect((await query({ date: '2026-02-29' })).status).toBe(400);
});

test('deduplicates members and intersects the selection with active project members', async () => {
  const response = await query({ date: '2026-01-01', userIds: `${data.memberId},${data.memberId},99999` });
  expect(response.status).toBe(200);
  expect(response.body.availability.map(user => user.userId)).toEqual([String(data.memberId)]);
  expect((await query({ date: '2026-01-01', userIds: '99999' })).body).toEqual({ availability: [] });
});

test('HEAD consumes the same database budget as GET', async () => {
  await query({ date: '2026-01-01' });
  db.run('UPDATE native_member_availability_rate_limits SET request_count = 60 WHERE user_id = ?', [data.adminId]);
  const response = await request(app)
    .head(`/api/native/projects/${data.projectId}/members/availability`)
    .set('Authorization', `Bearer ${token}`).query({ date: '2026-01-01' });
  expect(response.status).toBe(429);
  expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60);
});
