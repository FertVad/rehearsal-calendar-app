/**
 * The Google ID token must have been issued for us.
 *
 * The audience argument was commented out with a note about debugging, and the
 * comment beside it said the signature and issuer were still checked — which is
 * true and beside the point. google-auth-library guards the whole comparison
 * with `if (typeof requiredAudience !== 'undefined' && requiredAudience !==
 * null)`, so an absent audience is not a laxer check but no check at all.
 *
 * What that costs: a Google `sub` identifies the same person to every OAuth
 * client. Any other app's genuine Google token, replayed here, matches the
 * native_auth_providers row on ('google', sub) and is answered with a 30-day
 * access token for that account.
 *
 * So these assert on the argument rather than on the outcome — the argument is
 * the whole of it.
 */
import { jest } from '@jest/globals';

const verifyIdToken = jest.fn();

jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken(...args) {
      return verifyIdToken(...args);
    }
  },
}));

const { verifyGoogleToken } = await import('../../utils/oauthVerification.js');

const payload = {
  sub: '1234567890',
  email: 'someone@gmail.com',
  email_verified: true,
  iss: 'https://accounts.google.com',
  aud: 'ios-client.apps.googleusercontent.com',
  given_name: 'Нина',
  family_name: 'Петрова',
};

const env = { ...process.env };

beforeEach(() => {
  verifyIdToken.mockReset().mockResolvedValue({ getPayload: () => payload });
  process.env.GOOGLE_CLIENT_ID_IOS = 'ios-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_ID_ANDROID = 'android-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_ID_WEB = 'web-client.apps.googleusercontent.com';
});

afterAll(() => {
  process.env = env;
});

describe('verifyGoogleToken', () => {
  it('tells the library which audiences we accept', async () => {
    await verifyGoogleToken('a-token');

    const [args] = verifyIdToken.mock.calls[0];
    expect(args.audience).toEqual([
      'ios-client.apps.googleusercontent.com',
      'android-client.apps.googleusercontent.com',
      'web-client.apps.googleusercontent.com',
    ]);
  });

  it('never passes an undefined audience', async () => {
    // The failure this file exists for. An undefined audience skips the check
    // entirely rather than widening it.
    await verifyGoogleToken('a-token');

    const [args] = verifyIdToken.mock.calls[0];
    expect(args.audience).toBeDefined();
    expect(args.audience).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(args, 'audience')).toBe(true);
  });

  it('skips the client ids that are not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID_ANDROID;

    await verifyGoogleToken('a-token');

    expect(verifyIdToken.mock.calls[0][0].audience).toEqual([
      'ios-client.apps.googleusercontent.com',
      'web-client.apps.googleusercontent.com',
    ]);
  });

  it('refuses to verify at all when none are configured', async () => {
    // Fail closed: an empty list must not become "accept anything", which is
    // where this started.
    delete process.env.GOOGLE_CLIENT_ID_IOS;
    delete process.env.GOOGLE_CLIENT_ID_ANDROID;
    delete process.env.GOOGLE_CLIENT_ID_WEB;

    await expect(verifyGoogleToken('a-token')).rejects.toThrow(/audience/i);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('still rejects a token from another issuer', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...payload, iss: 'https://accounts.example.com' }),
    });

    await expect(verifyGoogleToken('a-token')).rejects.toThrow(/issuer/i);
  });

  it('passes the account through when everything checks out', async () => {
    const user = await verifyGoogleToken('a-token');

    expect(user.providerUserId).toBe('1234567890');
    expect(user.email).toBe('someone@gmail.com');
    expect(user.emailVerified).toBe(true);
  });
});
