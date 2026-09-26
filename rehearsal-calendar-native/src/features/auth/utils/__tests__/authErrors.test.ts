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

  it('names wrong credentials, and passes any other message through', () => {
    const t = translations.en;
    expect(authErrorMessage(t, new AuthFlowError('Invalid email or password', undefined, 401))).toBe(t.auth.invalidCredentials);
    expect(authErrorMessage(t, new AuthFlowError('Something else', undefined, 500))).toBe('Something else');
    expect(authErrorMessage(t, 'not an error')).toBe(t.common.error);
  });
});
