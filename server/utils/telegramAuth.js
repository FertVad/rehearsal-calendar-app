import crypto from 'crypto';

function hmacSha256Hex(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function parseInitData(raw) {
  const params = new URLSearchParams(raw || '');
  const obj = {};
  for (const [k, v] of params.entries()) {
    obj[k] = v;
  }
  return obj;
}

function buildDataCheckString(entries) {
  const items = Object.keys(entries)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${entries[k]}`);
  return items.join('\n');
}

function parseJsonFieldMaybe(value) {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function extractChatId(entries) {
  // prefer chat.id from JSON field "chat"
  const chatRaw = entries.chat;
  const startParam = entries.start_param || entries.startparam;
  if (chatRaw) {
    const chat = parseJsonFieldMaybe(chatRaw);
    const id = chat?.id;
    if (typeof id === 'number') return String(id);
  }
  // fallback: start_param might contain chat_-100... or -100...
  if (startParam) {
    const s = String(startParam);
    const m = s.match(/(^|\b)chat_(-?\d+)/) || s.match(/(^|\b)(-?\d+)/);
    if (m && m[2]) return String(Number(m[2]));
  }
  return null;
}

export function verifyTelegramInitData(rawInitData, botToken, options = {}) {
  const { maxAgeSec = 24 * 60 * 60 } = options;
  if (!rawInitData || !botToken) {
    return { ok: false, error: 'missing_init_or_token' };
  }
  const entries = parseInitData(rawInitData);
  const theirHash = entries.hash || '';
  if (!theirHash) return { ok: false, error: 'missing_hash' };

  const dataCheckString = buildDataCheckString(entries);
  // Per Telegram WebApp docs: secret key = HMAC_SHA256 of botToken using 'WebAppData' as key
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = hmacSha256Hex(dataCheckString, secretKey);
  if (expected !== theirHash) {
    return { ok: false, error: 'bad_signature' };
  }

  // Validate auth_date
  const authDate = Number(entries.auth_date || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: 'bad_auth_date' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > maxAgeSec) {
    return { ok: false, error: 'expired' };
  }

  // Extract user and chat
  const user = parseJsonFieldMaybe(entries.user) || {};
  const userId = user?.id;
  const chatId = extractChatId(entries);

  if (!userId) return { ok: false, error: 'missing_user' };

  return {
    ok: true,
    user: { id: String(userId), first_name: user.first_name, last_name: user.last_name, username: user.username },
    chatId: chatId ? String(chatId) : null,
    authDate,
    entries,
  };
}

export function normalizeGroupChatIdStrict(id) {
  if (id == null) return null;
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  // Telegram group/supergroup chat id is negative
  return String(-Math.abs(n));
}

/**
 * Verify Telegram Login Widget data
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidget(data, botToken) {
  const { hash, ...userData } = data;

  if (!hash || !botToken) {
    return { ok: false, error: 'missing_hash_or_token' };
  }

  // Create data-check-string
  const dataCheckArr = Object.keys(userData)
    .filter(key => userData[key] !== undefined && userData[key] !== null)
    .sort()
    .map(key => `${key}=${userData[key]}`);

  const dataCheckString = dataCheckArr.join('\n');

  // Create secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Compare hashes
  if (calculatedHash !== hash) {
    return { ok: false, error: 'bad_signature' };
  }

  // Check auth_date freshness (default: 24 hours)
  const authDate = Number(data.auth_date || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: 'bad_auth_date' };
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAge = 86400; // 24 hours
  if ((now - authDate) > maxAge) {
    return { ok: false, error: 'expired' };
  }

  // Validate user ID
  if (!data.id) {
    return { ok: false, error: 'missing_id' };
  }

  return {
    ok: true,
    user: {
      id: String(data.id),
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      username: data.username || '',
      photo_url: data.photo_url || '',
    },
    authDate,
  };
}
