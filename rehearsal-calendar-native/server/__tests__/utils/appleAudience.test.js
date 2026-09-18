/**
 * IA01: real locked apple-signin-auth + jsonwebtoken verification using RSA
 * signatures and a synthetic JWKS transport. No fake verification results,
 * provider requests, database, environment loader or production entrypoint.
 */
import { jest } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import net from 'node:net';
import appleSignin from 'apple-signin-auth';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { verifyAppleToken } from '../../utils/oauthVerification.js';
import { readAppleAuthConfig, AppleAuthUnavailableError, AppleTokenVerificationError } from '../../config/appleAuth.js';

const audience = 'com.example.ia01';
const otherAudience = 'com.example.another-app';
const originalAudience = process.env.APPLE_CLIENT_ID;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const keyId = 'ia01-fixture-rsa-key';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: keyId, alg: 'RS256', use: 'sig' };
const jwksFetch = jest.fn(async (url, options) => {
  expect(url).toBe('https://appleid.apple.com/auth/keys');
  expect(options.method).toBe('GET');
  return { text: async () => JSON.stringify({ keys: [jwk] }) };
});
const socketConnect = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(() => {
  throw new Error('IA01 crypto tests prohibit every network connection');
});
const verifyIdToken = jest.spyOn(appleSignin, 'verifyIdToken'); // real call-through
let errorLog;

function token(claims = {}, options = {}, signingKey = privateKey) {
  return jwt.sign({
    iss: 'https://appleid.apple.com', aud: audience,
    sub: 'ia01-synthetic-subject', email: 'ia01@example.test', email_verified: 'true',
    ...claims,
  }, signingKey, { algorithm: 'RS256', keyid: keyId, expiresIn: '5m', ...options });
}

beforeAll(() => { appleSignin._setFetch(jwksFetch); });

beforeEach(async () => {
  // Library-owned cache is reset via its actual API and synthetic transport.
  // Otherwise a cached signing key could hide an accidental verification call.
  await appleSignin._getApplePublicKeys({ disableCaching: true });
  jwksFetch.mockClear();
  verifyIdToken.mockClear();
  process.env.APPLE_CLIENT_ID = audience;
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  try { expect(socketConnect).not.toHaveBeenCalled(); }
  finally { errorLog?.mockRestore(); }
});

afterAll(async () => {
  await appleSignin._getApplePublicKeys({ disableCaching: true });
  appleSignin._setFetch(fetch);
  verifyIdToken.mockRestore();
  socketConnect.mockRestore();
  if (originalAudience === undefined) delete process.env.APPLE_CLIENT_ID;
  else process.env.APPLE_CLIENT_ID = originalAudience;
});

