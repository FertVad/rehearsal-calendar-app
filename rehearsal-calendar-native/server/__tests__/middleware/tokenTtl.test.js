import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// This suite imports no environment loader and substitutes every database call.
// Signing and verification use the actual jsonwebtoken implementation.
const SECRET = 'id01-isolated-token-lifetime-secret';
const savedEnvironment = Object.fromEntries(['JWT_SECRET', 'JWT_EXPIRES_IN', 'REFRESH_TOKEN_EXPIRES_IN']
  .map(key => [key, process.env[key]]));
const database = { get: jest.fn(), run: jest.fn(), all: jest.fn() };
jest.unstable_mockModule('../../database/db.js', () => ({ default: database }));

beforeEach(() => {
  jest.resetModules();
  process.env.JWT_SECRET = SECRET;
  delete process.env.JWT_EXPIRES_IN;
  delete process.env.REFRESH_TOKEN_EXPIRES_IN;
  Object.values(database).forEach(fn => fn.mockReset());
  database.get.mockResolvedValue({ token_version: 1 });
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function lifetimes(tokens) {
  const access = jwt.verify(tokens.accessToken, SECRET);
  const refresh = jwt.verify(tokens.refreshToken, SECRET);
  return { accessSeconds: access.exp - access.iat, refreshSeconds: refresh.exp - refresh.iat };
}

test('configured 15m access and 7d refresh lifetimes reach the real signed JWTs', async () => {
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
  expect(lifetimes(generateTokens(17, 3))).toEqual({ accessSeconds: 900, refreshSeconds: 604800 });
});

let readTokenTtls;
beforeAll(async () => {
  ({ readTokenTtls } = await import('../../config/tokenTtl.js'));
});

describe('token lifetime configuration', () => {
  test('undefined fields preserve the exact 30d and 90d defaults in an immutable result', () => {
    const configured = readTokenTtls({});
    expect(configured).toEqual({ accessSeconds: 2592000, refreshSeconds: 7776000 });
    expect(Object.isFrozen(configured)).toBe(true);
    expect(() => { configured.accessSeconds = 1; }).toThrow();
    expect(readTokenTtls({ JWT_EXPIRES_IN: undefined, REFRESH_TOKEN_EXPIRES_IN: undefined })).toEqual(configured);
  });

  test.each([
    ['1s', 1], ['15m', 900], ['2h', 7200], ['7d', 604800], [' 15m\t', 900],
  ])('explicit %j access duration means %i whole seconds', (value, expected) => {
    expect(readTokenTtls({ JWT_EXPIRES_IN: value })).toEqual({ accessSeconds: expected, refreshSeconds: 7776000 });
  });

  test('either override leaves the other default intact and omitted environment uses process.env', () => {
    expect(readTokenTtls({ REFRESH_TOKEN_EXPIRES_IN: '120d' })).toEqual({ accessSeconds: 2592000, refreshSeconds: 10368000 });
    process.env.JWT_EXPIRES_IN = ' 2h ';
    process.env.REFRESH_TOKEN_EXPIRES_IN = ' 7d ';
    expect(readTokenTtls()).toEqual({ accessSeconds: 7200, refreshSeconds: 604800 });
  });

  test.each([
    '', ' \t\n ', '120', '0', '0s', '-1s', '+1s', '1.5h', '.5h', '1ms',
    '1e3s', '0x10s', '1h30m', '15 m', '15M', '01s', '1w', '1y', 'Infinity',
    '9007199254740992s', '9007199254741s', '99999999999999999999999999999999999999999999999999999999999999999999d',
    null, 120, false, {}, [],
  ])('rejects invalid lifetime %j for either variable instead of substituting defaults', value => {
    for (const key of ['JWT_EXPIRES_IN', 'REFRESH_TOKEN_EXPIRES_IN']) {
      expect(() => readTokenTtls({ [key]: value })).toThrow(new RegExp(key));
    }
  });

  test('the technical upper bound keeps both seconds and milliseconds safely representable', () => {
    const maximumSeconds = Math.floor(Number.MAX_SAFE_INTEGER / 1000);
    const result = readTokenTtls({ JWT_EXPIRES_IN: '1s', REFRESH_TOKEN_EXPIRES_IN: maximumSeconds + 's' });
    expect(result.refreshSeconds).toBe(maximumSeconds);
    expect(Number.isSafeInteger(result.refreshSeconds * 1000)).toBe(true);
    expect(() => readTokenTtls({ JWT_EXPIRES_IN: '1s', REFRESH_TOKEN_EXPIRES_IN: (maximumSeconds + 1) + 's' }))
      .toThrow(/REFRESH_TOKEN_EXPIRES_IN/);
  });

  test.each([
    ['15m', '900s'], ['15m', '14m'], ['90d', undefined], ['91d', undefined], [undefined, '30d'],
  ])('rejects access %j and refresh %j when refresh cannot outlive access', (access, refresh) => {
    expect(() => readTokenTtls({ JWT_EXPIRES_IN: access, REFRESH_TOKEN_EXPIRES_IN: refresh })).toThrow();
  });
});

describe('actual application token issuance and compatibility', () => {
  test('omitted configuration preserves exact lifetimes and the existing token payload/API', async () => {
    const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
    const tokens = generateTokens(17, 3);
    expect(Object.keys(tokens).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(lifetimes(tokens)).toEqual({ accessSeconds: 2592000, refreshSeconds: 7776000 });
    expect(jwt.verify(tokens.accessToken, SECRET)).toMatchObject({ userId: 17, tv: 3, type: 'access' });
    expect(jwt.verify(tokens.refreshToken, SECRET)).toMatchObject({ userId: 17, tv: 3, type: 'refresh' });
    expect(jwt.verify(generateTokens(17).accessToken, SECRET).tv).toBe(1);
    expect(jwt.verify(generateTokens(17).refreshToken, SECRET).tv).toBe(1);
    Object.values(database).forEach(fn => expect(fn).not.toHaveBeenCalled());
  });

  test.each([
    [{ JWT_EXPIRES_IN: '1h' }, { accessSeconds: 3600, refreshSeconds: 7776000 }],
    [{ REFRESH_TOKEN_EXPIRES_IN: '120d' }, { accessSeconds: 2592000, refreshSeconds: 10368000 }],
  ])('independent configured override reaches only its intended newly signed token', async (configuration, expected) => {
    Object.assign(process.env, configuration);
    const { generateTokens } = await import('../../middleware/jwtMiddleware.js');
    expect(lifetimes(generateTokens(17, 3))).toEqual(expected);
  });

  test.each([
    ['JWT_EXPIRES_IN', ''], ['JWT_EXPIRES_IN', '120'], ['JWT_EXPIRES_IN', '0s'],
    ['JWT_EXPIRES_IN', '9007199254741s'], ['REFRESH_TOKEN_EXPIRES_IN', ' '],
    ['REFRESH_TOKEN_EXPIRES_IN', '30d'],
  ])('invalid %s=%j rejects middleware initialization before database work', async (key, value) => {
    process.env[key] = value;
    await expect(import('../../middleware/jwtMiddleware.js')).rejects.toThrow();
    Object.values(database).forEach(fn => expect(fn).not.toHaveBeenCalled());
  });

  test('configuration is captured once and changes require a fresh module instance', async () => {
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    const configured = await import('../../middleware/jwtMiddleware.js');
    process.env.JWT_EXPIRES_IN = 'invalid-after-startup';
    expect(lifetimes(configured.generateTokens(17, 3))).toEqual({ accessSeconds: 900, refreshSeconds: 604800 });
    jest.resetModules();
    await expect(import('../../middleware/jwtMiddleware.js')).rejects.toThrow(/JWT_EXPIRES_IN/);
  });

  test('configured exp is enforced at the exact second and token types remain separate', async () => {
    const now = 1800000000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    process.env.JWT_EXPIRES_IN = '1s';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '2s';
    const { generateTokens, verifyToken } = await import('../../middleware/jwtMiddleware.js');
    const tokens = generateTokens(17, 3);
    expect(verifyToken(tokens.accessToken, 'access')).toMatchObject({ userId: 17, tv: 3 });
    expect(verifyToken(tokens.refreshToken, 'access')).toBeNull();
    expect(verifyToken(tokens.accessToken, 'refresh')).toBeNull();
    clock.mockReturnValue((now + 1) * 1000);
    expect(verifyToken(tokens.accessToken, 'access')).toBeNull();
    expect(verifyToken(tokens.refreshToken, 'refresh')).toMatchObject({ userId: 17, tv: 3 });
    clock.mockReturnValue((now + 2) * 1000);
    expect(verifyToken(tokens.refreshToken, 'refresh')).toBeNull();
  });

  test('shortened configuration does not retroactively replace existing token expirations', async () => {
    const now = 1800000000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const previous = await import('../../middleware/jwtMiddleware.js');
    const oldTokens = previous.generateTokens(17, 3);
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    jest.resetModules();
    const current = await import('../../middleware/jwtMiddleware.js');
    const newTokens = current.generateTokens(17, 3);
    clock.mockReturnValue((now + 900) * 1000);
    expect(current.verifyToken(newTokens.accessToken, 'access')).toBeNull();
    expect(current.verifyToken(oldTokens.accessToken, 'access')).toMatchObject({ userId: 17, tv: 3 });
    clock.mockReturnValue((now + 7 * 86400) * 1000);
    expect(current.verifyToken(newTokens.refreshToken, 'refresh')).toBeNull();
    expect(current.verifyToken(oldTokens.refreshToken, 'refresh')).toMatchObject({ userId: 17, tv: 3 });
    clock.mockReturnValue((now + 30 * 86400) * 1000);
    expect(current.verifyToken(oldTokens.accessToken, 'access')).toBeNull();
    expect(current.verifyToken(oldTokens.refreshToken, 'refresh')).toMatchObject({ userId: 17, tv: 3 });
    clock.mockReturnValue((now + 90 * 86400) * 1000);
    expect(current.verifyToken(oldTokens.refreshToken, 'refresh')).toBeNull();
  });

  test('changing configured lifetimes does not bypass the existing token-version revocation check', async () => {
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    const { generateTokens, authenticateToken } = await import('../../middleware/jwtMiddleware.js');
    database.get.mockResolvedValue({ token_version: 3 });
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    await authenticateToken({ headers: { authorization: 'Bearer ' + generateTokens(17, 2).accessToken } }, response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: 'Session revoked' });
    expect(next).not.toHaveBeenCalled();
    const accepted = { headers: { authorization: 'Bearer ' + generateTokens(17, 3).accessToken } };
    await authenticateToken(accepted, response, next);
    expect(accepted.userId).toBe(17);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
