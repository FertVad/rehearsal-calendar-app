import db, { isPostgres } from '../db.js';

// Helper for datetime
const now = () => isPostgres ? 'NOW()' : "datetime('now')";

/**
 * Native Availability model
 */

/**
 * Get user availability for date range
 */
export async function getByDateRange(userId, startDate, endDate) {
  return await db.all(
    `SELECT * FROM native_user_availability
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date, start_time`,
    [userId, startDate, endDate]
  );
}

/**
 * Get user availability for specific date
 */
export async function getByDate(userId, date) {
  return await db.all(
    `SELECT * FROM native_user_availability
     WHERE user_id = ? AND date = ?
     ORDER BY start_time`,
    [userId, date]
  );
}

/**
 * Set availability for a date (replaces existing)
 * type: 'available', 'busy', 'tentative'
 */
export async function setForDate(userId, date, type, slots = []) {
  // Delete existing availability for this date
  await db.run(
    'DELETE FROM native_user_availability WHERE user_id = ? AND date = ?',
    [userId, date]
  );

  // If type is 'busy', create one record with full day
  if (type === 'busy') {
    const row = await db.get(
      `INSERT INTO native_user_availability
       (user_id, date, start_time, end_time, type, source, created_at, updated_at)
       VALUES (?, ?, '00:00', '23:59', 'busy', 'manual', ${now()}, ${now()})
       RETURNING *`,
      [userId, date]
    );
    return [row];
  }

  // If type is 'available' with no slots, create full day available
  if (type === 'available' && slots.length === 0) {
    const row = await db.get(
      `INSERT INTO native_user_availability
       (user_id, date, start_time, end_time, type, source, created_at, updated_at)
       VALUES (?, ?, '00:00', '23:59', 'available', 'manual', ${now()}, ${now()})
       RETURNING *`,
      [userId, date]
    );
    return [row];
  }

  // Insert each slot
  const results = [];
  for (const slot of slots) {
    const row = await db.get(
      `INSERT INTO native_user_availability
       (user_id, date, start_time, end_time, type, source, title, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ${now()}, ${now()})
       RETURNING *`,
      [userId, date, slot.start, slot.end, type, slot.title || null, slot.notes || null]
    );
    results.push(row);
  }

  return results;
}

/**
 * Bulk set availability for multiple dates
 */
export async function bulkSet(userId, entries) {
  const results = [];

  for (const entry of entries) {
    const result = await setForDate(userId, entry.date, entry.type, entry.slots || []);
    results.push({ date: entry.date, records: result });
  }

  return results;
}

/**
 * Delete availability for specific date
 */
export async function deleteForDate(userId, date) {
  await db.run(
    'DELETE FROM native_user_availability WHERE user_id = ? AND date = ?',
    [userId, date]
  );
}

/**
 * Delete specific availability record by ID
 */
export async function deleteById(id, userId) {
  await db.run(
    'DELETE FROM native_user_availability WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

/**
 * Get all availability for user (for initial load)
 */
export async function getAllForUser(userId) {
  return await db.all(
    `SELECT * FROM native_user_availability
     WHERE user_id = ?
     ORDER BY date, start_time`,
    [userId]
  );
}
