// Analytics service for admin dashboard
// Provides metrics: DAU, MAU, total users, events, etc.

import db, { isPostgres } from '../../database/db.js';

/**
 * Helper to execute query with proper DB handling
 */
async function queryOne(query, params = []) {
  // db.get already handles both PostgreSQL and SQLite
  return await db.get(query, params);
}

async function queryAll(query, params = []) {
  // db.all already handles both PostgreSQL and SQLite
  return await db.all(query, params);
}

/**
 * Get Daily Active Users (DAU) for a specific date
 */
export async function getDailyActiveUsers(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE timestamp >= ? AND timestamp <= ?
      AND user_id IS NOT NULL
  `;

  const result = await queryOne(query, [startOfDay.toISOString(), endOfDay.toISOString()]);
  return parseInt(result?.count || 0);
}

/**
 * Get Monthly Active Users (MAU) for a specific month
 */
export async function getMonthlyActiveUsers(year, month) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const query = `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE timestamp >= ? AND timestamp <= ?
      AND user_id IS NOT NULL
  `;

  const result = await queryOne(query, [startOfMonth.toISOString(), endOfMonth.toISOString()]);
  return parseInt(result?.count || 0);
}

/**
 * Get DAU/MAU for a date range
 */
export async function getDauMauRange(startDate, endDate) {
  const query = isPostgres
    ? `
      SELECT
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as dau
      FROM analytics_events
      WHERE timestamp >= $1 AND timestamp <= $2
        AND user_id IS NOT NULL
      GROUP BY DATE(timestamp)
      ORDER BY date
    `
    : `
      SELECT
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as dau
      FROM analytics_events
      WHERE timestamp >= ? AND timestamp <= ?
        AND user_id IS NOT NULL
      GROUP BY DATE(timestamp)
      ORDER BY date
    `;

  const rows = await queryAll(query, [startDate, endDate]);
  return rows.map(row => ({
    date: row.date,
    dau: parseInt(row.dau)
  }));
}

/**
 * Get total unique users count
 */
export async function getTotalUsers() {
  const query = `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE user_id IS NOT NULL
  `;

  const result = await queryOne(query);
  return parseInt(result?.count || 0);
}

/**
 * Get total events count
 */
export async function getTotalEvents() {
  const query = `SELECT COUNT(*) as count FROM analytics_events`;
  const result = await queryOne(query);
  return parseInt(result?.count || 0);
}

/**
 * Get total projects count (from main database)
 */
export async function getTotalProjects() {
  const query = `SELECT COUNT(*) as count FROM projects`;
  const result = await queryOne(query);
  return parseInt(result?.count || 0);
}

/**
 * Get event breakdown by event name
 */
export async function getEventBreakdown(startDate, endDate) {
  const query = `
    SELECT
      event_name,
      COUNT(*) as count
    FROM analytics_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY event_name
    ORDER BY count DESC
  `;

  const rows = await queryAll(query, [startDate, endDate]);
  return rows.map(row => ({
    event_name: row.event_name,
    count: parseInt(row.count)
  }));
}

/**
 * Get top active users
 */
export async function getTopActiveUsers(limit = 10, startDate, endDate) {
  const query = `
    SELECT
      user_id,
      COUNT(*) as event_count,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen
    FROM analytics_events
    WHERE user_id IS NOT NULL
      AND timestamp >= ? AND timestamp <= ?
    GROUP BY user_id
    ORDER BY event_count DESC
    LIMIT ?
  `;

  const rows = await queryAll(query, [startDate, endDate, limit]);
  return rows.map(row => ({
    ...row,
    event_count: parseInt(row.event_count)
  }));
}

/**
 * Get user retention data
 * Returns array of cohorts with retention rates
 */
export async function getUserRetention(cohortDate) {
  const cohortStart = new Date(cohortDate);
  cohortStart.setHours(0, 0, 0, 0);

  const cohortEnd = new Date(cohortDate);
  cohortEnd.setHours(23, 59, 59, 999);

  // Get users who first appeared on cohort date
  const cohortUsersQuery = `
    SELECT DISTINCT user_id
    FROM analytics_events
    WHERE timestamp >= ? AND timestamp <= ?
      AND user_id IS NOT NULL
  `;

  const cohortUsers = await queryAll(cohortUsersQuery, [
    cohortStart.toISOString(),
    cohortEnd.toISOString()
  ]);

  if (cohortUsers.length === 0) {
    return { cohortSize: 0, retention: [] };
  }

  const userIds = cohortUsers.map(u => u.user_id);

  // Check retention for next 7 days
  const retention = [];
  for (let day = 1; day <= 7; day++) {
    const checkDate = new Date(cohortStart);
    checkDate.setDate(checkDate.getDate() + day);

    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Use ANY for PostgreSQL, IN for SQLite
    const retentionQuery = isPostgres
      ? `
        SELECT COUNT(DISTINCT user_id) as count
        FROM analytics_events
        WHERE user_id = ANY($1)
          AND timestamp >= $2 AND timestamp < $3
      `
      : `
        SELECT COUNT(DISTINCT user_id) as count
        FROM analytics_events
        WHERE user_id IN (${userIds.map(() => '?').join(',')})
          AND timestamp >= ? AND timestamp < ?
      `;

    const params = isPostgres
      ? [userIds, checkDate.toISOString(), nextDay.toISOString()]
      : [...userIds, checkDate.toISOString(), nextDay.toISOString()];

    const result = await queryOne(retentionQuery, params);

    retention.push({
      day,
      retained: parseInt(result?.count || 0),
      rate: ((parseInt(result?.count || 0) / cohortUsers.length) * 100).toFixed(2)
    });
  }

  return {
    cohortSize: cohortUsers.length,
    cohortDate: cohortDate,
    retention
  };
}

/**
 * Get hourly activity distribution
 */
export async function getHourlyActivity(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = isPostgres
    ? `
      SELECT
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as count
      FROM analytics_events
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `
    : `
      SELECT
        CAST(strftime('%H', timestamp) AS INTEGER) as hour,
        COUNT(*) as count
      FROM analytics_events
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY hour
      ORDER BY hour
    `;

  const rows = await queryAll(query, [startOfDay.toISOString(), endOfDay.toISOString()]);

  // Fill missing hours with 0
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  rows.forEach(row => {
    hourlyData[parseInt(row.hour)] = {
      hour: parseInt(row.hour),
      count: parseInt(row.count)
    };
  });

  return hourlyData;
}

/**
 * Get user activity timeline
 */
export async function getUserActivity(userId, limit = 50) {
  const query = `
    SELECT
      id,
      event_name,
      properties,
      timestamp
    FROM analytics_events
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  const rows = await queryAll(query, [userId, limit]);
  return rows.map(row => ({
    ...row,
    properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties
  }));
}

/**
 * Get overview stats (for dashboard main page)
 */
export async function getOverviewStats(startDate, endDate) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [
    totalUsers,
    totalEvents,
    totalProjects,
    dau,
    mau,
    eventBreakdown
  ] = await Promise.all([
    getTotalUsers(),
    getTotalEvents(),
    getTotalProjects(),
    getDailyActiveUsers(today),
    getMonthlyActiveUsers(currentYear, currentMonth),
    getEventBreakdown(startDate, endDate)
  ]);

  return {
    totalUsers,
    totalEvents,
    totalProjects,
    dau,
    mau,
    eventBreakdown,
    dateRange: { startDate, endDate }
  };
}

export default {
  getDailyActiveUsers,
  getMonthlyActiveUsers,
  getDauMauRange,
  getTotalUsers,
  getTotalEvents,
  getTotalProjects,
  getEventBreakdown,
  getTopActiveUsers,
  getUserRetention,
  getHourlyActivity,
  getUserActivity,
  getOverviewStats
};
