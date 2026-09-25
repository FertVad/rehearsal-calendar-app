/**
 * How an email leaves the server, and what it says.
 *
 * The transport is chosen by EMAIL_TRANSPORT and is unavailable unless fully
 * configured, so callers can refuse before creating a code nobody receives.
 * Sending never throws: a refusal, a timeout or a dead network is a result the
 * caller records, not an exception that loses the code row.
 */
import { emailTransport, capturedEmails } from '../../services/email/transport.js';
import { codeMessage, addressChangedMessage } from '../../services/email/messages.js';
import { LOCALES } from '../../utils/accountInput.js';

const resendEnv = { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: ' key-value ', EMAIL_FROM: 'Rehearsly <no-reply@rehearsly.me>' };

describe('email transport', () => {
  it.each([
    ['nothing set', {}],
    ['resend without a key', { EMAIL_TRANSPORT: 'resend', EMAIL_FROM: 'a@example.com' }],
    ['resend without a sender', { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'key-value' }],
    ['an unknown provider', { EMAIL_TRANSPORT: 'smtp', RESEND_API_KEY: 'key-value', EMAIL_FROM: 'a@example.com' }],
    ['a near miss of the test transport', { EMAIL_TRANSPORT: 'capture' }],
  ])('is unavailable with %s', async (_label, env) => {
    const transport = emailTransport(env, () => { throw new Error('must not be called'); });
    expect(transport.available).toBe(false);
    expect(await transport.send({ to: 'a@example.com', subject: 's', text: 't' })).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('keeps test messages in memory and touches no network', async () => {
    const before = capturedEmails.length;
    const transport = emailTransport({ EMAIL_TRANSPORT: 'capture-for-tests' }, () => { throw new Error('network used'); });
    expect(transport.available).toBe(true);
    const result = await transport.send({ to: 'a@example.com', subject: 's', text: 't' });
    expect(result.ok).toBe(true);
    expect(capturedEmails.slice(before)).toEqual([{ to: 'a@example.com', subject: 's', text: 't' }]);
  });

  it('sends through Resend with the key, the sender and an idempotency key', async () => {
    const calls = [];
    const transport = emailTransport(resendEnv, async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ id: 'resend-message-id' }) };
    });
    const result = await transport.send({ to: 'a@example.com', subject: 'Subject', text: 'Body', idempotencyKey: 'rehearsly-code-7' });
    expect(result).toEqual({ ok: true, id: 'resend-message-id' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({
      Authorization: 'Bearer key-value',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'rehearsly-code-7',
    });
    expect(JSON.parse(calls[0].init.body)).toEqual({
      from: 'Rehearsly <no-reply@rehearsly.me>', to: ['a@example.com'], subject: 'Subject', text: 'Body',
    });
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['a refusal', async () => ({ ok: false, status: 422, json: async () => ({}) }), 'HTTP_422'],
    ['a timeout', async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }, 'TIMEOUT'],
    ['a dead network', async () => { throw new TypeError('fetch failed'); }, 'NETWORK'],
  ])('reports %s as a failed send without throwing', async (_label, request, reason) => {
    const transport = emailTransport(resendEnv, request);
    expect(await transport.send({ to: 'a@example.com', subject: 's', text: 't' })).toEqual({ ok: false, reason });
  });
});

describe('email messages', () => {
  const purposes = ['verify', 'reset', 'change', 'confirm'];
  const cases = LOCALES.flatMap((locale) => purposes.map((purpose) => [locale, purpose]));

  it.each(cases)('%s %s puts the code in the subject and the body', (locale, purpose) => {
    const message = codeMessage({ to: 'a@example.com', code: '042917', purpose, locale });
    expect(message.to).toBe('a@example.com');
    expect(message.subject).toContain('042917');
    expect(message.text).toContain('042917');
    expect(message.text).toContain('15');
    expect(`${message.subject} ${message.text}`).not.toMatch(/undefined|\$\{/);
  });

  it('writes in English for a locale the app does not have', () => {
    expect(codeMessage({ to: 'a@example.com', code: '123456', purpose: 'verify', locale: 'fr' }).subject)
      .toBe('123456 is your Rehearsly code');
  });

  it.each(LOCALES)('%s tells the old address where the account went', (locale) => {
    const message = addressChangedMessage({ to: 'old@example.com', newAddress: 'new@example.com', locale });
    expect(message.to).toBe('old@example.com');
    expect(message.text).toContain('new@example.com');
    expect(message.text).toContain('support@rehearsly.me');
  });
});
