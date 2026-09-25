/**
 * Google and Apple settle who owns an address (R3: A01, review R3-01).
 *
 * Before: a Google or Apple sign-in joined any account with the same address,
 * and changed nothing on it. Whoever registered someone else's address first
 * kept their password beside the owner's Google — before R3 as a working
 * account, since R3 as a pending one. Now the provider's word for the
 * account's own address, when nobody had proven it, removes the password that
 * was never proven, every session and live code, and confirms the address.
 * A confirmed account is only linked. Without a verified address the provider
 * neither joins nor creates an account; a pending account gets no session by
 * any path.
 *
 * The verifier is replaced by the claims it would return: signature, audience
 * and issuer checks have their own tests (appleAuth, googleAudience). The
 * races — two first sign-ins, a sign-in against a registration — need
 * PostgreSQL and live in the R3_AUTH scenario.
 */
process.env.EMAIL_CODE_SECRET = 'provider-sign-in-test-secret';
process.env.EMAIL_TRANSPORT = 'capture-for-tests';

import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let db;
let app;
let request;
let bcrypt;
let generateTokens;
let capturedEmails;
const PASSWORD = 'stranger-password-1';
const VICTIM = 'victim@example.com';

beforeAll(async () => {
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  // The token travels as the claims a successful verification yields.
  jest.unstable_mockModule('../../utils/oauthVerification.js', () => ({
    verifyGoogleToken: async (idToken) => JSON.parse(idToken),
    verifyAppleToken: async (idToken) => JSON.parse(idToken),
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
  capturedEmails.length = 0;
  db.run('DELETE FROM native_users');
});

const google = (claims = {}) => request(app).post('/api/auth/google').send({ idToken: JSON.stringify({
  providerUserId: 'google-victim', email: VICTIM, emailVerified: true, firstName: 'Victim', ...claims }) });
const apple = (claims = {}) => request(app).post('/api/auth/apple').send({ idToken: JSON.stringify({
  providerUserId: 'apple-victim', email: VICTIM, emailVerified: true, ...claims }) });
const register = (email = VICTIM) => request(app).post('/api/auth/register')
  .send({ email, password: PASSWORD, firstName: 'Stranger', verification: 'code' });
const login = (password = PASSWORD, email = VICTIM) => request(app).post('/api/auth/login').send({ email, password });
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const userRow = (email = VICTIM) => db.get('SELECT * FROM native_users WHERE email = ?', [email]);
const users = () => db.get('SELECT count(*) AS n FROM native_users').n;
const identity = (id) => db.get('SELECT email, status, verified_by FROM native_email_identities WHERE user_id = ?', [id]);
const methods = (id) => db.all('SELECT provider_type FROM native_auth_providers WHERE user_id = ? ORDER BY provider_type', [id])
  .map((row) => row.provider_type);
const liveCodes = (id) => db.get('SELECT count(*) AS n FROM native_email_codes WHERE user_id = ? AND consumed_at IS NULL', [id]).n;
const codeFor = (email) => capturedEmails.filter((mail) => mail.to === email).at(-1).text.match(/\b(\d{6})\b/)[1];
const legacy = async ({ email = VICTIM, password = PASSWORD } = {}) => db.run(
  "INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, 'Someone')",
  [email, password ? await bcrypt.hash(password, 4) : null]).lastInsertId;
const link = (userId, type, subject, email = VICTIM) => db.run(
  `INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email, created_at, updated_at)
   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [userId, type, subject, email]);

describe('a provider proving an address nobody had proven', () => {
  it('takes back a registration a stranger never confirmed', async () => {
    expect((await register()).status).toBe(201);
    const { id } = userRow();
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isNewUser: false, linked: true, passwordRevoked: true,
      user: { id, email: VICTIM } });
    expect(userRow().password_hash).toBeNull();
    expect(identity(id)).toEqual({ email: VICTIM, status: 'verified', verified_by: 'google' });
    expect(methods(id)).toEqual(['google']);
    expect(liveCodes(id)).toBe(0);
    expect((await login()).status).toBe(401);
    expect((await request(app).post('/api/auth/verify-email/resend').send({ email: VICTIM, password: PASSWORD })).status).toBe(401);
    expect((await me(response.body.accessToken)).status).toBe(200);
  });

  it('removes the password and every session when a provider linked before R3 proves it', async () => {
    const id = await legacy();
    db.run("INSERT INTO native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at) VALUES (?, 'email', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [id, VICTIM]);
    link(id, 'google', 'google-victim');
    const stranger = await login();
    expect(stranger.status).toBe(200);
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ linked: false, passwordRevoked: true, user: { id } });
    expect((await me(stranger.body.accessToken)).status).toBe(401);
    expect((await refresh(stranger.body.refreshToken)).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect(methods(id)).toEqual(['google']);
    expect(identity(id)).toEqual({ email: VICTIM, status: 'verified', verified_by: 'google' });
    expect((await me(response.body.accessToken)).status).toBe(200);
  });

  it('revokes the sessions even when the password was removed beforehand', async () => {
    const id = await legacy();
    db.run("INSERT INTO native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at) VALUES (?, 'email', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [id, VICTIM]);
    link(id, 'google', 'google-victim');
    const stranger = await login();
    expect(stranger.status).toBe(200);
    const unlinked = await request(app).delete('/api/auth/me/providers/email').set('Authorization', `Bearer ${stranger.body.accessToken}`);
    expect(unlinked.status).toBe(200);
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body.passwordRevoked).toBe(false);
    expect((await me(stranger.body.accessToken)).status).toBe(401);
    expect((await refresh(stranger.body.refreshToken)).status).toBe(401);
    expect((await me(response.body.accessToken)).status).toBe(200);
  });

  it("takes the stranger's phones off the account", async () => {
    const id = await legacy();
    link(id, 'google', 'google-victim');
    db.run(`INSERT INTO native_push_tokens (user_id, device_token, created_at, updated_at)
      VALUES (?, 'ExponentPushToken[stranger-phone]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id]);
    expect((await google()).body.passwordRevoked).toBe(true);
    expect(db.get('SELECT count(*) AS n FROM native_push_tokens WHERE user_id = ?', [id]).n).toBe(0);
  });

  it('confirms an account from before R3 without a password, and takes nothing', async () => {
    const id = await legacy({ password: null });
    link(id, 'apple', 'apple-victim');
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ linked: true, passwordRevoked: false, user: { id } });
    expect(identity(id)).toEqual({ email: VICTIM, status: 'verified', verified_by: 'google' });
    expect(methods(id)).toEqual(['apple', 'google']);
  });

  it('finds the account whatever case the provider writes the address in', async () => {
    const id = await legacy({ password: null });
    const response = await google({ email: ' Victim@Example.COM ' });
    expect(response.body.user.id).toBe(id);
    expect(users()).toBe(1);
    expect(db.get("SELECT provider_email FROM native_auth_providers WHERE provider_user_id = 'google-victim'").provider_email).toBe(VICTIM);
  });
});

