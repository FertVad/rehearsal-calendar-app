const NOTIFY_THROTTLE_MS = Number(process.env.NOTIFY_THROTTLE_MS) || 3000;

const stamps = new Map();

export function shouldNotify(type, chatId, rehearsalId) {
  const key = `${type}:${chatId}:${rehearsalId}`;
  const now = Date.now();
  const last = stamps.get(key);
  if (last && now - last < NOTIFY_THROTTLE_MS) {
    return false;
  }
  stamps.set(key, now);
  setTimeout(() => {
    if (stamps.get(key) === now) stamps.delete(key);
  }, NOTIFY_THROTTLE_MS);
  return true;
}

export { NOTIFY_THROTTLE_MS };
