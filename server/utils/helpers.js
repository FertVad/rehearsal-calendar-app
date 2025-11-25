// Utility functions extracted from server.js

/**
 * Нормализация chat_id для Telegram групповых чатов
 * Telegram группы всегда имеют отрицательные ID
 */
export function normalizeChatId(chatId) {
  // Development режим - не трогаем
  if (String(chatId).startsWith('dev-')) {
    return String(chatId);
  }

  const str = String(chatId);

  // Если уже отрицательный - возвращаем как есть
  if (str.startsWith('-')) {
    return str;
  }

  // Если положительный - делаем отрицательным для групповых чатов
  return '-' + str;
}

/**
 * Parse availability DB row into a normalized structure.
 * Reads the `time_ranges` JSON and always returns an array.
 */
export function parseAvailabilityRow(row) {
  try {
    const ranges = JSON.parse(row?.time_ranges || '[]');
    return { timeRanges: Array.isArray(ranges) ? ranges : [] };
  } catch {
    return { timeRanges: [] };
  }
}

// legacy dev-only conflict checker removed

/**
 * Middleware to authenticate Telegram WebApp user and check admin rights.
 */
// Note: legacy header-based auth middleware removed in favor of Telegram WebApp initData validation.
