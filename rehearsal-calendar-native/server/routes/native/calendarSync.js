import { asyncHandler } from '../../middleware/asyncHandler.js';
/**
 * Calendar Sync API Routes
 * Manages calendar connections and event mappings in database
 */

import express from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

const MAX_DEVICE_CALENDARS = 100;

/**
 * The calendars a mapping delete names as the device's own (ES02).
 *
 * A connection is one calendar of one device, and calendar ids are the
 * device's own, so a device's mappings are the ones recorded under the
 * calendars it has. Deletes used to reach every connection of the person:
 * unsyncing on one phone took the other's mapping of the same rehearsal, and
 * "remove all exported" took all of them, leaving the other phone's events in
 * its calendar with nothing pointing at them.
 *
 * null when the body names none — an app from before this, which still deletes
 * across its connections as it always did.
 */
function deviceScope(body) {
  const ids = body?.deviceCalendarIds;
  if (ids === undefined) return null;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_DEVICE_CALENDARS
    || !ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 255)) {
    return undefined;
  }
  return [...new Set(ids)];
}

const scopeRefused = (res) => res.status(400).json({
  error: 'deviceCalendarIds must name this device\'s calendars',
  code: 'DEVICE_CALENDARS_INVALID',
});
const inList = (values, first) => values.map((_, i) => `$${i + first}`).join(', ');

/**
 * ============================================================================
 * Calendar Connections
 * ============================================================================
 */

/**
 * GET /api/native/calendar-sync/connections
 * Get user's calendar connections
 */
