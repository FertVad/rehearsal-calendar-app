/**
 * What a failed request is called on screen (T-228): in the app's language,
 * never axios's English. No answer is the connection, a 5xx is the server, and
 * what the server explained itself is shown as it said it.
 */
import { AxiosError } from 'axios';
import { requestErrorMessage } from '../requestError';
import { translations, Language } from '../../../i18n/translations';
import { AuthFlowError, toAuthFlowError } from '../../../features/auth/utils/authErrors';

const LANGUAGES: Language[] = ['ru', 'en', 'es', 'de'];
const FALLBACK = 'Could not create the invite link';

/** As axios rejects a request whose connection went: no response. */
const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', undefined, {});
/** As axios rejects one that ran out of its ten seconds. */
const timeout = () => new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED', undefined, {});
const answered = (status: number, data: unknown) =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', undefined, {},
    { status, data, statusText: '', headers: {}, config: {} as any });

describe.each(LANGUAGES)('%s', (language) => {
  const t = translations[language];

  it('says there is no connection when there was no answer, never "Network Error"', () => {
    for (const error of [networkError(), timeout()]) {
      const text = requestErrorMessage(t, error, FALLBACK);
      expect(text).toBe(t.common.noConnection);
      expect(text).not.toMatch(/Network Error|timeout of/);
    }
  });

  it('says the server is unavailable on a 5xx, whatever it wrote', () => {
    expect(requestErrorMessage(t, answered(500, { error: 'Internal server error' }), FALLBACK))
      .toBe(t.common.serverUnavailable);
    expect(requestErrorMessage(t, answered(503, '<html>Bad gateway</html>'), FALLBACK))
      .toBe(t.common.serverUnavailable);
  });

  it('the same for an error AuthContext has turned into an AuthFlowError', () => {
    expect(requestErrorMessage(t, toAuthFlowError(networkError(), 'Update failed'), FALLBACK))
      .toBe(t.common.noConnection);
    expect(requestErrorMessage(t, toAuthFlowError(answered(502, {}), 'Update failed'), FALLBACK))
      .toBe(t.common.serverUnavailable);
  });

  it('has a text of its own in each language', () => {
    expect(t.common.noConnection).toBeTruthy();
    expect(t.common.serverUnavailable).toBeTruthy();
    if (language !== 'en') {
      expect(t.common.noConnection).not.toBe(translations.en.common.noConnection);
      expect(t.common.serverUnavailable).not.toBe(translations.en.common.serverUnavailable);
    }
  });
});

const t = translations.ru;

it('shows what the server explained itself, as before', () => {
  expect(requestErrorMessage(t, answered(403, { error: 'Only admins can invite' }), FALLBACK))
    .toBe('Only admins can invite');
  expect(requestErrorMessage(t, toAuthFlowError(answered(400, { error: 'Invalid timezone' }), 'Update failed'), FALLBACK))
    .toBe('Invalid timezone');
});

it("falls back to the caller's text when the server said nothing", () => {
  expect(requestErrorMessage(t, answered(404, {}), FALLBACK)).toBe(FALLBACK);
  expect(requestErrorMessage(t, answered(409, { error: '  ' }), FALLBACK)).toBe(FALLBACK);
});

it("never shows the message of an error that is not a request's", () => {
  expect(requestErrorMessage(t, new Error('Calendar access denied by EventKit'), FALLBACK)).toBe(FALLBACK);
  expect(requestErrorMessage(t, 'boom', FALLBACK)).toBe(FALLBACK);
  expect(requestErrorMessage(t, undefined, FALLBACK)).toBe(FALLBACK);
  expect(requestErrorMessage(t, new AuthFlowError('Sign in again', 'SIGN_IN_AGAIN'), FALLBACK)).toBe(FALLBACK);
});
