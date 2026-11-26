import type { Translations } from '../../i18n/translations';
import { AuthFlowError } from '../../features/auth/utils/authErrors';
import { gotNoAnswer } from './noAnswer';

/**
 * The server's machine codes a person can meet on the ordinary way, in the
 * app's words (T-281). Where the app already had a text for it — an invite,
 * a rehearsal, a project not found — that text; the rest are `t.errors`.
 */
const CODES: Record<string, (t: Translations) => string> = {
  NOT_PROJECT_MEMBER: (t) => t.errors.notProjectMember,
  PROJECT_NOT_FOUND: (t) => t.projects.projectNotFound,
  REHEARSAL_NOT_FOUND: (t) => t.rehearsals.notFound,
  MEMBER_NOT_FOUND: (t) => t.errors.memberNotFound,
  ADMIN_ONLY: (t) => t.errors.adminOnly,
  OWNER_ONLY: (t) => t.errors.ownerOnly,
  INVITE_INVALID: (t) => t.projects.inviteNotFound,
  INVITE_EXPIRED: (t) => t.projects.inviteExpired,
  ALREADY_MEMBER: (t) => t.errors.alreadyMember,
  RATE_LIMITED: (t) => t.errors.rateLimited,
  AVAILABILITY_BUDGET_EXCEEDED: (t) => t.errors.availabilityTooLarge,
};

/** A refusal (4xx): its code in the app's words, or the caller's fallback. */
function refusal(t: Translations, status: number | undefined, code: unknown, fallback: string): string {
  const said = typeof code === 'string' && Object.prototype.hasOwnProperty.call(CODES, code) ? CODES[code] : undefined;
  if (said) return said(t);
  // Too many requests is said by the status itself, whoever refused it.
  if (status === 429) return t.errors.rateLimited;
  return fallback;
}

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
 * - The server refused (4xx): its machine `code` in the app's words, if it is
 *   one a person meets; otherwise the caller's `fallback`. Never the server's
 *   own sentence: that is English, for the logs and the developer — it stood
 *   under a Russian "Ошибка" until T-281.
 * - Anything else — no answer worth showing, or an error that is not a
 *   request's — the caller's `fallback`, never the error's own message.
 *
 * Only the text: a failure stays a failure (CLAUDE.md, rule 10).
 */
export function requestErrorMessage(t: Translations, error: unknown, fallback: string): string {
  const err = error as any;

  // Thrown whole by AuthContext (toAuthFlowError): the answer's status and the
  // server's code are kept on it, the response itself is not.
  if (err instanceof AuthFlowError) {
    if (err.status === undefined) return err.noAnswer ? t.common.noConnection : fallback;
    if (err.status >= 500) return t.common.serverUnavailable;
    return refusal(t, err.status, err.code, fallback);
  }

  const response = err?.response;
  if (response) {
    if (typeof response.status === 'number' && response.status >= 500) return t.common.serverUnavailable;
    return refusal(t, response.status, response.data?.code, fallback);
  }

  // Only a request that heard nothing from the network (T-240): a cancelled
  // one, a session that ended or an error thrown after the answer is not "no
  // connection".
  if (gotNoAnswer(err)) return t.common.noConnection;
  return fallback;
}
