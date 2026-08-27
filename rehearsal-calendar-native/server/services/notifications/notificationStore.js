/**
 * The record of what was sent to whom.
 *
 * Until this existed, a push left almost no trace: native_push_reminders noted
 * that a reminder had been *issued* for a rehearsal, and everything else — new
 * rehearsals, invitations, role changes — vanished the moment Expo accepted it.
 * There was nowhere in the app to re-read a notification, no way to tell
 * afterwards whether a fan-out had happened, and the badge was a constant 1
 * because nothing could count what was unread.
 *
 * A row is written for every intended recipient, including those with no device
 * registered: the point is the inbox, not the delivery.
 */

import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';

/**
 * Store one notification per recipient.
 *
 * @param {number[]} userIds - intended recipients
 * @param {{title: string, body: string, data: object}} notification
 * @returns {Promise<Map<number, number>>} recipient → the row written for them,
 *   so the push can carry its own id and a tap can mark exactly that one read.
 */
export async function recordNotifications(userIds, notification) {
  const written = new Map();
  if (!userIds || userIds.length === 0) return written;

  const { title, body, data = {} } = notification;
  const now = new Date().toISOString();

  // related_type/related_id let a row point back at what it was about, so the
  // inbox can open the same thing a tap on the push would have.
  const relatedType = data.rehearsalId ? 'rehearsal' : data.projectId ? 'project' : null;
  const relatedId = data.rehearsalId ?? data.projectId ?? null;

  for (const userId of userIds) {
    try {
      const row = await db.get(
        `INSERT INTO native_notifications
           (user_id, type, title, body, data, related_type, related_id, sent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          userId,
          data.type || 'unknown',
          title,
          body,
          JSON.stringify(data),
          relatedType,
          relatedId ? Number(relatedId) : null,
          now,
          now,
        ]
      );
      if (row?.id) written.set(Number(userId), Number(row.id));
    } catch (err) {
      // One bad row must not cost the others their notification, and it must
      // certainly not stop the push from going out.
      logger.error(`[Notifications] Could not record for user ${userId}:`, err);
    }
  }

  return written;
}

/**
 * How many unread each of these users has.
 * @returns {Promise<Map<number, number>>}
 */
export async function getUnreadCounts(userIds) {
  if (!userIds || userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => '?').join(',');
  try {
    const rows = await db.all(
      `SELECT user_id, COUNT(*) AS unread
       FROM native_notifications
       WHERE user_id IN (${placeholders}) AND read_at IS NULL
       GROUP BY user_id`,
      userIds
    );
    return new Map(rows.map((r) => [Number(r.user_id), Number(r.unread)]));
  } catch (err) {
    logger.error('[Notifications] Could not count unread:', err);
    return new Map();
  }
}

/**
 * One user's inbox, newest first.
 */
export async function listNotifications(userId, { limit = 50, offset = 0 } = {}) {
  const rows = await db.all(
    `SELECT id, type, title, body, data, related_type, related_id, read_at, created_at
     FROM native_notifications
     WHERE user_id = ?
     -- id breaks the tie: a fan-out writes several rows inside the same
     -- millisecond, and on created_at alone their order is arbitrary.
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [userId, Math.min(Number(limit) || 50, 100), Number(offset) || 0]
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    // SQLite hands back the JSON as text; PostgreSQL has already parsed it.
    data: typeof r.data === 'string' ? safeParse(r.data) : r.data || {},
    relatedType: r.related_type,
    relatedId: r.related_id,
    read: r.read_at !== null,
    createdAt: r.created_at,
  }));
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function countUnread(userId) {
  const row = await db.get(
    'SELECT COUNT(*) AS unread FROM native_notifications WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return Number(row?.unread) || 0;
}

/**
 * Mark notifications read. Without ids, marks the user's whole inbox.
 *
 * Scoped to the user in the WHERE clause rather than checked first — the id
 * comes from the client, and a check-then-update would be one more place to
 * forget the ownership test.
 *
 * @returns {Promise<number>} the unread count that remains
 */
export async function markRead(userId, ids = null) {
  const now = new Date().toISOString();

  if (Array.isArray(ids) && ids.length > 0) {
    const numeric = ids.map(Number).filter((n) => Number.isInteger(n));
    if (numeric.length === 0) return countUnread(userId);

    const placeholders = numeric.map(() => '?').join(',');
    await db.run(
      `UPDATE native_notifications SET read_at = ?
       WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders})`,
      [now, userId, ...numeric]
    );
  } else {
    await db.run(
      'UPDATE native_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
      [now, userId]
    );
  }

  return countUnread(userId);
}
