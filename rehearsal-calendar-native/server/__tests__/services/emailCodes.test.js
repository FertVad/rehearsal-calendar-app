/**
 * One-time email codes (R3): 6 digits, 15 minutes, 5 attempts, one live code
 * per person and purpose, stored as an HMAC bound to person, purpose and
 * address.
 *
 * Runs on the SQLite harness, which drops FOR UPDATE. What the row lock buys
 * against a second connection — one success out of two concurrent checks — is
 * proven on PostgreSQL (r3Email.mjs).
 */
process.env.EMAIL_CODE_SECRET = 'email-code-test-secret';

import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';
import {
  issueCode, checkCode, voidCodes, deliverCode, CodeRateLimited, CODE_TTL_MS, MAX_ATTEMPTS,
} from '../../services/email/codes.js';

let db;
let userId;
const EMAIL = 'person@example.com';
const start = new Date('2026-10-01T10:00:00.000Z');
const later = (ms) => new Date(start.getTime() + ms);
const row = (id) => db.get('SELECT * FROM native_email_codes WHERE id = ?', [id]);

beforeAll(async () => { db = await setupIntegrationDb(); });
afterAll(() => closeIntegrationDb());
beforeEach(() => {
  db.run('DELETE FROM native_users');
  userId = db.run("INSERT INTO native_users (email, first_name) VALUES (?, 'Person')", [EMAIL]).lastInsertId;
});

const issue = (purpose = 'verify', now = start, email = EMAIL) => issueCode(db, { userId, purpose, email, now });
const check = (code, { purpose = 'verify', email = EMAIL, now = later(1000) } = {}) =>
  checkCode(db, { userId, purpose, email, code, now });

it('stores a six-digit code only as a hash', async () => {
  const { id, code } = await issue();
  expect(code).toMatch(/^\d{6}$/);
  const stored = row(id);
  expect(stored.code_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(stored)).not.toContain(code);
  expect(stored.expires_at).toBe(later(CODE_TTL_MS).toISOString());
});

it('accepts the right code once', async () => {
  const { code } = await issue();
  expect(await check(code)).toEqual({ ok: true, email: EMAIL });
  expect(await check(code)).toEqual({ ok: false, reason: 'CODE_MISSING' });
});

it('refuses a code sent to another address without spending an attempt', async () => {
  const { id, code } = await issue();
  expect(await check(code, { email: 'elsewhere@example.com' })).toEqual({ ok: false, reason: 'CODE_MISSING' });
  expect(row(id).attempts).toBe(0);
  expect(await check(code)).toEqual({ ok: true, email: EMAIL });
});

it('burns the code on the fifth wrong attempt', async () => {
  const { id, code } = await issue();
  const wrong = code === '000000' ? '000001' : '000000';
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    expect(await check(wrong)).toEqual({ ok: false, reason: 'CODE_INVALID' });
  }
  expect(await check(wrong)).toEqual({ ok: false, reason: 'CODE_LOCKED' });
  expect(row(id).consumed_at).not.toBeNull();
  expect(await check(code)).toEqual({ ok: false, reason: 'CODE_MISSING' });
});

it('refuses a malformed code as a wrong attempt', async () => {
  const { id } = await issue();
  expect(await check('12a456')).toEqual({ ok: false, reason: 'CODE_INVALID' });
  expect(row(id).attempts).toBe(1);
});

it('refuses an expired code', async () => {
  const { code } = await issue();
  expect(await check(code, { now: later(CODE_TTL_MS) })).toEqual({ ok: false, reason: 'CODE_EXPIRED' });
});

it('replaces the live code of the same purpose', async () => {
  const first = await issue('verify', start);
  const second = await issue('verify', later(61_000));
  expect(row(first.id).consumed_at).not.toBeNull();
  expect(await check(second.code, { now: later(62_000) })).toEqual({ ok: true, email: EMAIL });
});

it('keeps purposes apart', async () => {
  const { code } = await issue('verify');
  expect(await check(code, { purpose: 'reset' })).toEqual({ ok: false, reason: 'CODE_MISSING' });
  expect(await check(code)).toEqual({ ok: true, email: EMAIL });
});

it('waits a minute between codes and allows five an hour', async () => {
  await issue('reset', start);
  await expect(issue('reset', later(30_000))).rejects.toMatchObject({ name: 'CodeRateLimited', retryAfterSeconds: 30 });
  for (let n = 1; n < 5; n++) await issue('reset', later(n * 61_000));
  const sixth = issue('reset', later(5 * 61_000));
  await expect(sixth).rejects.toBeInstanceOf(CodeRateLimited);
  await expect(issue('reset', later(60 * 60 * 1000 + 1000))).resolves.toMatchObject({ code: expect.any(String) });
});

it('voids every live code of the person, whatever the purpose', async () => {
  const verify = await issue('verify');
  const reset = await issue('reset');
  await voidCodes(db, { userId, now: later(500) });
  expect(await check(verify.code)).toEqual({ ok: false, reason: 'CODE_MISSING' });
  expect(await check(reset.code, { purpose: 'reset' })).toEqual({ ok: false, reason: 'CODE_MISSING' });
});

it('binds the hash to the address the code went to', async () => {
  const { id, code } = await issue();
  db.run("UPDATE native_email_codes SET email = 'elsewhere@example.com' WHERE id = ?", [id]);
  expect(await check(code, { email: 'elsewhere@example.com' })).toEqual({ ok: false, reason: 'CODE_INVALID' });
});

// Three outcomes, as the contract names them (review R3-05): accepted, refused,
// and no answer — which records nothing, like a crash before recording, and
// is never presented as a refusal.
it.each([
  ['accepted', { ok: true, id: 'provider-id' }, 'sent', { sent_at: true, failed_at: false }],
  ['refused', { ok: false, reason: 'HTTP_422' }, 'failed', { sent_at: false, failed_at: true }],
  ['timed out', { ok: false, reason: 'TIMEOUT' }, 'unknown', { sent_at: false, failed_at: false }],
  ['cut off', { ok: false, reason: 'NETWORK' }, 'unknown', { sent_at: false, failed_at: false }],
])('records a send the provider %s', async (_label, result, outcome, columns) => {
  const { id, code } = await issue();
  const sent = [];
  const transport = { available: true, send: async (message) => { sent.push(message); return result; } };
  expect(await deliverCode({ db, transport, codeId: id, to: EMAIL, code, purpose: 'verify', locale: 'ru' })).toBe(outcome);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: EMAIL, idempotencyKey: `rehearsly-code-${id}` });
  expect(sent[0].subject).toContain(code);
  const stored = row(id);
  expect({ sent_at: stored.sent_at !== null, failed_at: stored.failed_at !== null }).toEqual(columns);
});
