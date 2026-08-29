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
} from '../../services/notifications/notificationStore.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/native/notifications
 * The caller's own inbox, newest first, with the unread count.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const notifications = await listNotifications(req.userId, { limit, offset });
    const unreadCount = await countUnread(req.userId);

    res.json({ notifications, unreadCount });
  } catch (err) {
    logger.error('[Notifications] List failed:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/**
 * GET /api/native/notifications/unread-count
 * Just the number — what the badge is set from on app foreground.
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    res.json({ unreadCount: await countUnread(req.userId) });
  } catch (err) {
    logger.error('[Notifications] Unread count failed:', err);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

/**
 * POST /api/native/notifications/read
 * Body: { ids: number[] } to mark those, or {} for the whole inbox.
 * Answers with the unread count that remains, so the client can set the badge
 * without a second round trip.
 */
router.post('/read', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body || {};

    if (ids !== undefined && !Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }

    const unreadCount = await markRead(req.userId, ids);
    res.json({ success: true, unreadCount });
  } catch (err) {
    logger.error('[Notifications] Mark read failed:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

/**
 * DELETE /api/native/notifications/:id
 * One notification, the caller's own.
 */
router.delete('/:id', requireAuth, async (req, res) => {
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
});

/**
 * DELETE /api/native/notifications
 * Empties the caller's inbox. Irreversible, and the app asks first.
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { deleted, unreadCount } = await deleteNotifications(req.userId);
    res.json({ success: true, deleted, unreadCount });
  } catch (err) {
    logger.error('[Notifications] Delete all failed:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;
