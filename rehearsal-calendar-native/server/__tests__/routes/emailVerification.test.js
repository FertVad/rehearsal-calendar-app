/**
 * Registration proves the address before it gives a session (R3: A01).
 *
 * Before: register created a working account for whatever address was typed,
 * and a later Google/Apple sign-in to that address joined it — so whoever
 * registered someone else's address first shared their account. Now a
 * registration is pending until the emailed code is entered with the same
 * password, and a pending account gets no session by any route.
 *
 * Runs on the SQLite harness with the in-memory mail transport; the refused
 * send goes through the real Resend adapter with fetch stubbed, no network.
 * Concurrency (two registrations of one address, two confirmations of one
 * code) needs PostgreSQL and lives in the R3 scenario there.
 */
process.env.EMAIL_CODE_SECRET = 'email-verification-test-secret';

import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let db;
let app;
let request;
let bcrypt;
let generateTokens;
let capturedEmails;
const PASSWORD = 'long-enough-password';
const realFetch = globalThis.fetch;

beforeAll(async () => {
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  bcrypt = (await import('bcrypt')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  ({ capturedEmails } = await import('../../services/email/transport.js'));
  app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../../routes/auth.js')).default);
  app.use('/api/auth', (await import('../../routes/emailVerification.js')).default);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  process.env.EMAIL_TRANSPORT = 'capture-for-tests';
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  globalThis.fetch = realFetch;
  capturedEmails.length = 0;
  db.run('DELETE FROM native_users');
});

const register = (body = {}) => request(app).post('/api/auth/register').send({
  email: 'new@example.com', password: PASSWORD, firstName: 'New', verification: 'code', ...body,
});
const codeSentTo = (email) => {
  const message = capturedEmails.filter((mail) => mail.to === email).at(-1);
  return message?.text.match(/\b(\d{6})\b/)?.[1];
};
const users = () => db.get('SELECT count(*) AS n FROM native_users').n;
const userByEmail = (email) => db.get('SELECT * FROM native_users WHERE email = ?', [email]);
const identity = (id) => db.get('SELECT email, status, verified_by FROM native_email_identities WHERE user_id = ?', [id]);
const legacyUser = async (email = 'person@example.com') => db.run(
  "INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, 'Person')",
  [email, await bcrypt.hash(PASSWORD, 4)]).lastInsertId;

describe('POST /auth/register', () => {
  it('tells an app from before R3 to update, and writes nothing', async () => {
    const response = await request(app).post('/api/auth/register')
      .send({ email: 'new@example.com', password: PASSWORD, firstName: 'New' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CLIENT_UPGRADE_REQUIRED');
    expect(users()).toBe(0);
  });

  it('refuses before writing anything when no email can be sent', async () => {
    delete process.env.EMAIL_TRANSPORT;
    const response = await register();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('EMAIL_UNAVAILABLE');
    expect(users()).toBe(0);
  });

  it('creates a pending account, emails a code and issues no session', async () => {
    const response = await register({ email: '  New@Example.COM ', locale: 'ru' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ status: 'verification_required', email: 'new@example.com', delivery: 'sent' });
    const user = userByEmail('new@example.com');
    expect(user.locale).toBe('ru');
    expect(user.last_login_at).toBeNull();
    expect(identity(user.id)).toEqual({ email: 'new@example.com', status: 'pending', verified_by: null });
    expect(db.get("SELECT count(*) AS n FROM native_auth_providers WHERE user_id = ? AND provider_type = 'email'", [user.id]).n).toBe(1);
    expect(db.get("SELECT count(*) AS n FROM native_email_codes WHERE user_id = ? AND purpose = 'verify' AND consumed_at IS NULL", [user.id]).n).toBe(1);
    const mail = capturedEmails.at(-1);
    expect(mail.to).toBe('new@example.com');
    expect(mail.subject).toMatch(/^\d{6} — ваш код Rehearsly$/);
  });

  it('refuses an address that is taken, whatever its case', async () => {
    await legacyUser('taken@example.com');
    const response = await register({ email: 'Taken@Example.com' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
    expect(users()).toBe(1);
  });

  it('keeps the account when the provider refuses the send, and says so', async () => {
    Object.assign(process.env, { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'test-key-value', EMAIL_FROM: 'Rehearsly <no-reply@rehearsly.me>' });
    globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({}) });
    const response = await register();
    expect(response.status).toBe(201);
    expect(response.body.delivery).toBe('failed');
    const user = userByEmail('new@example.com');
    expect(identity(user.id).status).toBe('pending');
    expect(db.get('SELECT failed_at FROM native_email_codes WHERE user_id = ?', [user.id]).failed_at).not.toBeNull();
  });
});

describe('POST /auth/login', () => {
  it('answers a pending account with 403, and only after the right password', async () => {
    await register();
    const wrong = await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    const right = await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: PASSWORD });
    expect(right.status).toBe(403);
    expect(right.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', email: 'new@example.com' });
    expect(right.body.accessToken).toBeUndefined();
  });

  it('still signs in an account from before R3, whatever the case typed', async () => {
    await legacyUser();
    const response = await request(app).post('/api/auth/login').send({ email: ' Person@Example.COM', password: PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });
});

describe('POST /auth/verify-email', () => {
  const verify = (body) => request(app).post('/api/auth/verify-email').send({ email: 'new@example.com', password: PASSWORD, ...body });
  const attempts = (id) => db.get("SELECT attempts FROM native_email_codes WHERE user_id = ? AND consumed_at IS NULL", [id])?.attempts;

  it('refuses a wrong password without spending an attempt', async () => {
    await register();
    const user = userByEmail('new@example.com');
    const response = await verify({ password: 'wrong-password', code: codeSentTo('new@example.com') });
    expect(response.status).toBe(401);
    expect(attempts(user.id)).toBe(0);
  });

  it('counts a wrong code', async () => {
    await register();
    const code = codeSentTo('new@example.com');
    const response = await verify({ code: code === '000000' ? '000001' : '000000' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CODE_INVALID');
    expect(attempts(userByEmail('new@example.com').id)).toBe(1);
  });

  it('confirms the address with the right code and starts the session', async () => {
    await register();
    const response = await verify({ email: 'NEW@example.com', code: codeSentTo('new@example.com') });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('new@example.com');
    const user = userByEmail('new@example.com');
    expect(identity(user.id)).toEqual({ email: 'new@example.com', status: 'verified', verified_by: 'code' });
    const login = await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((await verify({ code: codeSentTo('new@example.com') })).body.code).toBe('ALREADY_VERIFIED');
  });

  it('lets an account from before R3 confirm its address', async () => {
    const id = await legacyUser();
    const resent = await request(app).post('/api/auth/verify-email/resend').send({ email: 'person@example.com', password: PASSWORD });
    expect(resent.status).toBe(202);
    expect(identity(id)).toBeUndefined();
    const response = await verify({ email: 'person@example.com', code: codeSentTo('person@example.com') });
    expect(response.status).toBe(200);
    expect(identity(id)).toMatchObject({ status: 'verified', verified_by: 'code' });
  });
});

describe('POST /auth/verify-email/resend', () => {
  const resend = (body = {}) => request(app).post('/api/auth/verify-email/resend').send({ email: 'new@example.com', password: PASSWORD, ...body });

  it('waits a minute, then replaces the code', async () => {
    await register();
    const first = codeSentTo('new@example.com');
    const early = await resend();
    expect(early.status).toBe(429);
    expect(early.body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: expect.any(Number) });
    db.run("UPDATE native_email_codes SET created_at = ? WHERE user_id = ?",
      [new Date(Date.now() - 120_000).toISOString(), userByEmail('new@example.com').id]);
    const later = await resend();
    expect(later.status).toBe(202);
    expect(later.body).toEqual({ status: 'code_sent', delivery: 'sent' });
    const second = codeSentTo('new@example.com');
    expect(second).not.toBe(undefined);
    if (first !== second) {
      const stale = await request(app).post('/api/auth/verify-email').send({ email: 'new@example.com', password: PASSWORD, code: first });
      expect(stale.status).toBe(400);
    }
    const fresh = await request(app).post('/api/auth/verify-email').send({ email: 'new@example.com', password: PASSWORD, code: second });
    expect(fresh.status).toBe(200);
  });

  it('refuses a wrong password and a confirmed address', async () => {
    await register();
    expect((await resend({ password: 'wrong-password' })).status).toBe(401);
    await request(app).post('/api/auth/verify-email').send({ email: 'new@example.com', password: PASSWORD, code: codeSentTo('new@example.com') });
    const confirmed = await resend();
    expect(confirmed.status).toBe(409);
    expect(confirmed.body.code).toBe('ALREADY_VERIFIED');
  });
});

describe('POST /auth/refresh', () => {
  it('does not renew a token of a pending account', async () => {
    await register();
    const user = userByEmail('new@example.com');
    const { refreshToken } = generateTokens(user.id, user.token_version);
    const response = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});