describe('a provider and a confirmed account', () => {
  it('only links: the password and its sessions stay', async () => {
    expect((await register()).status).toBe(201);
    const confirmed = await request(app).post('/api/auth/verify-email').send({ email: VICTIM, password: PASSWORD, code: codeFor(VICTIM) });
    expect(confirmed.status).toBe(200);
    const response = await google();
    expect(response.body).toMatchObject({ linked: true, passwordRevoked: false });
    expect((await login()).status).toBe(200);
    expect((await me(confirmed.body.accessToken)).status).toBe(200);
    expect(methods(confirmed.body.user.id)).toEqual(['email', 'google']);
    expect(identity(confirmed.body.user.id).verified_by).toBe('code');
  });

  it('creates a new account with the proven address, lower-cased', async () => {
    const response = await google({ email: 'New@Example.com' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isNewUser: true, linked: false, passwordRevoked: false, user: { email: 'new@example.com' } });
    expect(identity(response.body.user.id)).toEqual({ email: 'new@example.com', status: 'verified', verified_by: 'google' });
    expect(db.get("SELECT provider_email FROM native_auth_providers WHERE provider_user_id = 'google-victim'").provider_email).toBe('new@example.com');
  });
});

describe('a provider without proof', () => {
  it('neither joins nor creates an account for an address it did not verify', async () => {
    const id = await legacy({ password: null });
    const unverified = await apple({ emailVerified: false });
    expect(unverified.status).toBe(400);
    expect(unverified.body.code).toBe('PROVIDER_EMAIL_UNVERIFIED');
    const unnamed = await apple({ email: undefined });
    expect(unnamed.status).toBe(400);
    expect(unnamed.body.code).toBe('PROVIDER_EMAIL_REQUIRED');
    expect((await google({ emailVerified: false })).status).toBe(400);
    expect(users()).toBe(1);
    expect(methods(id)).toEqual([]);
  });

  it('signs in through a linked provider, and changes nothing', async () => {
    const id = await legacy();
    link(id, 'apple', 'apple-victim');
    const response = await apple({ email: undefined, emailVerified: false });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ passwordRevoked: false, user: { id } });
    expect(identity(id)).toBeUndefined();
    expect((await login()).status).toBe(200);
  });

  it('leaves an account alone when the provider proves a different address', async () => {
    const id = await legacy({ email: 'account@example.com' });
    link(id, 'google', 'google-victim');
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body.passwordRevoked).toBe(false);
    expect(userRow('account@example.com').password_hash).not.toBeNull();
    expect(identity(id)).toBeUndefined();
  });

  it('gives a pending account no session, even through a linked provider', async () => {
    expect((await register('pending@example.com')).status).toBe(201);
    const { id } = userRow('pending@example.com');
    link(id, 'apple', 'apple-pending', 'pending@example.com');
    const response = await apple({ providerUserId: 'apple-pending', email: undefined, emailVerified: false });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(response.body.accessToken).toBeUndefined();
    expect(identity(id).status).toBe('pending');
  });
});

describe('a session of a pending account', () => {
  it('reaches nothing, PUT /me included', async () => {
    expect((await register()).status).toBe(201);
    const { id, token_version: version } = userRow();
    const { accessToken } = generateTokens(id, version);
    const profile = await me(accessToken);
    expect(profile.status).toBe(403);
    expect(profile.body.code).toBe('EMAIL_NOT_VERIFIED');
    const change = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: PASSWORD, password: 'another-password-1' });
    expect(change.status).toBe(403);
    expect(change.body.accessToken).toBeUndefined();
  });
});
