/**
 * What a failed auth request becomes on screen (R3).
 *
 * The server answers in English with a machine code; the app has to act on
 * the code (open the code screen, offer a sign-in) and say it in the
 * person's language. Every code the new flows can meet has a message in all
 * four languages.
 */
import { AuthFlowError, toAuthFlowError, authErrorMessage } from '../authErrors';
import { translations } from '../../../../i18n/translations';

const CODES = ['CODE_INVALID', 'CODE_EXPIRED', 'CODE_LOCKED', 'CODE_MISSING', 'ALREADY_VERIFIED', 'EMAIL_UNAVAILABLE',
  'RATE_LIMITED', 'PASSWORD_POLICY', 'EMAIL_INVALID', 'EMAIL_TAKEN', 'EMAIL_NOT_VERIFIED', 'SIGN_IN_AGAIN'];

describe('toAuthFlowError', () => {
  it('keeps what the server said: message, code, status, email and wait', () => {
    const failure = toAuthFlowError({ response: { status: 429, data: {
      error: 'Wait before asking for another code', code: 'RATE_LIMITED', retryAfter: 42, email: 'a@b.c' } } }, 'fallback');
    expect(failure).toBeInstanceOf(AuthFlowError);
    expect(failure).toMatchObject({ message: 'Wait before asking for another code', code: 'RATE_LIMITED', status: 429 });
    expect(failure.details).toMatchObject({ retryAfter: 42, email: 'a@b.c' });
  });

  it('falls back when there is no answer at all', () => {
    const failure = toAuthFlowError(new Error('Network Error'), 'Login failed');
    expect(failure).toMatchObject({ message: 'Login failed', code: undefined, status: undefined });
  });
});

describe('authErrorMessage', () => {
  it.each(Object.keys(translations))('has a message of its own for every code in %s', (language) => {
    const t = translations[language as keyof typeof translations];
    for (const code of CODES) {
      const message = authErrorMessage(t, new AuthFlowError('server text', code, 400, { retryAfter: 30 }));
      expect(message).not.toBe('server text');
      expect(message.length).toBeGreaterThan(0);
    }
    expect(authErrorMessage(t, new AuthFlowError('server text', 'RATE_LIMITED', 429, { retryAfter: 30 }))).toContain('30');
  });

  it('names wrong credentials', () => {
    const t = translations.en;
    expect(authErrorMessage(t, new AuthFlowError('Invalid email or password', undefined, 401))).toBe(t.auth.invalidCredentials);
  });

  // The English text — the app's own fallback or the server's — never reaches
  // the screen: no answer and an unknown code have their own message in every
  // language (review of T-130).
  it.each(Object.keys(translations))('says no answer and an unknown failure in %s, not in English', (language) => {
    const t = translations[language as keyof typeof translations];
    const offline = toAuthFlowError(new Error('Network Error'), 'Could not send the code');
    expect(authErrorMessage(t, offline)).toBe(t.auth.noConnection);
    expect(authErrorMessage(t, new AuthFlowError('Something else', undefined, 500))).toBe(t.auth.requestFailed);
    expect(authErrorMessage(t, new AuthFlowError('Something else', 'SOME_NEW_CODE', 400))).toBe(t.auth.requestFailed);
    expect(authErrorMessage(t, new Error('Failed to get ID token from Google'))).toBe(t.auth.requestFailed);
    expect(authErrorMessage(t, 'not an error')).toBe(t.auth.requestFailed);
    for (const key of ['noConnection', 'requestFailed'] as const) {
      expect(t.auth[key].length).toBeGreaterThan(0);
      if (language !== 'en') expect(t.auth[key]).not.toBe(translations.en.auth[key]);
    }
  });
});
