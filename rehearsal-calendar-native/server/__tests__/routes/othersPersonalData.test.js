/**
 * Nobody is handed what nobody shows (T-273).
 *
 * Before: the members list gave everyone in a project the address and the
 * photo link of everyone else, and a Google sign-in kept the account's Google
 * profile photo. The app shows neither — a member is a name, an avatar is
 * initials — yet App Store Connect's privacy labels had to declare photos, and
 * the privacy policy was wrong.
 *
 * The Google verifier runs for real; only google-auth-library is replaced by
 * the payload a genuine token yields, picture included.
 */
process.env.EMAIL_CODE_SECRET = 'others-personal-data-test-secret';
process.env.EMAIL_TRANSPORT = 'capture-for-tests';
process.env.GOOGLE_CLIENT_ID_IOS = 'ios-client.apps.googleusercontent.com';

import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

const PICTURE = 'https://lh3.googleusercontent.com/a/someones-face=s96-c';

let db;
let data;
let app;
let request;
let generateTokens;
let googlePayload;

beforeAll(async () => {
  db = await setupIntegrationDb();
  data = await seedTestData(db);
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: db, isPostgres: false, initDatabase: async () => db, testConnection: async () => true,
  }));
  jest.unstable_mockModule('google-auth-library', () => ({
    OAuth2Client: class {
      async verifyIdToken() {
        return { getPayload: () => googlePayload };
      }
    },
  }));
  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../../routes/auth.js')).default);
  app.use('/api/native/projects', (await import('../../routes/native/members.js')).default);
});

afterAll(() => closeIntegrationDb());

const tokenOf = (id) => generateTokens(id, db.get('SELECT token_version FROM native_users WHERE id = ?', [id]).token_version).accessToken;

describe('the members list', () => {
  it("names everyone, and gives nobody another's address or photo", async () => {
    db.run('UPDATE native_users SET avatar_url = ? WHERE id = ?', [PICTURE, data.adminId]);
    const response = await request(app)
      .get(`/api/native/projects/${data.projectId}/members`)
      .set('Authorization', `Bearer ${tokenOf(data.memberId)}`);
    expect(response.status).toBe(200);
    expect(response.body.members.map((m) => [m.firstName, m.lastName])).toEqual([['Admin', 'User'], ['Member', 'User']]);
    for (const member of response.body.members) {
      expect(member).not.toHaveProperty('email');
      expect(member).not.toHaveProperty('avatarUrl');
    }
    expect(JSON.stringify(response.body)).not.toMatch(/admin@test\.com|googleusercontent/);
  });
});

describe('a Google sign-in', () => {
  beforeEach(() => {
    googlePayload = {
      sub: 'google-nina', email: 'nina@example.com', email_verified: true,
      iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID_IOS,
      given_name: 'Nina', family_name: 'Petrova', picture: PICTURE,
    };
  });

  const google = () => request(app).post('/api/auth/google').send({ idToken: 'a-google-token' });
  const avatarOf = (email) => db.get('SELECT avatar_url FROM native_users WHERE email = ?', [email]).avatar_url;

  it('creates the account without the Google photo', async () => {
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body.isNewUser).toBe(true);
    expect(avatarOf('nina@example.com')).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain('googleusercontent');
  });

  it('links an existing account without the Google photo', async () => {
    googlePayload = { ...googlePayload, sub: 'google-member', email: 'member@test.com' };
    const response = await google();
    expect(response.status).toBe(200);
    expect(response.body.linked).toBe(true);
    expect(avatarOf('member@test.com')).toBeNull();
  });
});
