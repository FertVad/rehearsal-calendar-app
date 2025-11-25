// Tracking service - записывает события в analytics_events
import db from '../../database/db.js';

/**
 * Записать событие в БД
 * @param {string} userId - Telegram user ID
 * @param {string} eventName - Название события
 * @param {object} properties - Дополнительные данные события
 * @returns {Promise<object>} Созданное событие
 */
async function trackEvent(userId, eventName, properties = {}) {
  if (!eventName) {
    throw new Error('Event name is required');
  }

  const timestamp = new Date().toISOString();

  try {
    const result = await db.run(
      `INSERT INTO analytics_events (user_id, event_name, properties, timestamp)
       VALUES (?, ?, ?, ?)`,
      [
        userId || null,
        eventName,
        JSON.stringify(properties),
        timestamp
      ]
    );

    return {
      id: result.lastID || result.rows?.[0]?.id,
      userId,
      eventName,
      properties,
      timestamp
    };
  } catch (error) {
    console.error('[Tracking] Failed to track event:', error);
    throw error;
  }
}

/**
 * Batch запись событий (оптимизация для множественных событий)
 * @param {Array} events - Массив событий [{userId, eventName, properties}]
 * @returns {Promise<number>} Количество записанных событий
 */
async function trackEventsBatch(events) {
  if (!events || events.length === 0) {
    return 0;
  }

  const timestamp = new Date().toISOString();
  let successCount = 0;

  for (const event of events) {
    try {
      await db.run(
        `INSERT INTO analytics_events (user_id, event_name, properties, timestamp)
         VALUES (?, ?, ?, ?)`,
        [
          event.userId || null,
          event.eventName,
          JSON.stringify(event.properties || {}),
          timestamp
        ]
      );
      successCount++;
    } catch (error) {
      console.error('[Tracking] Failed to track event in batch:', event.eventName, error);
      // Continue with other events
    }
  }

  return successCount;
}

/**
 * Получить последние события пользователя
 * @param {string} userId - Telegram user ID
 * @param {number} limit - Количество событий
 * @returns {Promise<Array>} События
 */
async function getUserEvents(userId, limit = 50) {
  try {
    const events = await db.all(
      `SELECT id, user_id, event_name, properties, timestamp
       FROM analytics_events
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [userId, limit]
    );

    return events.map(event => ({
      id: event.id,
      userId: event.user_id,
      eventName: event.event_name,
      properties: JSON.parse(event.properties || '{}'),
      timestamp: event.timestamp
    }));
  } catch (error) {
    console.error('[Tracking] Failed to get user events:', error);
    return [];
  }
}

/**
 * Удалить старые события (для очистки)
 * @param {number} daysOld - Удалить события старше N дней
 * @returns {Promise<number>} Количество удаленных событий
 */
async function deleteOldEvents(daysOld = 90) {
  try {
    const result = await db.run(
      `DELETE FROM analytics_events
       WHERE timestamp < datetime('now', '-${daysOld} days')`,
      []
    );

    return result.changes || result.rowCount || 0;
  } catch (error) {
    console.error('[Tracking] Failed to delete old events:', error);
    throw error;
  }
}

export default {
  trackEvent,
  trackEventsBatch,
  getUserEvents,
  deleteOldEvents
};
