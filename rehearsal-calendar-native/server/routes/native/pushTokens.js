/**
 * Push Tokens Routes
 * Endpoints for registering and managing push notification tokens
 */

import express from 'express';
import { Expo } from 'expo-server-sdk';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * POST /api/native/push-tokens
 * Register or update a push notification token
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceToken, deviceType, deviceName } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    // Validate token format
    if (!Expo.isExpoPushToken(deviceToken)) {
      return res.status(400).json({ error: 'Invalid Expo push token format' });
    }

    const now = new Date().toISOString();

    // One upsert rather than SELECT-then-INSERT.
    //
    // Registration is triggered from more than one place — app start, the
    // profile toggle, the onboarding screen — and two of them can overlap. Both
    // requests then found no row, both inserted, and the second hit the unique
    // index on (user_id, device_token) and came back as a 500 to a user who had
    // done nothing wrong. Which is exactly what happened on 2026-08-26.
    await db.run(
      `INSERT INTO native_push_tokens (user_id, device_token, device_type, device_name, last_active_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, device_token)
       DO UPDATE SET last_active_at = EXCLUDED.last_active_at,
                     updated_at = EXCLUDED.updated_at,
                     device_type = EXCLUDED.device_type,
                     device_name = EXCLUDED.device_name`,
      [userId, deviceToken, deviceType, deviceName, now, now, now]
    );

    logger.info(`[PushToken] Registered token for user ${userId}`);

    res.json({ success: true });
  } catch (err) {
    logger.error('[PushToken] Registration error:', err);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * DELETE /api/native/push-tokens
 * Unregister a push notification token (logout)
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    await db.run(
      'DELETE FROM native_push_tokens WHERE user_id = ? AND device_token = ?',
      [userId, deviceToken]
    );

    logger.info(`[PushToken] Unregistered token for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[PushToken] Unregister error:', err);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

/**
 * GET /api/native/push-tokens
 * Get all push tokens for current user (debug)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const tokens = await db.all(
      'SELECT id, device_type, device_name, last_active_at, created_at FROM native_push_tokens WHERE user_id = ?',
      [userId]
    );

    res.json({ success: true, data: tokens });
  } catch (err) {
    logger.error('[PushToken] Get tokens error:', err);
    res.status(500).json({ error: 'Failed to get push tokens' });
  }
});

export default router;
