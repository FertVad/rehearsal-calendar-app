/** axios's own codes for a request that went out and heard nothing back. */
const NO_ANSWER_CODES = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT']);

/**
 * Whether a request failed for want of an answer from the network: a timeout,
 * a connection that broke, no network at all (T-240). Only then is "no
 * connection" the truth, and only then is the connection the request took
 * suspect.
 *
 * Not a request the app itself stopped (axios's ERR_CANCELED, a session that
 * ended — SessionEndedError), not an answer the server gave, and not an error
 * thrown by code after the answer: those got through, or never went.
 */
export function gotNoAnswer(error: unknown): boolean {
  const err = error as { isAxiosError?: boolean; response?: unknown; code?: unknown } | null | undefined;
  return Boolean(err)
    && err!.isAxiosError === true
    && !err!.response
    && typeof err!.code === 'string'
    && NO_ANSWER_CODES.has(err!.code);
}
