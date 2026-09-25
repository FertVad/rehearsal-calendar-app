/**
 * A forgotten password comes back through the mailbox (R3: A01).
 *
 * Before: there was no reset at all. A person who lost their password, or
 * whose password Google/Apple had just removed as unproven, could not get one
 * back, and the owner of a mailbox could not take back an account a stranger
 * had registered with it. Now a code sent to the address sets a new password,
 * and — being proof of the mailbox — it also takes away every session, live
 * code and push device of the account and confirms the address.
 *
 * The request answers alike for an address with and without an account.
 * Concurrency (two confirmations of one code, a request of a revoked session
 * queued behind the reset) needs PostgreSQL and lives in the R3_AUTH scenario.
 */
process.env.EMAIL_CODE_SECRET = 'password-reset-test-secret';

import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let db;
let app;
let request;
let bcrypt;
let capturedEmails;
const OLD_PASSWORD = 'stranger-password-1';
const NEW_PASSWORD = 'owner-password-2';
const OWNER = 'owner@example.com';
const realFetch = globalThis.fetch;

beforeAll(async () => {
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  bcrypt = (await import('bcrypt')).default;
  ({ capturedEmails } = await import('../../services/email/transport.js'));
  app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../../routes/auth.js')).default);
  app.use('/api/auth', (await import('../../routes/emailVerification.js')).default);
  app.use('/api/auth', (await import('../../routes/passwordReset.js')).default);
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

const ask = (email = OWNER) => request(app).post('/api/auth/password-reset/request').send({ email });
const confirm = (body = {}) => request(app).post('/api/auth/password-reset/confirm')
  .send({ email: OWNER, newPassword: NEW_PASSWORD, ...body });
const login = (password, email = OWNER) => request(app).post('/api/auth/login').send({ email, password });
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const codeFor = (email = OWNER) => capturedEmails.filter((mail) => mail.to === email).at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
const account = async ({ email = OWNER, password = OLD_PASSWORD } = {}) => db.run(
  "INSERT INTO native_users (email, password_hash, first_name, locale) VALUES (?, ?, 'Someone', 'de')",
  [email, password ? await bcrypt.hash(password, 4) : null]).lastInsertId;
const liveCodes = (id) => db.get('SELECT count(*) AS n FROM native_email_codes WHERE user_id = ? AND consumed_at IS NULL', [id]).n;
const attempts = (id) => db.get("SELECT attempts FROM native_email_codes WHERE user_id = ? AND purpose = 'reset' AND consumed_at IS NULL", [id])?.attempts;
const identity = (id) => db.get('SELECT email, status, verified_by FROM native_email_identities WHERE user_id = ?', [id]);

describe('POST /auth/password-reset/request', () => {
  it('answers alike whether or not the address has an account', async () => {
    const id = await account();
    const known = await ask(' Owner@Example.com ');
    const unknown = await ask('nobody@example.com');
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.delivery).toBeUndefined();
    expect(capturedEmails.map((mail) => mail.to)).toEqual([OWNER]);
    expect(capturedEmails[0].subject).toMatch(/Rehearsly/);
    expect(liveCodes(id)).toBe(1);
  });

  it('refuses before looking at the address when no email can be sent', async () => {
    await account();
    delete process.env.EMAIL_TRANSPORT;
    const response = await ask();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('EMAIL_UNAVAILABLE');
    expect(db.get('SELECT count(*) AS n FROM native_email_codes').n).toBe(0);
  });

  it('sends nothing more within a minute, and answers the same', async () => {
    await account();
    const first = await ask();
    const second = await ask();
    expect(second.status).toBe(202);
    expect(second.body).toEqual(first.body);
    expect(capturedEmails).toHaveLength(1);
  });

  it('answers the same when the provider refuses the email', async () => {
    await account();
    Object.assign(process.env, { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'test-key-value', EMAIL_FROM: 'Rehearsly <no-reply@rehearsly.me>' });
    globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({}) });
    const response = await ask();
    expect(response.status).toBe(202);
    expect(response.body.delivery).toBeUndefined();
  });

  it('refuses an address that is not one', async () => {
    const response = await ask('not-an-address');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EMAIL_INVALID');
  });
});

describe('POST /auth/password-reset/confirm', () => {
  it('refuses a weak password without spending an attempt', async () => {
    const id = await account();
    await ask();
    const response = await confirm({ code: codeFor(), newPassword: 'short' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'PASSWORD_POLICY', field: 'newPassword' });
    expect(attempts(id)).toBe(0);
  });

  it('counts a wrong code and keeps the password', async () => {
    const id = await account();
    await ask();
    const code = codeFor();
    const response = await confirm({ code: code === '000000' ? '000001' : '000000' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CODE_INVALID');
    expect(attempts(id)).toBe(1);
    expect((await login(OLD_PASSWORD)).status).toBe(200);
  });

  it('answers an address without an account as a missing code', async () => {
    const response = await confirm({ email: 'nobody@example.com', code: '123456' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CODE_MISSING');
  });

  it('sets the new password, signs in and takes away everything from before', async () => {
    const id = await account();
    const stranger = await login(OLD_PASSWORD);
    expect(stranger.status).toBe(200);
    db.run(`INSERT INTO native_push_tokens (user_id, device_token, created_at, updated_at)
      VALUES (?, 'ExponentPushToken[stranger-phone]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id]);
    expect((await request(app).post('/api/auth/verify-email/resend').send({ email: OWNER, password: OLD_PASSWORD })).status).toBe(202);
    await ask();
    const response = await confirm({ code: codeFor() });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id, email: OWNER });
    expect((await me(response.body.accessToken)).status).toBe(200);
    expect((await me(stranger.body.accessToken)).status).toBe(401);
    expect((await refresh(stranger.body.refreshToken)).status).toBe(401);
    expect((await login(OLD_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect(liveCodes(id)).toBe(0);
    expect(db.get('SELECT count(*) AS n FROM native_push_tokens WHERE user_id = ?', [id]).n).toBe(0);
    expect(identity(id)).toEqual({ email: OWNER, status: 'verified', verified_by: 'code' });
    expect(db.get("SELECT count(*) AS n FROM native_auth_providers WHERE user_id = ? AND provider_type = 'email'", [id]).n).toBe(1);
    expect((await confirm({ code: codeFor() })).body.code).toBe('CODE_MISSING');
  });

  it("takes back a registration a stranger never confirmed", async () => {
    const registered = await request(app).post('/api/auth/register')
      .send({ email: OWNER, password: OLD_PASSWORD, firstName: 'Stranger', verification: 'code' });
    expect(registered.status).toBe(201);
    capturedEmails.length = 0;
    await ask();
    const response = await confirm({ code: codeFor() });
    expect(response.status).toBe(200);
    expect(identity(response.body.user.id)).toMatchObject({ status: 'verified', verified_by: 'code' });
    expect((await login(OLD_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it('gives an account without a password its first one', async () => {
    const id = await account({ password: null });
    await ask();
    const response = await confirm({ code: codeFor() });
    expect(response.status).toBe(200);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect(identity(id).verified_by).toBe('code');
  });
});