router.get('/connections', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;

    const connections = await db.all(
      `SELECT id, provider, device_calendar_id, device_calendar_name,
              sync_enabled, sync_direction, last_sync_at, created_at
       FROM native_calendar_connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ connections });
  } catch (error) {
    console.error('[CalendarSync] Get connections error:', error);
    res.status(500).json({ error: 'Failed to get calendar connections' });
  }
}));

/**
 * POST /api/native/calendar-sync/connections
 * Create or update calendar connection
 */
router.post('/connections', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const {
      provider,
      deviceCalendarId,
      deviceCalendarName,
      syncEnabled = true,
      syncDirection = 'both',
    } = req.body;

    // Validate
    if (!provider || !deviceCalendarId) {
      return res.status(400).json({
        error: 'provider and deviceCalendarId are required',
      });
    }

    // Check if connection already exists
    const existing = await db.get(
      `SELECT id FROM native_calendar_connections
       WHERE user_id = $1 AND device_calendar_id = $2`,
      [userId, deviceCalendarId]
    );

    let connectionId;

    if (existing) {
      // Update existing connection
      await db.run(
        `UPDATE native_calendar_connections
         SET provider = $1, device_calendar_name = $2,
             sync_enabled = $3, sync_direction = $4, updated_at = $5
         WHERE id = $6`,
        [provider, deviceCalendarName, syncEnabled, syncDirection, new Date().toISOString(), existing.id]
      );
      connectionId = existing.id;
    } else {
      // Create new connection
      const now = new Date().toISOString();
      const result = await db.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, provider, deviceCalendarId, deviceCalendarName, syncEnabled, syncDirection, now, now]
      );
      connectionId = result.lastInsertId;
    }

    // Fetch and return the connection
    const connection = await db.get(
      `SELECT id, provider, device_calendar_id, device_calendar_name,
              sync_enabled, sync_direction, last_sync_at, created_at
       FROM native_calendar_connections
       WHERE id = $1`,
      [connectionId]
    );

    res.json({ connection });
  } catch (error) {
    console.error('[CalendarSync] Create connection error:', error);
    res.status(500).json({ error: 'Failed to create calendar connection' });
  }
}));

/**
 * DELETE /api/native/calendar-sync/connections/:id
 * Delete calendar connection and all associated mappings
 */
router.delete('/connections/:id', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const connectionId = parseInt(req.params.id);

    // Verify ownership
    const connection = await db.get(
      'SELECT id FROM native_calendar_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Delete associated mappings first (CASCADE should handle this, but be explicit)
    await db.run(
      'DELETE FROM native_calendar_event_mappings WHERE connection_id = $1',
      [connectionId]
    );

    // Delete connection
    await db.run(
      'DELETE FROM native_calendar_connections WHERE id = $1',
      [connectionId]
    );

    res.json({ success: true, message: 'Connection deleted' });
  } catch (error) {
    console.error('[CalendarSync] Delete connection error:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
}));

/**
 * ============================================================================
 * Event Mappings
 * ============================================================================
 */

/**
 * GET /api/native/calendar-sync/mappings
 * Get all event mappings for user's connections
 */
router.get('/mappings', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { eventType } = req.query;

    let sql = `
      SELECT m.id, m.connection_id, m.event_type, m.internal_event_id,
             m.external_event_id, m.last_sync_direction, m.last_sync_at,
             c.device_calendar_id, c.provider
      FROM native_calendar_event_mappings m
      JOIN native_calendar_connections c ON m.connection_id = c.id
      WHERE c.user_id = $1
    `;

    const params = [userId];

    if (eventType) {
      sql += ' AND m.event_type = $2';
      params.push(eventType);
    }

    sql += ' ORDER BY m.last_sync_at DESC';

    const mappings = await db.all(sql, params);

    res.json({ mappings });
  } catch (error) {
    console.error('[CalendarSync] Get mappings error:', error);
    res.status(500).json({ error: 'Failed to get event mappings' });
  }
}));

/**
 * GET /api/native/calendar-sync/mappings/by-event/:eventType/:internalEventId
 * Get mapping for a specific internal event
 */
router.get('/mappings/by-event/:eventType/:internalEventId', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { eventType, internalEventId } = req.params;

    const mapping = await db.get(
      `SELECT m.id, m.connection_id, m.event_type, m.internal_event_id,
              m.external_event_id, m.last_sync_direction, m.last_sync_at,
              c.device_calendar_id, c.provider
       FROM native_calendar_event_mappings m
       JOIN native_calendar_connections c ON m.connection_id = c.id
       WHERE c.user_id = $1 AND m.event_type = $2 AND m.internal_event_id = $3`,
      [userId, eventType, parseInt(internalEventId)]
    );

    // Absence is the ordinary answer here, not an exception: every rehearsal
    // that has not been exported yet asks this and gets nothing back. Saying
    // so with 404 filled the logs with error-shaped lines for the commonest
    // path, and buried the real ones.
    res.json({ mapping: mapping || null });
  } catch (error) {
    console.error('[CalendarSync] Get mapping error:', error);
    res.status(500).json({ error: 'Failed to get mapping' });
  }
}));

/**
 * POST /api/native/calendar-sync/mappings
 * Create or update event mapping
 */
router.post('/mappings', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const {
      connectionId,
      eventType,
      internalEventId,
      externalEventId,
      syncDirection = 'export',
    } = req.body;

    // Validate
    if (!connectionId || !eventType || !internalEventId || !externalEventId) {
      return res.status(400).json({
        error: 'connectionId, eventType, internalEventId, and externalEventId are required',
      });
    }

    // Verify connection ownership
    const connection = await db.get(
      'SELECT id FROM native_calendar_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );

    if (!connection) {
      return res.status(403).json({ error: 'Connection not found or access denied' });
    }

    // Check if mapping already exists
    const existing = await db.get(
      `SELECT id FROM native_calendar_event_mappings
       WHERE connection_id = $1 AND event_type = $2 AND internal_event_id = $3`,
      [connectionId, eventType, internalEventId]
    );

    let mappingId;

    if (existing) {
      // Update existing mapping
      await db.run(
        `UPDATE native_calendar_event_mappings
         SET external_event_id = $1, last_sync_direction = $2, last_sync_at = $3
         WHERE id = $4`,
        [externalEventId, syncDirection, new Date().toISOString(), existing.id]
      );
      mappingId = existing.id;
    } else {
      // Create new mapping
      const result = await db.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [connectionId, eventType, internalEventId, externalEventId, syncDirection, new Date().toISOString()]
      );
      mappingId = result.lastInsertId;
    }

    // Fetch and return the mapping
    const mapping = await db.get(
      `SELECT m.id, m.connection_id, m.event_type, m.internal_event_id,
              m.external_event_id, m.last_sync_direction, m.last_sync_at,
              c.device_calendar_id, c.provider
       FROM native_calendar_event_mappings m
       JOIN native_calendar_connections c ON m.connection_id = c.id
       WHERE m.id = $1`,
      [mappingId]
    );

    res.json({ mapping });
  } catch (error) {
    console.error('[CalendarSync] Create mapping error:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}));

/**
 * DELETE /api/native/calendar-sync/mappings/:id
 * Delete specific mapping
 */
router.delete('/mappings/:id', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const mappingId = parseInt(req.params.id);

    // Verify ownership through connection
    const mapping = await db.get(
      `SELECT m.id
       FROM native_calendar_event_mappings m
       JOIN native_calendar_connections c ON m.connection_id = c.id
       WHERE m.id = $1 AND c.user_id = $2`,
      [mappingId, userId]
    );

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await db.run(
      'DELETE FROM native_calendar_event_mappings WHERE id = $1',
      [mappingId]
    );

    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('[CalendarSync] Delete mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}));

/**
 * DELETE /api/native/calendar-sync/mappings
 * Body: { eventType, deviceCalendarIds } — every mapping of that type recorded
 * under the calendars named, which are the device's own (see deviceScope).
 */
router.delete('/mappings', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { eventType } = req.body ?? {};
    const calendars = deviceScope(req.body);
    if (!calendars) return scopeRefused(res);
    if (typeof eventType !== 'string' || eventType.length === 0) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const result = await db.run(
      `DELETE FROM native_calendar_event_mappings
       WHERE id IN (
         SELECT m.id
         FROM native_calendar_event_mappings m
         JOIN native_calendar_connections c ON m.connection_id = c.id
         WHERE c.user_id = $1 AND m.event_type = $2 AND c.device_calendar_id IN (${inList(calendars, 3)})
       )`,
      [userId, eventType, ...calendars]
    );

    res.json({ success: true, deletedCount: result.changes || 0 });
  } catch (error) {
    console.error('[CalendarSync] Delete mappings error:', error);
    res.status(500).json({ error: 'Failed to delete mappings' });
  }
}));

/**
 * DELETE /api/native/calendar-sync/mappings/by-event/:eventType/:internalEventId
 * Delete mapping by internal event. Body: { deviceCalendarIds } — only the
 * mappings recorded under those calendars (see deviceScope).
 */
router.delete('/mappings/by-event/:eventType/:internalEventId', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { eventType, internalEventId } = req.params;
    const calendars = deviceScope(req.body);
    if (calendars === undefined) return scopeRefused(res);

    // Delete mappings (verify ownership through connection)
    const inScope = calendars ? ` AND c.device_calendar_id IN (${inList(calendars, 4)})` : '';
    await db.run(
      `DELETE FROM native_calendar_event_mappings
       WHERE id IN (
         SELECT m.id
         FROM native_calendar_event_mappings m
         JOIN native_calendar_connections c ON m.connection_id = c.id
         WHERE c.user_id = $1 AND m.event_type = $2 AND m.internal_event_id = $3${inScope}
       )`,
      [userId, eventType, parseInt(internalEventId), ...(calendars ?? [])]
    );

    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('[CalendarSync] Delete mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}));

/**
 * POST /api/native/calendar-sync/connections/:id/update-sync-time
 * Update last sync time for a connection
 */
router.post('/connections/:id/update-sync-time', asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const connectionId = parseInt(req.params.id);

    // Verify ownership
    const connection = await db.get(
      'SELECT id FROM native_calendar_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await db.run(
      'UPDATE native_calendar_connections SET last_sync_at = $1 WHERE id = $2',
      [new Date().toISOString(), connectionId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[CalendarSync] Update sync time error:', error);
    res.status(500).json({ error: 'Failed to update sync time' });
  }
}));

export default router;
