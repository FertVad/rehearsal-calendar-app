// Utility to generate Telegram WebApp initData suitable for server-side verification
// Usage (env vars): TELEGRAM_BOT_TOKEN, and provide userId, chatId, authDate
// Example:
//   node server/scripts/generateInitData.js --user 123 --chat -100123 --token $TELEGRAM_BOT_TOKEN

import crypto from 'crypto';

function hmacSha256Hex(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function deriveSecretKey(botToken) {
  // Per Telegram docs: secret = HMAC_SHA256(botToken) with key 'WebAppData'
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
}

function buildInitData({ userId, chatId, authDate = Math.floor(Date.now() / 1000), username, first_name, last_name }) {
  const user = { id: Number(userId) };
  if (username) user.username = String(username);
  if (first_name) user.first_name = String(first_name);
  if (last_name) user.last_name = String(last_name);
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
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) params.set(k, v);
  params.set('hash', hash);
  return params.toString();
}

function main() {
  const args = process.argv.slice(2);
  const get = flag => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const userId = get('--user') || process.env.TEST_USER_ID;
  const chatId = get('--chat') || process.env.TEST_CHAT_ID;
  const authDate = get('--auth') ? Number(get('--auth')) : undefined;
  const token = get('--token') || process.env.TELEGRAM_BOT_TOKEN;
  if (!userId || !chatId || !token) {
    console.error('Usage: --user <id> --chat <id> [--auth <unix_ts>] --token <bot_token>');
    process.exit(2);
  }
  const { entries, dataCheckString } = buildInitData({ userId, chatId, authDate });
  const secret = deriveSecretKey(token);
  const hash = hmacSha256Hex(dataCheckString, secret);
  const query = toQuery(entries, hash);
  console.log(query);
}

main();

