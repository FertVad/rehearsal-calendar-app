// End-to-end tests for Telegram WebApp auth on deployed API
// Requires: TELEGRAM_BOT_TOKEN, BASE_URL, TEST_USER_ID, TEST_CHAT_ID
// Optional: TG_INITDATA_MAX_AGE_SEC (server-side)

import crypto from 'crypto';
import process from 'process';

const fetchImpl = globalThis.fetch || (await import('node-fetch')).default;

function hmacSha256Hex(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}
function deriveSecretKey(botToken) {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
}
function buildInitData({ userId, chatId, authDate = Math.floor(Date.now() / 1000) }) {
  const user = { id: Number(userId) };
  const chat = { id: Number(chatId) };
  const entries = {
    auth_date: String(authDate),
    user: encodeURIComponent(JSON.stringify(user)),
    chat: encodeURIComponent(JSON.stringify(chat)),
  };
  const dataCheckString = Object.keys(entries)
    .sort()
    .map(k => `${k}=${entries[k]}`)
    .join('\n');
  return { entries, dataCheckString };
}
function toQuery(entries, hash) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) p.set(k, v);
  p.set('hash', hash);
  return p.toString();
}

async function request(base, path, initData) {
  const res = await fetchImpl(new URL(path, base).toString(), {
    headers: initData ? { 'x-telegram-init-data': initData } : {},
  });
  return { status: res.status, body: await res.text() };
}

async function run() {
  const BASE_URL = process.env.BASE_URL;
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const USER_ID = process.env.TEST_USER_ID;
  const CHAT_ID = process.env.TEST_CHAT_ID; // negative for groups

  if (!BASE_URL || !TOKEN || !USER_ID || !CHAT_ID) {
    console.error('Set BASE_URL, TELEGRAM_BOT_TOKEN, TEST_USER_ID, TEST_CHAT_ID');
    process.exit(2);
  }

  const secret = deriveSecretKey(TOKEN);

  function makeInitData(ts = Math.floor(Date.now() / 1000), overrides = {}) {
    const { entries, dataCheckString } = buildInitData({ userId: USER_ID, chatId: CHAT_ID, authDate: ts, ...overrides });
    const hash = hmacSha256Hex(dataCheckString, secret);
    return toQuery(entries, hash);
  }

  let passed = 0;
  let failed = 0;
  const tests = [];

  async function t(name, fn) {
    try {
      await fn();
      console.log('✓', name);
      passed++;
    } catch (e) {
      console.error('✗', name, '-', e.message || e);
      failed++;
    }
  }

  // Positive: project
  await t('GET /project ok', async () => {
    const initData = makeInitData();
    const { status } = await request(BASE_URL, `/api/project/${encodeURIComponent(CHAT_ID)}`, initData);
    if (status !== 200) throw new Error(`expected 200, got ${status}`);
  });

  // Positive: actors
  await t('GET /project/actors ok', async () => {
    const initData = makeInitData();
    const { status } = await request(BASE_URL, `/api/project/${encodeURIComponent(CHAT_ID)}/actors`, initData);
    if (status !== 200) throw new Error(`expected 200, got ${status}`);
  });

  // Negative: no header
  await t('GET /project without header is 401', async () => {
    const { status } = await request(BASE_URL, `/api/project/${encodeURIComponent(CHAT_ID)}`);
    if (status !== 401) throw new Error(`expected 401, got ${status}`);
  });

  // Negative: chat mismatch
  await t('GET /project chat mismatch is 403', async () => {
    const initData = makeInitData();
    // change last digit but keep negative
    const mism = CHAT_ID.replace(/(\d)$/,(m, d)=> ((Number(d)+1)%10));
    const { status } = await request(BASE_URL, `/api/project/${encodeURIComponent(mism)}`, initData);
    if (status !== 403 && status !== 400) throw new Error(`expected 403/400, got ${status}`);
  });

  // Negative: expired
  await t('GET /project expired is 401', async () => {
    const old = Math.floor(Date.now() / 1000) - 2 * 86400;
    const initData = makeInitData(old);
    const { status } = await request(BASE_URL, `/api/project/${encodeURIComponent(CHAT_ID)}`, initData);
    if (status !== 401) throw new Error(`expected 401, got ${status}`);
  });

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();

