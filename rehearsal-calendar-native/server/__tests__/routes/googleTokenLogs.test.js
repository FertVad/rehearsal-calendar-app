/**
 * A rejected Google token leaves the person's data out of the logs (T-269,
 * review round 2).
 *
 * The privacy policy says the photo and language in Google's token are neither
 * used nor kept. google-auth-library builds most of its rejection messages from
 * the token itself — "Token used too late, …: {payload}", "Invalid token
 * signature: <jwt>" — so an expired token put the email, name, photo link and
 * language into the server log twice: once in verifyGoogleToken's own line, once
 * more through the error it rethrew with that message, which the route logs.
 * Vercel keeps those logs for about an hour.
 *
 * The real library runs here. Only its fetch of Google's public keys is
 * replaced by our own key pair, so the tokens are genuinely signed and checked,
 * without network or database beyond the in-memory one the route needs.
 */
process.env.EMAIL_CODE_SECRET = 'google-token-logs-test-secret';
process.env.EMAIL_TRANSPORT = 'capture-for-tests';

import { jest } from '@jest/globals';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { inspect } from 'node:util';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

const KID = 'test-key';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: strangerKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

// What a Google token carries about the person, each value unmistakable.
const PERSON = {
  email: 'nina.leak-check@gmail.com',
  given_name: 'Ninaleakcheck',
  family_name: 'Petrovaleakcheck',
  name: 'Ninaleakcheck Petrovaleakcheck',
  picture: 'https://lh3.googleusercontent.com/a/leak-check-photo',
  locale: 'xx-LEAKCHECK',
};
const SECRETS = Object.values(PERSON);

let db;
let app;
let request;
let verifyGoogleToken;
let OUR_AUDIENCE;
let logged;
const spies = [];

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function googleToken({ key = privateKey, ...claims } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'RS256', kid: KID, typ: 'JWT' });
  const body = b64({
    iss: 'https://accounts.google.com',
    aud: OUR_AUDIENCE,
    sub: '109876543210',
    email_verified: true,
    iat: now - 60,
    exp: now + 3600,
    ...PERSON,
    ...claims,
  });
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(key).toString('base64url');
  return `${header}.${body}.${signature}`;
}

const expired = () => {
  const now = Math.floor(Date.now() / 1000);
  return googleToken({ iat: now - 7200, exp: now - 3600 });
};

// Everything that reached the console, rendered the way the console renders it
// (an Error's message and stack included).
const logText = () => logged.map((args) => args.map((a) => (typeof a === 'string' ? a : inspect(a, { depth: 5 }))).join(' ')).join('\n');

const leaksIn = (text) => SECRETS.filter((secret) => text.includes(secret));

beforeAll(async () => {
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  const { OAuth2Client } = await import('google-auth-library');
  jest.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
    certs: { [KID]: publicKey.export({ type: 'spki', format: 'pem' }) },
    format: 'PEM',
  });
  ({ GOOGLE_CLIENT_IDS: [OUR_AUDIENCE] } = await import('../../constants/googleClients.js'));
  ({ verifyGoogleToken } = await import('../../utils/oauthVerification.js'));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../../routes/auth.js')).default);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, method).mockImplementation((...args) => { logged.push(args); }));
  }
  db.run('DELETE FROM native_users');
});

afterEach(() => {
  while (spies.length) spies.pop().mockRestore();
});

async function rejection(token) {
  try {
    await verifyGoogleToken(token);
  } catch (error) {
    return error;
  }
  throw new Error('the token was accepted');
}

describe('an expired Google token', () => {
  it('is rejected without the person in the log or in the error', async () => {
    const error = await rejection(expired());

    expect(leaksIn(logText())).toEqual([]);
    expect(leaksIn(`${error.message}\n${error.stack}\n${inspect(error, { depth: 5 })}`)).toEqual([]);
  });

  it('is logged as expired, so the cause is still readable', async () => {
    await rejection(expired());

    expect(logText()).toMatch(/Google token rejected.*expired/);
  });

  it('through the route: the same answer as before, nothing of the person logged', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: expired() });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Google authentication failed' });
    expect(leaksIn(JSON.stringify(res.body))).toEqual([]);
    expect(leaksIn(logText())).toEqual([]);
  });
});

describe('other rejected Google tokens', () => {
  it('a forged signature: the library would print the whole token, the log does not', async () => {
    const error = await rejection(googleToken({ key: strangerKey }));

    expect(leaksIn(logText())).toEqual([]);
    expect(logText()).not.toContain(googleToken({ key: strangerKey }).split('.')[1]);
    expect(leaksIn(`${error.message}\n${error.stack}`)).toEqual([]);
  });

  it('another app\'s audience: both client ids are named, the person is not', async () => {
    const error = await rejection(googleToken({ aud: 'someone-else.apps.googleusercontent.com' }));

    expect(logText()).toContain('someone-else.apps.googleusercontent.com');
    expect(logText()).toContain(OUR_AUDIENCE);
    expect(leaksIn(logText())).toEqual([]);
    expect(leaksIn(`${error.message}\n${error.stack}`)).toEqual([]);
  });

  it('a token issued in the future: nothing of the person either', async () => {
    const now = Math.floor(Date.now() / 1000);
    await rejection(googleToken({ iat: now + 7200, exp: now + 9000 }));

    expect(leaksIn(logText())).toEqual([]);
  });
});

describe('a valid Google token', () => {
  it('still signs in through the real verifier', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: googleToken() });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(PERSON.email);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });
});
