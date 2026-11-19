/**
 * What a failed request is called on screen (T-228): in the app's language,
 * never axios's English. No answer is the connection, a 5xx is the server, a
 * 4xx is its `code` in the app's words or the caller's fallback — never the
 * server's English sentence (T-281).
 */
import { AxiosError } from 'axios';
import { requestErrorMessage } from '../requestError';
import { translations, Language } from '../../../i18n/translations';
import { AuthFlowError, toAuthFlowError } from '../../../features/auth/utils/authErrors';
import { SessionEndedError } from '../../services/session';

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

  // T-281: the server's sentence is English and stays for the logs. Under a
  // Russian "Ошибка" stood "Only project admins can remove members".
  it("never shows the server's own words for a 4xx, coded or not", () => {
    const said = 'Only project admins can remove members';
    for (const status of [400, 401, 403, 404, 409, 410, 413, 422, 426, 429]) {
      for (const data of [{ error: said }, { error: said, code: 'SOMETHING_NEW' }]) {
        const plain = requestErrorMessage(t, answered(status, data), FALLBACK);
        const viaAuth = requestErrorMessage(t, toAuthFlowError(answered(status, data), 'Update failed'), FALLBACK);
        for (const text of [plain, viaAuth]) {
          expect(text).not.toBe(said);
          expect(text).toBe(status === 429 ? t.errors.rateLimited : FALLBACK);
        }
      }
    }
  });

  it('says each code a person meets on the way in their language', () => {
    const known: Record<string, string> = {
      NOT_PROJECT_MEMBER: t.errors.notProjectMember,
      PROJECT_NOT_FOUND: t.projects.projectNotFound,
      REHEARSAL_NOT_FOUND: t.rehearsals.notFound,
      MEMBER_NOT_FOUND: t.errors.memberNotFound,
      ADMIN_ONLY: t.errors.adminOnly,
      OWNER_ONLY: t.errors.ownerOnly,
      INVITE_INVALID: t.projects.inviteNotFound,
      INVITE_EXPIRED: t.projects.inviteExpired,
      ALREADY_MEMBER: t.errors.alreadyMember,
      RATE_LIMITED: t.errors.rateLimited,
      AVAILABILITY_BUDGET_EXCEEDED: t.errors.availabilityTooLarge,
    };
    for (const [code, text] of Object.entries(known)) {
      expect(text).toBeTruthy();
      const data = { error: `English for ${code}`, code };
      expect(requestErrorMessage(t, answered(403, data), FALLBACK)).toBe(text);
      expect(requestErrorMessage(t, toAuthFlowError(answered(403, data), 'Update failed'), FALLBACK)).toBe(text);
    }
  });

  it('has the codes\' texts in its own words, not English', () => {
    for (const key of Object.keys(translations.en.errors) as (keyof typeof translations.en.errors)[]) {
      expect(t.errors[key]).toBeTruthy();
      if (language !== 'en') expect(t.errors[key]).not.toBe(translations.en.errors[key]);
    }
  });
});

const t = translations.ru;

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

// Only a request that heard nothing from the network is "no connection"
// (T-240): not a session that ended, a request the app cancelled, or code
// that threw after the answer — whole or turned into an AuthFlowError.
it('does not call a failure that got through "no connection"', () => {
  for (const error of [
    new SessionEndedError(),
    new AxiosError('canceled', 'ERR_CANCELED', undefined, {}),
    new TypeError("Cannot read properties of undefined (reading 'user')"),
  ]) {
    expect(requestErrorMessage(t, error, FALLBACK)).toBe(FALLBACK);
    expect(requestErrorMessage(t, toAuthFlowError(error, 'Update failed'), FALLBACK)).toBe(FALLBACK);
  }
  expect(requestErrorMessage(t, toAuthFlowError(timeout(), 'Update failed'), FALLBACK)).toBe(t.common.noConnection);
});
