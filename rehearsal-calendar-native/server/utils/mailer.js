/**
 * Sending transactional mail.
 *
 * The domain could receive but not send: `support@rehearsly.me` is an ImprovMX
 * forwarder, which puts mail into a real inbox and offers no way out. SPF named
 * only ImprovMX and there was no DKIM at all, so anything claiming to be from
 * this domain would have been treated as forgery.
 *
 * Behind one function on purpose. The provider is a detail — swapping Resend
 * for Postmark or SMTP should touch this file and nothing else — and the rest
 * of the code should not learn how mail is sent.
 *
 * Silent when unconfigured rather than broken: without RESEND_API_KEY the send
 * is logged and skipped, so local work and the tests do not need a key or a
 * network. Callers must not treat a resolved promise as proof of delivery —
 * nothing here can promise that, any more than the push service can.
 */
import { logger } from './logger.js';

const FROM = process.env.MAIL_FROM || 'Rehearsly <no-reply@rehearsly.me>';
const API_KEY = process.env.RESEND_API_KEY;

export function mailIsConfigured() {
  return Boolean(API_KEY);
}

/**
 * @returns {Promise<boolean>} whether the provider accepted it. Accepted is not
 *   delivered; nothing here can tell the difference.
 */
export async function sendMail({ to, subject, html, text }) {
  if (!API_KEY) {
    logger.warn(`[Mail] No RESEND_API_KEY — not sending "${subject}" to ${to}`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });

    if (!response.ok) {
      // The body carries the provider's reason — a domain not verified, a
      // rejected address — and is worth having in the log rather than a status.
      const detail = await response.text().catch(() => '');
      logger.error(`[Mail] Provider refused "${subject}": ${response.status} ${detail}`);
      return false;
    }

    logger.info(`[Mail] Sent "${subject}"`);
    return true;
  } catch (error) {
    // Never let a mail failure take down the request that triggered it. A
    // registration that succeeded and an email that did not is recoverable —
    // the address can be verified later. The reverse is not.
    logger.error(`[Mail] Could not send "${subject}":`, error);
    return false;
  }
}
