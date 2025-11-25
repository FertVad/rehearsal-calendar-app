export async function ensureWebhook(bot, url) {
  if (globalThis.__tgWebhookSet) return;
  const finalUrl = url || process.env.WEBHOOK_URL;
  if (!finalUrl) return;

  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await bot.telegram.getWebhookInfo();
      if (info.url !== finalUrl) {
        await bot.telegram.setWebhook(finalUrl, {
          allowed_updates: ['chat_member', 'my_chat_member', 'message'],
        });
        console.log('[Bot] Webhook set successfully:', finalUrl);
      } else {
        console.log('[Bot] Webhook already configured:', finalUrl);
      }
      globalThis.__tgWebhookSet = true;
      return; // Success, exit
    } catch (err) {
      const code = err?.statusCode || err?.code;
      const message = err?.message || String(err);
      const isNetworkError = code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';

      if (code === 429 || code === 409 || message.includes('Too Many Requests')) {
        console.warn('[Bot] setWebhook rate limit, will retry later');
        globalThis.__tgWebhookSet = true; // Don't retry on rate limit
        return;
      }

      if (isNetworkError && attempt < maxRetries) {
        console.warn(`[Bot] Network error on attempt ${attempt}/${maxRetries}, retrying in ${retryDelay}ms...`, message);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue; // Retry
      }

      // Final attempt failed or non-retryable error
      console.error('[Bot] ensureWebhook failed after retries:', err);
      if (!isNetworkError) {
        globalThis.__tgWebhookSet = true; // Don't retry on non-network errors
      }
    }
  }
}
