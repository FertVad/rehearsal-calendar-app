/**
 * Sign-in methods are what actually lets a person in (A04).
 *
 * Login reads native_users.password_hash; the provider rows are a registry
 * beside it. Register never wrote the email row and the one backfill that did
 * ran once, so the registry said "no password" for working passwords — and
 * refused to unlink Google from a password account as its "last method".
 * Duplicate rows the other way counted one password twice and let the last
 * real way in be removed.
 *
 * The concurrent-unlink half of A04 needs two real connections and row locks,
 * so it belongs to a PostgreSQL scenario; that scenario is not written yet.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let testDb;
let app;
let request;
let bcrypt;
let generateTokens;

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
beforeEach(() => testDb.run('DELETE FROM native_users'));

const bearer = (id) => `Bearer ${generateTokens(id, testDb.get('SELECT token_version FROM native_users WHERE id = ?', [id]).token_version).accessToken}`;
const methods = async (id) => (await request(app).get('/api/auth/me/providers').set('Authorization', bearer(id)))
  .body.providers.map((provider) => provider.providerType);
const provider = (userId, type, subject) => testDb.run(
  `INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email, created_at, updated_at)
   VALUES (?, ?, ?, 'someone@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [userId, type, subject]);
const user = async (password) => testDb.run(
  "INSERT INTO native_users (email, password_hash, first_name) VALUES ('someone@example.com', ?, 'Someone')",
  [password ? await bcrypt.hash(password, 4) : null]).lastInsertId;

it('lists the password of a new registration', async () => {
  const response = await request(app).post('/api/auth/register')
    .send({ email: 'fresh@example.com', password: 'long-enough-1', firstName: 'Fresh' });
  expect(response.status).toBe(200);
  expect(await methods(response.body.user.id)).toEqual(['email']);
});

it('counts a password with no registry row, so Google can be unlinked', async () => {
  const id = await user('long-enough-1');
  provider(id, 'google', 'google-subject');
  expect(await methods(id)).toEqual(['email', 'google']);
  const unlink = await request(app).delete('/api/auth/me/providers/google').set('Authorization', bearer(id));
  expect(unlink.status).toBe(200);
  const login = await request(app).post('/api/auth/login').send({ email: 'someone@example.com', password: 'long-enough-1' });
  expect(login.status).toBe(200);
});

it('does not list a registry row for a password that is gone', async () => {
  const id = await user(null);
  provider(id, 'email', null);
  provider(id, 'apple', 'apple-subject');
  expect(await methods(id)).toEqual(['apple']);
  const unlink = await request(app).delete('/api/auth/me/providers/email').set('Authorization', bearer(id));
  expect(unlink.status).toBe(404);
});

it('counts two email rows as one way in and keeps the last one', async () => {
  const id = await user('long-enough-1');
  provider(id, 'email', null);
  provider(id, 'email', null);
  expect(await methods(id)).toEqual(['email']);
  const unlink = await request(app).delete('/api/auth/me/providers/email').set('Authorization', bearer(id));
  expect(unlink.status).toBe(400);
  expect(testDb.get('SELECT password_hash FROM native_users WHERE id = ?', [id]).password_hash).not.toBeNull();
});

it('lists the first password an OAuth account sets', async () => {
  const id = await user(null);
  provider(id, 'google', 'google-subject');
  const set = await request(app).put('/api/auth/me').set('Authorization', bearer(id)).send({ password: 'first-password' });
  expect(set.status).toBe(200);
  expect(await methods(id)).toEqual(['email', 'google']);
  expect(testDb.get("SELECT count(*) AS n FROM native_auth_providers WHERE user_id = ? AND provider_type = 'email'", [id]).n).toBe(1);
});
