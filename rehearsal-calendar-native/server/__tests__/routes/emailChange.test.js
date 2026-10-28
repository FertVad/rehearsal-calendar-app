/**
 * Changing the sign-in address needs more than a session (R3: HP01).
 *
 * Before: PUT /me dropped a new email while the app reported it saved, and
 * nothing else could change it. Now every change needs a code sent to the
 * current address and the code sent to the new one, and the password when the
 * account has one. A password alone is not proof: a session sets a first one
 * in the profile and can unlink Google or Apple beside it (review R3-19). The
 * address, its proof and its sign-in method row change together, every other
 * session and live code goes, and the old address is told.
 *
 * Two confirmations at once and a registration of the new address racing the
 * change need PostgreSQL and live in the R3_AUTH scenario.
 */
process.env.EMAIL_CODE_SECRET = 'email-change-test-secret';

import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let db;
let app;
let request;
let bcrypt;
let generateTokens;
let capturedEmails;
const PASSWORD = 'holder-password-1';
const OLD = 'old@example.com';
const NEW = 'new@example.com';

beforeAll(async () => {
  db = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  // A Google sign-in is the claims a successful verification yields.
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
  app.use('/api/auth', (await import('../../routes/passwordReset.js')).default);
  app.use('/api/auth', (await import('../../routes/emailChange.js')).default);
});

afterAll(() => closeIntegrationDb());

const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.EMAIL_TRANSPORT = 'capture-for-tests';
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  globalThis.fetch = realFetch;
  capturedEmails.length = 0;
  db.run('DELETE FROM native_users');
});

const holder = async ({ password = PASSWORD, email = OLD } = {}) => {
  const id = db.run("INSERT INTO native_users (email, password_hash, first_name, locale) VALUES (?, ?, 'Holder', 'ru')",
    [email, password ? await bcrypt.hash(password, 4) : null]).lastInsertId;
  if (password) {
    db.run("INSERT INTO native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at) VALUES (?, 'email', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [id, email]);
  }
  return id;
};
const tokenFor = (id) => generateTokens(id, db.get('SELECT token_version FROM native_users WHERE id = ?', [id]).token_version);
const ask = (token, body) => request(app).post('/api/auth/me/email/change').set('Authorization', `Bearer ${token}`).send(body);
const confirm = (token, body) => request(app).post('/api/auth/me/email/change/confirm').set('Authorization', `Bearer ${token}`).send(body);
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const codeFor = (email) => capturedEmails.filter((mail) => mail.to === email).at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
const emailOf = (id) => db.get('SELECT email FROM native_users WHERE id = ?', [id]).email;
const codes = (id, purpose) => db.all('SELECT email, attempts, consumed_at FROM native_email_codes WHERE user_id = ? AND purpose = ?', [id, purpose]);
const wrong = (code) => (code === '000000' ? '000001' : '000000');
const pair = () => ({ code: codeFor(NEW), currentCode: codeFor(OLD) });
const google = () => request(app).post('/api/auth/google').send({ idToken: JSON.stringify({
  providerUserId: 'google-holder', email: OLD, emailVerified: true, firstName: 'Holder' }) });

describe('POST /auth/me/email/change', () => {
  it('refuses a malformed or unchanged address', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    expect((await ask(accessToken, { newEmail: 'nope', currentPassword: PASSWORD })).body).toMatchObject({ code: 'EMAIL_INVALID', field: 'newEmail' });
    expect((await ask(accessToken, { newEmail: ' Old@Example.com', currentPassword: PASSWORD })).body.code).toBe('EMAIL_UNCHANGED');
  });

  it('refuses before writing anything when no email can be sent', async () => {
    const id = await holder();
    delete process.env.EMAIL_TRANSPORT;
    const response = await ask(tokenFor(id).accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect(response.status).toBe(503);
    expect(codes(id, 'change')).toEqual([]);
  });

  it('needs the current password: a session alone does not move the account', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    expect((await ask(accessToken, { newEmail: NEW })).status).toBe(403);
    const wrongPassword = await ask(accessToken, { newEmail: NEW, currentPassword: 'not-the-password' });
    expect(wrongPassword.status).toBe(403);
    expect(wrongPassword.body.code).toBe('CURRENT_PASSWORD_INVALID');
    expect(codes(id, 'change')).toEqual([]);
  });

  it('refuses an address that is taken', async () => {
    const id = await holder();
    await holder({ email: NEW, password: null });
    const response = await ask(tokenFor(id).accessToken, { newEmail: 'NEW@example.com', currentPassword: PASSWORD });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });

  it('sends codes to both addresses, and waits a minute before more', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    const response = await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ status: 'codes_sent', delivery: { newAddress: 'sent', currentAddress: 'sent' } });
    expect(capturedEmails.map((mail) => mail.to).sort()).toEqual([NEW, OLD]);
    expect(capturedEmails[0].subject).toMatch(/Rehearsly/);
    expect(emailOf(id)).toBe(OLD);
    const again = await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('RATE_LIMITED');
  });

  it('asks an account without a password for the two codes only', async () => {
    const id = await holder({ password: null });
    const response = await ask(tokenFor(id).accessToken, { newEmail: NEW });
    expect(response.status).toBe(202);
    expect(response.body.delivery).toEqual({ newAddress: 'sent', currentAddress: 'sent' });
    expect(capturedEmails.map((mail) => mail.to).sort()).toEqual([NEW, OLD]);
  });
});

