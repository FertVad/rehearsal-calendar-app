import { asyncHandler } from '../../middleware/asyncHandler.js';
/**
 * The user's notification inbox.
 *
 * A push is a single moment: miss it and there was nothing left to read. These
 * endpoints are the record — what was sent, what is still unread, and a way to
 * say it has been seen.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import {
  listNotifications,
  countUnread,
  markRead,
  deleteNotifications,
  parseCursor,
} from '../../services/notifications/notificationStore.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/native/notifications?limit=&cursor=
 * One page of the caller's own inbox, newest first, with the unread count of
 * the whole of it. `nextCursor` asks for the page after this one, and is null
 * on the last (cause fix 21: NI01). Without a cursor, the newest page.
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const after = cursor === undefined ? null : parseCursor(cursor);
    if (cursor !== undefined && !after) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }

    const { notifications, nextCursor } = await listNotifications(req.userId, { limit, cursor: after });
    const unreadCount = await countUnread(req.userId);

    res.json({ notifications, unreadCount, nextCursor });
  } catch (err) {
    logger.error('[Notifications] List failed:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}));

/**
 * GET /api/native/notifications/unread-count
 * Just the number — what the badge is set from on app foreground.
 */
router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  try {
    res.json({ unreadCount: await countUnread(req.userId) });
  } catch (err) {
    logger.error('[Notifications] Unread count failed:', err);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
}));

/**
 * What a POST /read body asks to mark: a list of ids, or 'all'. Null for a body
 * that says neither plainly.
 *
 * The whole inbox is asked for by name, `{ all: true }`, and a list — empty
 * too — covers only what it names (cause fix 21: NI06): `{ ids: [] }` used to
 * mark everything. `{}` still means the whole inbox, as the builds already on
 * phones send it for "Mark all read" — that body exactly: a list, or an object
 * with any other key (`[1]`, `{ id: 1 }`), names neither and is refused
 * (review), where it used to fall through to "all".
 */
function readScope(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length === 0) return 'all';
  if (keys.some((key) => key !== 'ids' && key !== 'all')) return null;
  const { ids, all } = body;
  if (all !== undefined) return all === true && ids === undefined ? 'all' : null;
  const valid = Array.isArray(ids) && ids.every((id) => Number.isSafeInteger(id) && id > 0);
  return valid ? ids : null;
}

/**
 * POST /api/native/notifications/read
 * Body: { ids: number[] } to mark those, or { all: true } for the whole inbox.
 * Answers with the unread count that remains, so the client can set the badge
 * without a second round trip.
 */
router.post('/read', requireAuth, asyncHandler(async (req, res) => {
  try {
    const scope = readScope(req.body);
    if (!scope) {
      return res.status(400).json({ error: 'Send ids as a list of notification ids, or all: true' });
    }

    const unreadCount = await markRead(req.userId, scope);
    res.json({ success: true, unreadCount });
  } catch (err) {
    logger.error('[Notifications] Mark read failed:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
}));

/**
 * DELETE /api/native/notifications/:id
 * One notification, the caller's own.
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const { deleted, unreadCount } = await deleteNotifications(req.userId, [id]);

    // Someone else's id deletes nothing. Answering 404 rather than success
    // keeps the client from believing it removed something it did not.
    if (deleted === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, unreadCount });
  } catch (err) {
    logger.error('[Notifications] Delete failed:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
}));

/**
 * DELETE /api/native/notifications
 * Empties the caller's inbox. Irreversible, and the app asks first.
 */
router.delete('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { deleted, unreadCount } = await deleteNotifications(req.userId, 'all');
    res.json({ success: true, deleted, unreadCount });
  } catch (err) {
    logger.error('[Notifications] Delete all failed:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
}));

export default router;
