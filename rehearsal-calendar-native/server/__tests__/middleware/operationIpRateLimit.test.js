import { jest } from '@jest/globals';

// These tests control only completion timing at the shared-store boundary.
// Actual SQL admission and actual HTTP mounts are covered by the companion
// service and createApp suites, without substituting their admission results.
const forbidden = jest.fn(() => { throw new Error('No runtime resource initialization'); });
jest.unstable_mockModule('../../database/db.js', () => ({ default: {}, isPostgres: false, initDatabase: forbidden }));
const { getOperationIpPolicy } = await import('../../services/operationIpRateLimit.js');
const consume = jest.fn();
jest.unstable_mockModule('../../services/operationIpRateLimit.js', () => ({
  getOperationIpPolicy, consumeOperationIpBudget: consume,
}));
const { limitOperationIp } = await import('../../middleware/operationIpRateLimit.js');

function response() {
  const res = { destroyed: false, writableEnded: false, headersSent: false, headers: {} };
  res.set = jest.fn((name, value) => {
    Object.assign(res.headers, typeof name === 'string' ? { [name]: value } : name);
    return res;
  });
  res.status = jest.fn(code => { res.statusCode = code; return res; });
  res.json = jest.fn(body => { res.body = body; res.writableEnded = true; return res; });
  return res;
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { consume.mockReset(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); expect(forbidden).not.toHaveBeenCalled(); });

test('construction validates the closed policy without contacting storage', () => {
  expect(typeof limitOperationIp('auth')).toBe('function');
  expect(typeof limitOperationIp('admin_login')).toBe('function');
  for (const value of ['login', '__proto__', '/api/auth', undefined, {}, 1]) {
    expect(() => limitOperationIp(value)).toThrow(/Unknown operation/);
  }
  expect(consume).not.toHaveBeenCalled();
  expect(Object.isFrozen(getOperationIpPolicy('auth'))).toBe(true);
});

test('admission forwards only the server-owned operation and req.ip after storage completion', async () => {
  const pending = deferred();
  consume.mockReturnValue(pending.promise);
  const res = response();
  const next = jest.fn();
  const completed = limitOperationIp('auth')({ ip: '192.0.2.10', body: { operation: 'admin_login' }, url: '/other' }, res, next);
  await jest.advanceTimersByTimeAsync(1);
  expect(next).not.toHaveBeenCalled();
  pending.resolve({ allowed: true, remaining: 19, retryAfter: 57, limit: 20, windowSeconds: 60 });
  await completed;
  expect(consume).toHaveBeenCalledTimes(1);
  expect(consume).toHaveBeenCalledWith('auth', '192.0.2.10');
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith();
  expect(res.headers).toEqual({ 'Cache-Control': 'no-store', 'RateLimit-Policy': '20;w=60',
    'RateLimit-Limit': '20', 'RateLimit-Remaining': '19', 'RateLimit-Reset': '57' });
});

test.each(['auth', 'admin_login'])('%s denial uses its declared message and DB-derived retry', async operation => {
  const policy = getOperationIpPolicy(operation);
  consume.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 9, limit: policy.limit, windowSeconds: policy.windowSeconds });
  const res = response();
  const next = jest.fn();
  await limitOperationIp(operation)({ ip: '192.0.2.10' }, res, next);
  expect(res.statusCode).toBe(429);
  expect(res.body).toEqual({ error: policy.message });
  expect(res.headers['Retry-After']).toBe('9');
  expect(res.headers['RateLimit-Reset']).toBe('9');
  expect(next).not.toHaveBeenCalled();
});

test('storage errors are generic 503 with no handler admission or automatic retry', async () => {
  consume.mockRejectedValue(new Error('fixture-private-storage-detail'));
  const res = response();
  const next = jest.fn();
  await limitOperationIp('auth')({ ip: '192.0.2.10' }, res, next);
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'Authentication is temporarily unavailable' });
  expect(res.headers).toEqual({ 'Cache-Control': 'no-store' });
  expect(consume).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('deadline ends HTTP admission and permanently ignores a late %s', async outcome => {
  const pending = deferred();
  consume.mockReturnValue(pending.promise);
  const res = response();
  const next = jest.fn();
  const unhandled = [];
  const capture = reason => unhandled.push(reason);
  process.on('unhandledRejection', capture);
  try {
    const completed = limitOperationIp('auth')({ ip: '192.0.2.10' }, res, next);
    await jest.advanceTimersByTimeAsync(2999);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await completed;
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Authentication is temporarily unavailable' });
    if (outcome === 'resolve') pending.resolve({ allowed: true, remaining: 19, retryAfter: 60 });
    else pending.reject(new Error('fixture-late-storage-detail'));
    await jest.advanceTimersByTimeAsync(1);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
  } finally { process.off('unhandledRejection', capture); }
});

test('a disconnected response cannot continue to authentication after late admission', async () => {
  const pending = deferred();
  consume.mockReturnValue(pending.promise);
  const res = response();
  const next = jest.fn();
  const completed = limitOperationIp('auth')({ ip: '192.0.2.10' }, res, next);
  await jest.advanceTimersByTimeAsync(1);
  res.destroyed = true;
  pending.resolve({ allowed: true, remaining: 19, retryAfter: 60 });
  await completed;
  expect(next).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
