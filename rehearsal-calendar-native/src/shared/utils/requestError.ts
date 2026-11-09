import type { Translations } from '../../i18n/translations';
import { AuthFlowError } from '../../features/auth/utils/authErrors';
import { gotNoAnswer } from './noAnswer';

/**
 * What a failed request is called on screen, in the app's language (T-228).
 *
 * Every error window and error state goes through here. They used to show
 * `err.response?.data?.error || err.message`, and with no answer at all —
 * no network, a timeout, the server down — `err.message` is axios's English:
 * "Network Error" under a Russian title (owner's iPhone, 07.11, three invite
 * requests timed out on LTE).
 *
 * - No answer: no connection, check the internet and try again.
 * - The server answered 5xx: it is unavailable, try later.
 * - The server answered and said why: what it said, as before.
 * - Anything else — no answer worth showing, or an error that is not a
 *   request's — the caller's `fallback`, never the error's own message.
 *
 * Only the text: a failure stays a failure (CLAUDE.md, rule 10).
 */
export function requestErrorMessage(t: Translations, error: unknown, fallback: string): string {
  const err = error as any;

  // Thrown whole by AuthContext (toAuthFlowError): the answer's status and the
  // server's text are kept on it, the response itself is not.
  if (err instanceof AuthFlowError) {
    if (err.status === undefined) return err.noAnswer ? t.common.noConnection : fallback;
    if (err.status >= 500) return t.common.serverUnavailable;
    return err.message || fallback;
  }

  const response = err?.response;
  if (response) {
    if (typeof response.status === 'number' && response.status >= 500) return t.common.serverUnavailable;
    const said = response.data?.error;
    return typeof said === 'string' && said.trim() ? said : fallback;
  }

  // Only a request that heard nothing from the network (T-240): a cancelled
  // one, a session that ended or an error thrown after the answer is not "no
  // connection".
  if (gotNoAnswer(err)) return t.common.noConnection;
  return fallback;
}
