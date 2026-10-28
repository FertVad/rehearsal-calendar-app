/**
 * How an email leaves the server.
 *
 * EMAIL_TRANSPORT picks the provider:
 *   resend             RESEND_API_KEY and EMAIL_FROM; one HTTPS call to Resend.
 *   capture-for-tests  kept in memory (capturedEmails); nothing leaves the process.
 * Anything else, including unset, is unavailable. Callers check `available`
 * before creating a code, and answer 503 rather than leave someone waiting for
 * a message that cannot be sent.
 *
 * `send` never throws. It resolves to { ok: true, id } when the provider
 * accepted the message (accepted is not delivered), or { ok: false, reason }:
 * HTTP_<status> when the provider refused it, TIMEOUT or NETWORK when there
 * was no answer — the provider may still send that one, so it is not a
 * refusal — and UNAVAILABLE when no provider is configured.
 */
import { logger } from '../../utils/logger.js';

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 8000;

export const capturedEmails = [];

export function emailTransport(env = process.env, request = globalThis.fetch) {
  const kind = env.EMAIL_TRANSPORT;
  if (kind === 'capture-for-tests') {
    return {
      available: true,
      async send(message) {
        capturedEmails.push({ ...message });
        return { ok: true, id: `captured-${capturedEmails.length}` };
      },
    };
  }
  if (kind === 'resend' && typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.trim()
      && typeof env.EMAIL_FROM === 'string' && env.EMAIL_FROM.trim()) {
    const key = env.RESEND_API_KEY.trim();
    const from = env.EMAIL_FROM.trim();
    return {
      available: true,
      async send({ to, subject, text, idempotencyKey }) {
        try {
          const response = await request(RESEND_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              // A retried request with the same key is not sent twice.
              ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            },
            body: JSON.stringify({ from, to: [to], subject, text }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          });
          if (!response.ok) {
            logger.warn(`[Email] Provider refused a message: HTTP ${response.status}`);
            return { ok: false, reason: `HTTP_${response.status}` };
          }
          const body = await response.json().catch(() => ({}));
          return { ok: true, id: typeof body.id === 'string' ? body.id : null };
        } catch (error) {
          logger.warn(`[Email] Provider unreachable: ${error?.name || 'Error'}`);
          return { ok: false, reason: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK' };
        }
      },
    };
  }
  return { available: false, async send() { return { ok: false, reason: 'UNAVAILABLE' }; } };
}
