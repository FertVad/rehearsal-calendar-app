import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';

const get = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({ default: { get } }));
const { authenticateToken, generateTokens } = await import('../../middleware/jwtMiddleware.js');
const { adminLogin } = await import('../../middleware/adminAuth.js');

const saved = Object.fromEntries(['ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD'].map(key => [key, process.env[key]]));
let hash;
beforeAll(async () => { hash = await bcrypt.hash('a02-test-password', 4); });
beforeEach(() => {
  get.mockReset();
  process.env.ADMIN_PASSWORD_HASH = hash;
  delete process.env.ADMIN_PASSWORD;
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

test('auth DB rejection is forwarded once, not rejected or misclassified as invalid credentials', async () => {
  const failure = new Error('synthetic database failure');
  get.mockRejectedValueOnce(failure);
  const req = { headers: { authorization: 'Bearer ' + generateTokens(1, 1).accessToken } };
  const res = response();
  const next = jest.fn();
  let escaped;
  await authenticateToken(req, res, next).catch(error => { escaped = error; });
  expect(escaped).toBeUndefined();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(failure);
  expect(res.status).not.toHaveBeenCalled();
  expect(req.userId).toBeUndefined();
});

test.each([
  ['missing body', undefined], ['null body', null], ['missing password', {}],
  ['null password', { password: null }], ['numeric password', { password: 42 }],
  ['object password', { password: {} }], ['array password', { password: [] }],
  ['boolean password', { password: false }], ['empty password', { password: '' }],
])('admin login rejects %s before invoking bcrypt', async (_label, body) => {
  const compare = jest.spyOn(bcrypt, 'compare');
  const res = response();
  const next = jest.fn();
  let escaped;
  await adminLogin({ body }, res, next).catch(error => { escaped = error; });
  expect(escaped).toBeUndefined();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
  expect(compare).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('unexpected bcrypt rejection reaches the error boundary instead of returning 401', async () => {
  const failure = new Error('synthetic bcrypt failure');
  jest.spyOn(bcrypt, 'compare').mockRejectedValueOnce(failure);
  const res = response();
  const next = jest.fn();
  let escaped;
  await adminLogin({ body: { password: 'a02-test-password' } }, res, next).catch(error => { escaped = error; });
  expect(escaped).toBeUndefined();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(failure);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});

test('plaintext compatibility login uses the same malformed-input contract', async () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_PASSWORD = 'a02-test-password';
  const res = response();
  await adminLogin({ body: { password: {} } }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
});
