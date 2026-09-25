/**
 * Changing the sign-in address needs more than a session (R3: HP01).
 *
 * Before: PUT /me dropped a new email while the app reported it saved, and
 * nothing else could change it. Now the request proves the account holder —
 * the current password, or for an account without one a code sent to the
 * current address — and the change happens only with the code sent to the new
 * address. The address, its proof and its sign-in method row change together,
 * every other session and live code goes, and the old address is told.
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

beforeEach(() => {
  process.env.EMAIL_TRANSPORT = 'capture-for-tests';
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

  it('sends a code to the new address, and waits a minute before another', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    const response = await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ status: 'codes_sent', currentCodeRequired: false, delivery: { newAddress: 'sent' } });
    expect(capturedEmails.map((mail) => mail.to)).toEqual([NEW]);
    expect(capturedEmails[0].subject).toMatch(/Rehearsly/);
    expect(emailOf(id)).toBe(OLD);
    const again = await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('RATE_LIMITED');
  });

  it('asks an account without a password for a code to its current address too', async () => {
    const id = await holder({ password: null });
    const response = await ask(tokenFor(id).accessToken, { newEmail: NEW });
    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ currentCodeRequired: true, delivery: { newAddress: 'sent', currentAddress: 'sent' } });
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
    const response = await confirm(accessToken, { code: wrong(codeFor(NEW)) });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'CODE_INVALID', field: 'code' });
    expect(codes(id, 'change')[0].attempts).toBe(1);
    expect(emailOf(id)).toBe(OLD);
  });

  it('without a password, a wrong current-address code leaves the new-address code unspent', async () => {
    const id = await holder({ password: null });
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW });
    const response = await confirm(accessToken, { code: codeFor(NEW), currentCode: wrong(codeFor(OLD)) });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'CODE_INVALID', field: 'currentCode' });
    expect(codes(id, 'change')[0]).toMatchObject({ attempts: 0, consumed_at: null });
    const both = await confirm(accessToken, { code: codeFor(NEW), currentCode: codeFor(OLD) });
    expect(both.status).toBe(200);
    expect(emailOf(id)).toBe(NEW);
  });

  it('moves the account: new address proven, other sessions and codes gone, old address told', async () => {
    const id = await holder();
    const elsewhere = tokenFor(id);
    const { accessToken } = tokenFor(id);
    // A reset code to the old address, asked for before the change.
    await request(app).post('/api/auth/password-reset/request').send({ email: OLD });
    const oldResetCode = codeFor(OLD);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    const response = await confirm(accessToken, { code: codeFor(NEW) });
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
    const notice = capturedEmails.find((mail) => mail.to === OLD && !/\b\d{6}\b/.test(mail.text));
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
    const response = await confirm(accessToken, { code: codeFor(NEW) });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
    expect(emailOf(id)).toBe(OLD);
  });

  it('is refused to a session revoked since', async () => {
    const id = await holder();
    const { accessToken } = tokenFor(id);
    await ask(accessToken, { newEmail: NEW, currentPassword: PASSWORD });
    db.run('UPDATE native_users SET token_version = token_version + 1 WHERE id = ?', [id]);
    expect((await confirm(accessToken, { code: codeFor(NEW) })).status).toBe(401);
    expect(emailOf(id)).toBe(OLD);
  });
});