describe('Apple audience boundary through the real locked verifier', () => {
  test.each([['missing', undefined], ['empty', '']])
  ('%s audience rejects a genuinely signed token issued to another app before verification', async (_label, configured) => {
    if (configured === undefined) delete process.env.APPLE_CLIENT_ID;
    else process.env.APPLE_CLIENT_ID = configured;
    await expect(verifyAppleToken(token({ aud: otherAudience })))
      .rejects.toMatchObject({ code: 'APPLE_AUTH_UNAVAILABLE' });
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(jwksFetch).not.toHaveBeenCalled();
  });

  test.each([' ', '\t\n', 'com.example. app', 'com.example.one,com.example.two',
    'com.example.one;com.example.two', '["com.example.ia01"]'])
  ('unusable configuration %j rejects before verification or JWKS fetch', async configured => {
    process.env.APPLE_CLIENT_ID = configured;
    await expect(verifyAppleToken(token())).rejects.toMatchObject({ code: 'APPLE_AUTH_UNAVAILABLE' });
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(jwksFetch).not.toHaveBeenCalled();
  });

  test('a valid intended audience passes real RSA/JWKS verification and maps the verified identity', async () => {
    const identity = await verifyAppleToken(token());
    expect(identity).toEqual({
      providerUserId: 'ia01-synthetic-subject', email: 'ia01@example.test', emailVerified: true,
    });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(jwksFetch).toHaveBeenCalledTimes(1);
    expect(verifyIdToken.mock.calls[0][1]).toEqual({
      audience: [audience], algorithms: ['RS256'], issuer: 'https://appleid.apple.com', ignoreExpiration: false,
    });
  });

  test('the same genuinely signed token is accepted only while its audience is explicitly configured', async () => {
    const idToken = token();
    await expect(verifyAppleToken(idToken)).resolves.toMatchObject({ providerUserId: 'ia01-synthetic-subject' });
    process.env.APPLE_CLIENT_ID = otherAudience;
    await expect(verifyAppleToken(idToken)).rejects.toBeInstanceOf(AppleTokenVerificationError);
    delete process.env.APPLE_CLIENT_ID;
    await expect(verifyAppleToken(idToken)).rejects.toBeInstanceOf(AppleAuthUnavailableError);
    expect(verifyIdToken).toHaveBeenCalledTimes(2);
  });

  test('surrounding configuration whitespace is normalized without broadening the exact audience', async () => {
    process.env.APPLE_CLIENT_ID = `  ${audience}\t`;
    await expect(verifyAppleToken(token())).resolves.toMatchObject({ providerUserId: 'ia01-synthetic-subject' });
    await expect(verifyAppleToken(token({ aud: otherAudience }))).rejects.toMatchObject({ code: 'APPLE_TOKEN_INVALID' });
  });

  test.each([
    ['another app audience', { aud: otherAudience }, {}],
    ['missing token audience', { aud: undefined }, {}],
    ['case-changed audience', { aud: audience.toUpperCase() }, {}],
    ['invalid issuer', { iss: 'https://provider.invalid' }, {}],
    ['expired token', {}, { expiresIn: -1 }],
    ['token not yet active', { nbf: Math.floor(Date.now() / 1000) + 3600 }, {}],
    ['unknown signing key', {}, { keyid: 'ia01-unknown-key' }],
  ])('%s is rejected by actual cryptographic verification', async (_label, claims, options) => {
    await expect(verifyAppleToken(token(claims, options))).rejects.toMatchObject({ code: 'APPLE_TOKEN_INVALID' });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(jwksFetch).toHaveBeenCalledTimes(1);
  });

  test('a wrong RSA signature is rejected', async () => {
    await expect(verifyAppleToken(token({}, {}, otherKey))).rejects.toMatchObject({ code: 'APPLE_TOKEN_INVALID' });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(jwksFetch).toHaveBeenCalledTimes(1);
  });

  test('an RS384 token cannot change the required signing algorithm', async () => {
    await expect(verifyAppleToken(token({}, { algorithm: 'RS384' }))).rejects.toMatchObject({ code: 'APPLE_TOKEN_INVALID' });
  });

  test('a malformed token is rejected without exposing its contents', async () => {
    await expect(verifyAppleToken('ia01-not-a-jwt')).rejects.toMatchObject({ code: 'APPLE_TOKEN_INVALID' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('ia01-not-a-jwt');
  });

  test.each([['true', true], [true, true], ['false', false], [false, false]])
  ('retains verified Apple email_verified %j mapping', async (emailVerified, expected) => {
    const identity = await verifyAppleToken(token({ email_verified: emailVerified }));
    expect(identity.emailVerified).toBe(expected);
  });

  test('optional email remains null after successful verification', async () => {
    const identity = await verifyAppleToken(token({ email: undefined }));
    expect(identity.email).toBeNull();
  });

  test('errors expose neither token, claims, audience nor library verification details', async () => {
    const idToken = token({ aud: otherAudience });
    let rejected;
    try { await verifyAppleToken(idToken); } catch (error) { rejected = error; }
    expect(rejected).toMatchObject({ code: 'APPLE_TOKEN_INVALID', message: 'Invalid Apple token' });
    const diagnostics = JSON.stringify(errorLog.mock.calls) + JSON.stringify(rejected);
    for (const sensitive of [idToken, otherAudience, audience, 'ia01@example.test', 'ia01-synthetic-subject']) {
      expect(diagnostics).not.toContain(sensitive);
    }
    expect(diagnostics).not.toMatch(/jwt audience invalid|expected:|signature|BEGIN.*KEY/);
  });

  test('restoring intended configuration after an unavailable attempt permits valid authentication', async () => {
    delete process.env.APPLE_CLIENT_ID;
    await expect(verifyAppleToken(token())).rejects.toMatchObject({ code: 'APPLE_AUTH_UNAVAILABLE' });
    process.env.APPLE_CLIENT_ID = audience;
    await expect(verifyAppleToken(token())).resolves.toMatchObject({ providerUserId: 'ia01-synthetic-subject' });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
  });
});

describe('pure Apple provider configuration', () => {
  test.each([
    [{}, 'missing'], [{ APPLE_CLIENT_ID: '' }, 'empty'], [{ APPLE_CLIENT_ID: ' \n\t' }, 'empty'],
    [{ APPLE_CLIENT_ID: null }, 'invalid'], [{ APPLE_CLIENT_ID: false }, 'invalid'],
    [{ APPLE_CLIENT_ID: 42 }, 'invalid'], [{ APPLE_CLIENT_ID: ['com.example.ia01'] }, 'invalid'],
    [{ APPLE_CLIENT_ID: {} }, 'invalid'], [{ APPLE_CLIENT_ID: 'com.example. ia01' }, 'invalid'],
    [{ APPLE_CLIENT_ID: 'com.example.ia01,com.example.other' }, 'invalid'],
    [{ APPLE_CLIENT_ID: 'com.example.ia01;com.example.other' }, 'invalid'],
    [{ APPLE_CLIENT_ID: '["com.example.ia01"]' }, 'invalid'],
  ])('unusable configuration yields a stable disabled result %j', (environment, reason) => {
    const configured = readAppleAuthConfig(environment);
    expect(configured).toEqual({ enabled: false, audiences: [], reason });
    expect(Object.isFrozen(configured.audiences)).toBe(true);
  });

  test('one explicitly configured ID is trimmed, preserved exactly and immutable', () => {
    const environment = { APPLE_CLIENT_ID: '  com.Example.intended-Apple-app\t' };
    const configured = readAppleAuthConfig(environment);
    expect(configured).toEqual({ enabled: true, audiences: ['com.Example.intended-Apple-app'], reason: 'configured' });
    expect(Object.isFrozen(configured.audiences)).toBe(true);
    expect(() => configured.audiences.push(otherAudience)).toThrow();
    expect(environment.APPLE_CLIENT_ID).toBe('  com.Example.intended-Apple-app\t');
  });

  test('unrelated provider configuration supplies no Apple audience fallback', () => {
    expect(readAppleAuthConfig({ APPLE_CLIENT_IDS: audience, GOOGLE_CLIENT_ID_IOS: audience })).toEqual({
      enabled: false, audiences: [], reason: 'missing',
    });
  });
});
