import { asyncHandler } from '../../middleware/asyncHandler.js';
/**
 * Push Tokens Routes
 * Endpoints for registering and managing push notification tokens
 */

import express from 'express';
import { Expo } from 'expo-server-sdk';
import db from '../../database/db.js';
import { requireAuth, lockSession, SESSION_REVOKED } from '../../middleware/jwtMiddleware.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * POST /api/native/push-tokens
 * Register or update a push notification token
 */
router.post('/', requireAuth, asyncHandler(async (req, res) => {
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

    // A device token identifies a phone, and only one person is signed in on it.
    //
    // A clean Log out does take the token away, but a session can end without
    // the client ever reaching DELETE /push-tokens: signing out on a second
    // device bumps `token_version` for the whole account and silently
    // invalidates this one, a refresh can fail, and signing out with no network
    // swallows the error and proceeds. The old row survives all three.
    //
    // So registering moves the token to whoever registers it, or the previous
    // owner's pushes — project names, rehearsal titles, members' names — keep
    // landing on a lock screen that is now someone else's.
    //
    // The token is unique on its own (migration 013, G01), and this is one
    // upsert on it. A delete of the other holders followed by an upsert on
    // (user_id, device_token) did the same one request at a time, but two at
    // once — an account switch with the previous session's late registration
    // still in flight — each deleted before the other had inserted, and both
    // rows stayed. Now the later request waits for the earlier one's row and
    // takes it; overlapping registrations by the same person (app start, the
    // profile toggle, onboarding — a 500 on 2026-08-26) land on the same row.
    //
    // The write and the session check share one transaction. A session
    // revoked while this request waited — the owner's Google or Apple sign-in
    // taking the account back — registers nothing: the device would keep
    // receiving the account's notifications (review R3-12).
    const registered = await db.transaction(async (tx) => {
      if (!(await lockSession(tx, req))) return false;
      await tx.run(
        `INSERT INTO native_push_tokens (user_id, device_token, device_type, device_name, last_active_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (device_token)
         DO UPDATE SET user_id = EXCLUDED.user_id,
                       last_active_at = EXCLUDED.last_active_at,
                       updated_at = EXCLUDED.updated_at,
                       device_type = EXCLUDED.device_type,
                       device_name = EXCLUDED.device_name`,
        [userId, deviceToken, deviceType, deviceName, now, now, now]
      );
      return true;
    });
    if (!registered) return res.status(401).json(SESSION_REVOKED);

    logger.info(`[PushToken] Registered token for user ${userId}`);

    res.json({ success: true });
  } catch (err) {
    logger.error('[PushToken] Registration error:', err);
    res.status(500).json({ error: 'Failed to register push token' });
  }
}));

/**
 * DELETE /api/native/push-tokens
 * Unregister a push notification token (logout)
 */
router.delete('/', requireAuth, asyncHandler(async (req, res) => {
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
}));

/**
 * GET /api/native/push-tokens
 * Get all push tokens for current user (debug)
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
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
}));

export default router;
