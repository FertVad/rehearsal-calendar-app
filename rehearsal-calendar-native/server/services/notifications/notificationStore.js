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
 * @param {{executor?: object}} options - a caller's transaction, if the rows
 *   belong to it: then a failed row fails the whole send, since the caller
 *   undoes it and tries again rather than send half-recorded.
 * @returns {Promise<Map<number, number>>} recipient → the row written for them,
 *   so the push can carry its own id and a tap can mark exactly that one read.
 */
export async function recordNotifications(userIds, notification, { executor = db } = {}) {
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
      const row = await executor.get(
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
      // Inside a caller's transaction the statement has failed the whole of
      // it, on PostgreSQL at least: say so rather than send on a dead one.
      if (executor !== db) throw err;
      // Otherwise one bad row must not cost the others their notification, and
      // it must certainly not stop the push from going out.
      logger.error(`[Notifications] Could not record for user ${userId}:`, err);
    }
  }

  return written;
}

/**
 * How many unread each of these users has.
 *
 * Throws when it cannot count: an empty map would read as "none unread"
 * (CLAUDE.md 10).
 * @returns {Promise<Map<number, number>>}
 */
export async function getUnreadCounts(userIds, executor = db) {
  if (!userIds || userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => '?').join(',');
  const rows = await executor.all(
    `SELECT user_id, COUNT(*) AS unread
     FROM native_notifications
     WHERE user_id IN (${placeholders}) AND read_at IS NULL
     GROUP BY user_id`,
    userIds
  );
  return new Map(rows.map((r) => [Number(r.user_id), Number(r.unread)]));
}

export const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Where a page ended: the last row's place in the order, `<created_at ISO>~<id>`. */
const cursorOf = (row) => `${new Date(row.created_at).toISOString()}~${row.id}`;

/**
 * The place a cursor names, or null if this store did not issue it.
 * @returns {{createdAt: string, id: number} | null}
 */
export function parseCursor(cursor) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)~(\d+)$/.exec(String(cursor));
  if (!match || Number.isNaN(Date.parse(match[1]))) return null;
  const id = Number(match[2]);
  return Number.isSafeInteger(id) ? { createdAt: match[1], id } : null;
}

/**
 * One page of a user's inbox, newest first, and where the next one begins.
 *
 * Paged by the place the last row holds in the order, not by an offset (cause
 * fix 21: NI01): a notification arriving or deleted between two pages moved an
 * offset's rows by one, and the next page repeated a row or skipped one.
 *
 * @param {{limit?: number, cursor?: {createdAt: string, id: number} | null}} options
 *   `cursor` from parseCursor: the page begins after it.
 * @returns {Promise<{notifications: object[], nextCursor: string | null}>}
 *   nextCursor is null when this page holds the oldest.
 */
export async function listNotifications(userId, { limit = PAGE_SIZE, cursor = null } = {}) {
  const size = Math.min(Math.max(Math.trunc(Number(limit)) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const after = cursor
    ? 'AND (created_at < ? OR (created_at = ? AND id < ?))'
    : '';
  const rows = await db.all(
    `SELECT id, type, title, body, data, related_type, related_id, read_at, created_at
     FROM native_notifications
     WHERE user_id = ? ${after}
     -- id breaks the tie: a fan-out writes several rows inside the same
     -- millisecond, and on created_at alone their order is arbitrary.
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    // One more than the page: whether it is there says whether there is more.
    [userId, ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []), size + 1]
  );

  const page = rows.slice(0, size);
  return {
    notifications: page.map(toNotification),
    nextCursor: rows.length > size ? cursorOf(page[page.length - 1]) : null,
  };
}

function toNotification(r) {
  return {
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
  };
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
 * What a change covers: the ids named, or — asked for by name — the whole inbox
 * (cause fix 21: NI06). A list is a list, and an empty one covers nothing: it
 * used to fall through to "everything", so filtering a selection down to none
 * marked or deleted the lot.
 *
 * @param {number[] | 'all'} scope
 * @returns {{sql: string, params: number[]} | null} the condition to add, or
 *   null for a list that names nothing.
 */
function scopeOf(scope) {
  if (scope === 'all') return { sql: '', params: [] };
  if (!Array.isArray(scope)) {
    throw new TypeError("A change covers a list of ids or 'all'");
  }
  const numeric = scope.map(Number).filter((n) => Number.isSafeInteger(n));
  if (numeric.length === 0) return null;
  return { sql: `AND id IN (${numeric.map(() => '?').join(',')})`, params: numeric };
}

/**
 * Delete notifications: the ids given, or `'all'` to empty the user's inbox.
 *
 * Scoped to the user in the WHERE clause rather than checked first — the ids
 * come from the client, and a check-then-delete would be one more place to
 * forget the ownership test.
 *
 * Deleting an unread one lowers the count, which is why this answers with what
 * remains: the client sets bell and badge from it without asking again.
 *
 * @param {number[] | 'all'} scope
 * @returns {Promise<{deleted: number, unreadCount: number}>}
 */
export async function deleteNotifications(userId, scope) {
  const where = scopeOf(scope);
  if (!where) return { deleted: 0, unreadCount: await countUnread(userId) };

  const rows = await db.all(
    `DELETE FROM native_notifications WHERE user_id = ? ${where.sql} RETURNING id`,
    [userId, ...where.params]
  );

  return { deleted: rows.length, unreadCount: await countUnread(userId) };
}

/**
 * Mark notifications read: the ids given, or `'all'` for the user's whole inbox.
 *
 * Scoped to the user in the WHERE clause rather than checked first — the id
 * comes from the client, and a check-then-update would be one more place to
 * forget the ownership test.
 *
 * @param {number[] | 'all'} scope
 * @returns {Promise<number>} the unread count that remains
 */
export async function markRead(userId, scope) {
  const where = scopeOf(scope);
  if (!where) return countUnread(userId);

  await db.run(
    `UPDATE native_notifications SET read_at = ?
     WHERE user_id = ? AND read_at IS NULL ${where.sql}`,
    [new Date().toISOString(), userId, ...where.params]
  );

  return countUnread(userId);
}