describe('POST /auth/me/email/change/confirm', () => {
  it('answers a missing request with CODE_MISSING', async () => {
    const id = await holder();
    const response = await confirm(tokenFor(id).accessToken, { code: '123456' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CODE_MISSING');
  });

  it('counts a wrong code and keeps the address', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    const response = await confirm(accessToken, { code: wrong(codeFor(NEW)), currentCode: codeFor(OLD) });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'CODE_INVALID', field: 'code' });
    expect(codes(id, 'change')[0].attempts).toBe(1);
    expect(emailOf(id)).toBe(OLD);
  });

  it('a wrong code in either place spends neither right one: the pair still works', async () => {
    const id = await holder({ password: null });
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW });
    const badCurrent = await confirm(accessToken, { code: codeFor(NEW), currentCode: wrong(codeFor(OLD)) });
    expect(badCurrent.body).toMatchObject({ code: 'CODE_INVALID', field: 'currentCode' });
    const badNew = await confirm(accessToken, { code: wrong(codeFor(NEW)), currentCode: codeFor(OLD) });
    expect(badNew.body).toMatchObject({ code: 'CODE_INVALID', field: 'code' });
    expect(codes(id, 'change')[0]).toMatchObject({ attempts: 1, consumed_at: null });
    expect(codes(id, 'confirm')[0]).toMatchObject({ attempts: 1, consumed_at: null });
    const both = await confirm(accessToken, pair());
    expect(both.status).toBe(200);
    expect(emailOf(id)).toBe(NEW);
  });

  it('needs the current-address code from an account with a password too', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    const response = await confirm(accessToken, { code: codeFor(NEW) });
    expect(response.status).toBe(400);
    expect(response.body.field).toBe('currentCode');
    expect(emailOf(id)).toBe(OLD);
  });

  it('moves the account: new address proven, other sessions and codes gone, old address told', async () => {
    const id = await holder();
    const elsewhere = tokenFor(id);
    const { accessToken } = tokenFor(id);
    // A reset code to the old address, asked for before the change.
    await request(app).post('/api/auth/password-reset/request').send({ email: OLD });
    const oldResetCode = codeFor(OLD);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    const response = await confirm(accessToken, pair());
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id, email: NEW });
    expect((await me(response.body.accessToken)).status).toBe(200);
    expect((await me(elsewhere.accessToken)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: NEW, password: PASSWORD })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: OLD, password: PASSWORD })).status).toBe(401);
    expect(db.get('SELECT email, status, verified_by FROM native_email_identities WHERE user_id = ?', [id]))
      .toEqual({ email: NEW, status: 'verified', verified_by: 'code' });
    expect(db.get("SELECT provider_email FROM native_auth_providers WHERE user_id = ? AND provider_type = 'email'", [id]).provider_email).toBe(NEW);
    expect(db.get('SELECT count(*) AS n FROM native_email_codes WHERE user_id = ? AND consumed_at IS NULL', [id]).n).toBe(0);
    const notice = capturedEmails.find((mail) => mail.to === OLD && !/\b\d{6}\b/.test(mail.subject));
    expect(notice.subject).toBe('Адрес для входа в Rehearsly изменён');
    expect(notice.text).toContain(NEW);
    for (const email of [OLD, NEW]) {
      const reset = await request(app).post('/api/auth/password-reset/confirm').send({ email, code: oldResetCode, newPassword: 'another-password-1' });
      expect(reset.body.code).toBe('CODE_MISSING');
    }
  });

  it('refuses an address taken while the change waited, and keeps the old one', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    await holder({ email: NEW, password: null });
    const response = await confirm(accessToken, pair());
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
    expect(emailOf(id)).toBe(OLD);
  });

  it('is refused to a session revoked since', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    db.run('UPDATE native_users SET token_version = token_version + 1 WHERE id = ?', [id]);
    expect((await confirm(accessToken, pair())).status).toBe(401);
    expect(emailOf(id)).toBe(OLD);
  });

  it('stands when the notice to the old address is refused', async () => {
    const id = await holder();
    const elsewhere = tokenFor(id);
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    const codesSent = pair();
    Object.assign(process.env, { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'test-key-value', EMAIL_FROM: 'Rehearsly <no-reply@rehearsly.me>' });
    globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({}) });
    const response = await confirm(accessToken, codesSent);
    expect(response.status).toBe(200);
    expect(emailOf(id)).toBe(NEW);
    expect((await me(response.body.accessToken)).status).toBe(200);
    expect((await me(elsewhere.accessToken)).status).toBe(401);
  });

  it("leaves the account's push devices in place", async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    db.run(`INSERT INTO native_push_tokens (user_id, device_token, created_at, updated_at)
      VALUES (?, 'ExponentPushToken[holder-phone]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id]);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect((await confirm(accessToken, pair())).status).toBe(200);
    expect(db.get('SELECT count(*) AS n FROM native_push_tokens WHERE user_id = ?', [id]).n).toBe(1);
  });
});

describe('a stolen session cannot move the account (review R3-19)', () => {
  it('a first password it sets does not replace the code to the current address', async () => {
    const signedIn = await google();
    expect(signedIn.status).toBe(200);
    const token = signedIn.body.accessToken;
    const set = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ password: 'thief-password-1' });
    expect(set.status).toBe(200);
    const thief = set.body.accessToken;
    expect((await ask(thief, { newEmail: NEW, currentPassword: 'thief-password-1' })).status).toBe(202);
    const moved = await confirm(thief, { code: codeFor(NEW) });
    expect(moved.status).toBe(400);
    expect(moved.body.field).toBe('currentCode');
    expect(emailOf(signedIn.body.user.id)).toBe(OLD);
  });

  it('nor does unlinking Google beside that password', async () => {
    const signedIn = await google();
    const set = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${signedIn.body.accessToken}`)
      .send({ password: 'thief-password-1' });
    const thief = set.body.accessToken;
    const unlinked = await request(app).delete('/api/auth/me/providers/google').set('Authorization', `Bearer ${thief}`);
    expect(unlinked.status).toBe(200);
    expect((await ask(thief, { newEmail: NEW, currentPassword: 'thief-password-1' })).status).toBe(202);
    expect((await confirm(thief, { code: codeFor(NEW) })).body.field).toBe('currentCode');
    expect(emailOf(signedIn.body.user.id)).toBe(OLD);
  });

  it('nor does replacing the password of an account with Google', async () => {
    // Registered with a password, confirmed by code, Google linked later.
    const id = await holder();
    db.run(`INSERT INTO native_email_identities (user_id, email, status, verified_at, verified_by, created_at, updated_at)
      VALUES (?, ?, 'verified', CURRENT_TIMESTAMP, 'code', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, OLD]);
    db.run(`INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email, created_at, updated_at)
      VALUES (?, 'google', 'google-holder', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, OLD]);
    const stolen = tokenFor(id).accessToken;
    expect((await request(app).delete('/api/auth/me/providers/email').set('Authorization', `Bearer ${stolen}`)).status).toBe(200);
    const set = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${stolen}`).send({ password: 'thief-password-1' });
    expect(set.status).toBe(200);
    const thief = set.body.accessToken;
    expect((await ask(thief, { newEmail: NEW, currentPassword: 'thief-password-1' })).status).toBe(202);
    expect((await confirm(thief, { code: codeFor(NEW) })).body.field).toBe('currentCode');
    expect(emailOf(id)).toBe(OLD);
  });
});
