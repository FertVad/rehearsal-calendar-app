/**
 * What the account endpoints accept when the app is not the one asking (A03),
 * how an emptied optional field is stored (HP02), and what happens to an email
 * change the server cannot confirm (HP01).
 *
 *  - Register and PUT /auth/me check types, lengths, the password rule, the
 *    locale list and that a timezone exists, and answer 400 — not 200 now and
 *    a 500 later, where the date helpers trip over the value.
 *  - '' and null clear lastName and phone. undefined still means "unchanged".
 *  - A different email is refused with a code the app can act on; it used to
 *    be dropped while the app said "saved". The unchanged address, which the
 *    app sends with every save, is still fine.
 *  - Replacing a password needs the current one; a stolen session is not
 *    enough. An account without a password may set its first one.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let testDb;
let app;
let request;
let bcrypt;
let generateTokens;

const PASSWORD = 'correct-horse-battery';
let userId;
let oauthUserId;
const tokenFor = (id) => generateTokens(id, testDb.get('SELECT token_version FROM native_users WHERE id = ?', [id]).token_version).accessToken;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  bcrypt = (await import('bcrypt')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const authRouter = (await import('../../routes/auth.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(async () => {
  testDb.run('DELETE FROM native_users');
  userId = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name, last_name, phone, timezone)
     VALUES ('person@example.com', ?, 'Person', 'Surname', '+972 50 000 0000', 'Asia/Jerusalem')`,
    [await bcrypt.hash(PASSWORD, 4)],
  ).lastInsertId;
  oauthUserId = testDb.run(
    "INSERT INTO native_users (email, first_name) VALUES ('oauth@example.com', 'OAuth')",
  ).lastInsertId;
});

const row = (id) => testDb.get('SELECT * FROM native_users WHERE id = ?', [id]);

describe('POST /auth/register', () => {
  const valid = { email: 'new@example.com', password: 'long-enough-1', firstName: 'New', timezone: 'Europe/Berlin' };
  const count = () => testDb.get("SELECT count(*) AS n FROM native_users WHERE email LIKE '%new%'").n;

  it.each([
    ['a short password', { password: 'seven77' }, 'PASSWORD_POLICY'],
    ['a password over 72 bytes', { password: 'я'.repeat(37) }, 'PASSWORD_POLICY'],
    ['a password of spaces', { password: ' '.repeat(12) }, 'PASSWORD_POLICY'],
    ['a malformed email', { email: 'not-an-address' }, 'EMAIL_INVALID'],
    ['a number for a name', { firstName: 42 }, 'NAME_INVALID'],
    ['a timezone that does not exist', { timezone: 'Mars/Olympus_Mons' }, 'TIMEZONE_INVALID'],
  ])('refuses %s with 400 and creates nothing', async (_label, change, code) => {
    const response = await request(app).post('/api/auth/register').send({ ...valid, ...change });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    expect(count()).toBe(0);
  });

  it('accepts 36 Cyrillic letters, which is exactly 72 bytes', async () => {
    const response = await request(app).post('/api/auth/register').send({ ...valid, password: 'я'.repeat(36) });
    expect(response.status).toBe(200);
  });

  it('stores trimmed values', async () => {
    const response = await request(app).post('/api/auth/register')
      .send({ ...valid, email: '  new@example.com ', firstName: '  New ', lastName: ' Person  ' });
    expect(response.status).toBe(200);
    const stored = testDb.get("SELECT email, first_name, last_name, timezone FROM native_users WHERE email = 'new@example.com'");
    expect(stored).toEqual({ email: 'new@example.com', first_name: 'New', last_name: 'Person', timezone: 'Europe/Berlin' });
  });
});

describe('PUT /auth/me profile fields', () => {
  it.each([
    ['an unknown timezone', { timezone: 'Mars/Olympus_Mons' }, 'TIMEZONE_INVALID'],
    ['an unsupported locale', { locale: 'fr' }, 'LOCALE_INVALID'],
    ['a string for a flag', { notificationsEnabled: 'yes' }, 'BOOLEAN_REQUIRED'],
    ['an empty first name', { firstName: '   ' }, 'NAME_INVALID'],
    ['an overlong phone', { phone: '1'.repeat(51) }, 'TEXT_INVALID'],
  ])('refuses %s with 400 and changes nothing', async (_label, body, code) => {
    const before = row(userId);
    const response = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(userId)}`).send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    expect(row(userId)).toEqual(before);
  });

  it.each([
    ['an empty string', ''],
    ['null', null],
  ])('clears the last name and phone given %s (HP02)', async (_label, value) => {
    const response = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(userId)}`)
      .send({ lastName: value, phone: value });
    expect(response.status).toBe(200);
    expect(row(userId)).toMatchObject({ last_name: null, phone: null });
    expect(response.body.user.lastName).toBeNull();
  });

  it('leaves a field alone when it is not sent', async () => {
    await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(userId)}`).send({ firstName: 'Renamed' });
    expect(row(userId)).toMatchObject({ first_name: 'Renamed', last_name: 'Surname' });
  });
});

describe('PUT /auth/me email (HP01)', () => {
  it('refuses a different address instead of dropping it', async () => {
    const response = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(userId)}`)
      .send({ firstName: 'Person', email: 'elsewhere@example.com' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EMAIL_CHANGE_REQUIRES_VERIFICATION');
    expect(row(userId)).toMatchObject({ email: 'person@example.com', first_name: 'Person' });
  });

  it('accepts the unchanged address the app sends with every save', async () => {
    const response = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(userId)}`)
      .send({ firstName: 'Renamed', email: ' Person@Example.com ' });
    expect(response.status).toBe(200);
    expect(row(userId)).toMatchObject({ email: 'person@example.com', first_name: 'Renamed' });
  });
});

describe('PUT /auth/me password', () => {
  const change = (id, body) => request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokenFor(id)}`).send(body);

  it('needs the current password', async () => {
    const before = row(userId);
    for (const body of [{ password: 'a-new-password' }, { password: 'a-new-password', currentPassword: 'wrong-password' }]) {
      const response = await change(userId, body);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('CURRENT_PASSWORD_INVALID');
    }
    expect(row(userId)).toEqual(before);
  });

  it('replaces it with the current one, revoking other sessions', async () => {
    const before = row(userId);
    const response = await change(userId, { password: 'a-new-password', currentPassword: PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    const after = row(userId);
    expect(after.token_version).toBe(before.token_version + 1);
    expect(await bcrypt.compare('a-new-password', after.password_hash)).toBe(true);
  });

  it('holds a new password to the same rule as registration', async () => {
    const response = await change(userId, { password: 'short', currentPassword: PASSWORD });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PASSWORD_POLICY');
  });

  it('lets an account without a password set its first one', async () => {
    const response = await change(oauthUserId, { password: 'first-password' });
    expect(response.status).toBe(200);
    expect(await bcrypt.compare('first-password', row(oauthUserId).password_hash)).toBe(true);
  });
});
