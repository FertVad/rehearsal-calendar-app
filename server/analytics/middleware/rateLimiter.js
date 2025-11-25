// Simple rate limiter для tracking endpoint
// Защита от спама и DDoS

const requests = new Map(); // userId -> { count, resetTime }

const RATE_LIMIT = {
  maxRequests: 100,      // максимум запросов
  windowMs: 60 * 1000,   // за 1 минуту
};

/**
 * Rate limit middleware
 * @param {number} max - максимум запросов (default: 100)
 * @param {number} windowMs - временное окно в мс (default: 60000)
 */
function rateLimiter(max = RATE_LIMIT.maxRequests, windowMs = RATE_LIMIT.windowMs) {
  return (req, res, next) => {
    // Определяем ключ для лимита (userId или IP)
    const key = req.body?.userId || req.ip || 'anonymous';
    const now = Date.now();

    // Получаем или создаем запись
    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      // Создаем новую запись или сбрасываем старую
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      requests.set(key, record);
    }

    // Увеличиваем счетчик
    record.count++;

    // Проверяем лимит
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: `${retryAfter}s`
      });
    }

    // Добавляем заголовки
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - record.count);
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    next();
  };
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requests.entries()) {
    if (now > record.resetTime + 60000) { // +1 минута буфер
      requests.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default rateLimiter;
