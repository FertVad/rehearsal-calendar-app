/**
 * User Activity Analytics Queries
 *
 * Метрики:
 * - Зарегистрировано пользователей (всего)
 * - Активных пользователей (открывали за последние 7 дней)
 * - Неактивных пользователей (не открывали больше 30 дней)
 * - Отток (churn rate) - процент юзеров, которые были активны 30+ дней назад, но не активны последние 30 дней
 */

/**
 * Get total registered users
 */
export async function getTotalUsers(db) {
  const query = `SELECT COUNT(DISTINCT user_id) as total FROM analytics_events WHERE user_id IS NOT NULL`;
  const result = await db.get(query);
  return result?.total || 0;
}

/**
 * Get active users (opened app in last N days)
 */
export async function getActiveUsers(db, days = 7) {
  // Use parameterized query - db.get handles both PostgreSQL and SQLite
  const query = `
    SELECT COUNT(DISTINCT user_id) as active
    FROM analytics_events
    WHERE user_id IS NOT NULL
      AND event_name = 'app_opened'
      AND timestamp >= ?
  `;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const result = await db.get(query, [sinceDate.toISOString()]);
  return parseInt(result?.active || 0);
}

/**
 * Get inactive users (haven't opened app in last N days)
 */
export async function getInactiveUsers(db, inactiveDays = 30) {
  const query = `
    SELECT COUNT(DISTINCT user_id) as inactive
    FROM analytics_events
    WHERE user_id IS NOT NULL
      AND event_name = 'app_opened'
      AND user_id NOT IN (
        SELECT DISTINCT user_id
        FROM analytics_events
        WHERE event_name = 'app_opened'
          AND timestamp >= ?
      )
  `;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - inactiveDays);

  const result = await db.get(query, [sinceDate.toISOString()]);
  return parseInt(result?.inactive || 0);
}

/**
 * Calculate churn rate
 * Churn = users who were active 30-60 days ago but NOT active in last 30 days
 */
export async function getChurnRate(db) {
  const now = new Date();
  const date30DaysAgo = new Date(now);
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  const date60DaysAgo = new Date(now);
  date60DaysAgo.setDate(date60DaysAgo.getDate() - 60);

  // Users active 30-60 days ago
  const activeOldQuery = `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE user_id IS NOT NULL
      AND event_name = 'app_opened'
      AND timestamp >= ?
      AND timestamp < ?
  `;
  const activeOldResult = await db.get(activeOldQuery, [
    date60DaysAgo.toISOString(),
    date30DaysAgo.toISOString()
  ]);
  const activeOldCount = parseInt(activeOldResult?.count || 0);

  if (activeOldCount === 0) return 0;

  // Users who were active 30-60 days ago AND still active in last 30 days
  const retainedQuery = `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE user_id IS NOT NULL
      AND event_name = 'app_opened'
      AND timestamp >= ?
      AND timestamp < ?
      AND user_id IN (
        SELECT DISTINCT user_id
        FROM analytics_events
        WHERE event_name = 'app_opened'
          AND timestamp >= ?
      )
  `;
  const retainedResult = await db.get(retainedQuery, [
    date60DaysAgo.toISOString(),
    date30DaysAgo.toISOString(),
    date30DaysAgo.toISOString()
  ]);
  const retainedCount = parseInt(retainedResult?.count || 0);

  const churned = activeOldCount - retainedCount;
  const churnRate = (churned / activeOldCount) * 100;

  return Math.round(churnRate * 10) / 10; // Round to 1 decimal
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(db) {
  const [total, active7d, active30d, inactive, churn] = await Promise.all([
    getTotalUsers(db),
    getActiveUsers(db, 7),
    getActiveUsers(db, 30),
    getInactiveUsers(db, 30),
    getChurnRate(db),
  ]);

  return {
    total_users: total,
    active_7d: active7d,
    active_30d: active30d,
    inactive_30d: inactive,
    churn_rate: churn,
  };
}
