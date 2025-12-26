import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import {
  timestampToISO,
  formatAvailabilitySlotsResponse,
} from '../../utils/timezone.js';
import { AVAILABILITY_TYPES, DEFAULT_TIMEZONE, AVAILABILITY_SOURCES } from '../../constants/timezone.js';

const router = Router();

/**
 * Get user's timezone from database
 * @param {number} userId - User ID
 * @returns {Promise<string>} - IANA timezone string
 */
async function getUserTimezone(userId) {
  const user = await db.get(
    'SELECT timezone FROM native_users WHERE id = $1',
    [userId]
  );
  return user?.timezone || DEFAULT_TIMEZONE;
}

/**
 * GET /api/native/availability - Get all availability for current user
 * Returns availability slots with ISO 8601 timestamps
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's timezone
    const timezone = await getUserTimezone(userId);

    // Get availability from DB using new TIMESTAMPTZ columns
    const availability = await db.all(
      `SELECT id, starts_at, ends_at, type, title, notes, is_all_day, source, external_event_id, created_at
       FROM native_user_availability
       WHERE user_id = $1
       ORDER BY starts_at ASC`,
      [userId]
    );

    console.log(`[Availability API] Returning ${availability.length} slots for user ${userId}`);

    // Convert to API response format with ISO timestamps
    const converted = availability.map(slot => ({
      id: slot.id,
      startsAt: timestampToISO(slot.starts_at),
      endsAt: timestampToISO(slot.ends_at),
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
      isAllDay: slot.is_all_day,
      source: slot.source,
      externalEventId: slot.external_event_id,
      createdAt: slot.created_at,
    }));

    console.log('[Availability API] Sample slots:', JSON.stringify(converted.slice(0, 3), null, 2));

    res.json(converted);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * POST /api/native/availability/bulk - Bulk set availability
 * Accepts slots with ISO 8601 timestamps
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    // Get user's timezone for date extraction
    const timezone = await getUserTimezone(userId);

    console.log(`[Bulk Save] User ${userId}, saving ${entries.length} entries`);

    // Delete all existing manual availability for the affected dates
    const affectedDates = new Set();
    for (const entry of entries) {
      const { startsAt, type } = entry;
      if (!startsAt || !type) continue;

      // Extract date from ISO timestamp
      const date = startsAt.split('T')[0];
      affectedDates.add(date);
    }

    console.log(`[Bulk Save] Affected dates:`, Array.from(affectedDates));

    // Delete existing manual availability for these dates
    for (const date of affectedDates) {
      const result = await db.run(
        `DELETE FROM native_user_availability
         WHERE user_id = $1
         AND DATE(starts_at AT TIME ZONE $2) = $3
         AND source = $4`,
        [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
      );
      console.log(`[Bulk Save] Deleted ${result.changes || 0} manual slots for date ${date}`);
    }

    console.log(`[Bulk Save] Processing ${entries.length} entries`);

    // Insert new slots
    for (const entry of entries) {
      const { startsAt, endsAt, type, title, notes, isAllDay, source, external_event_id } = entry;

      if (!startsAt || !endsAt || !type) {
        console.warn('[Bulk Save] Skipping invalid entry:', entry);
        continue;
      }

      // Use provided source or default to manual
      const entrySource = source || AVAILABILITY_SOURCES.MANUAL;

      // For imported events (with external_event_id), check if already exists to avoid duplicates
      if (external_event_id && entrySource !== AVAILABILITY_SOURCES.MANUAL) {
        const existing = await db.get(
          `SELECT id FROM native_user_availability
           WHERE user_id = $1 AND external_event_id = $2 AND source = $3`,
          [userId, external_event_id, entrySource]
        );

        if (existing) {
          console.log(`[Bulk Save] Skipping duplicate: externalId=${external_event_id}, already exists with id=${existing.id}`);
          continue;
        }
      }

      console.log(`[Bulk Save] Inserting: ${startsAt} - ${endsAt}, type=${type}, source=${entrySource}, externalId=${external_event_id || 'none'}`);

      await db.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, notes, is_all_day, source, external_event_id)
         VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          startsAt,
          endsAt,
          type,
          title || null,
          notes || null,
          isAllDay || false,
          entrySource,
          external_event_id || null
        ]
      );
    }

    console.log(`[Bulk Save] Successfully saved ${entries.length} availability entries`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving bulk availability:', error);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

/**
 * PUT /api/native/availability/:date - Set availability for a specific date
 * DEPRECATED: Use POST /bulk instead with ISO timestamps
 */
router.put('/:date', requireAuth, async (req, res) => {
  res.status(400).json({
    error: 'This endpoint is deprecated. Use POST /native/availability/bulk with ISO timestamps instead.'
  });
});

/**
 * DELETE /api/native/availability/:date - Delete manually-created availability for a specific date
 * Only deletes slots created manually, preserves rehearsal and calendar sync slots
 */
router.delete('/:date', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { date } = req.params;

    // Get user's timezone
    const timezone = await getUserTimezone(userId);

    // Only delete manually-created availability for this date
    // Keep slots from rehearsals or calendar sync
    await db.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1
       AND DATE(starts_at AT TIME ZONE $2) = $3
       AND source = $4`,
      [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

/**
 * DELETE /api/native/availability/imported/all - Delete all imported calendar events
 * Removes all availability slots from calendar sync (apple_calendar, google_calendar)
 */
router.delete('/imported/all', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    console.log(`[Delete Imported] Removing all imported calendar events for user ${userId}`);

    // Delete all imported calendar events for this user
    const result = await db.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1
       AND source IN ($2, $3)`,
      [userId, AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE]
    );

    console.log(`[Delete Imported] Deleted ${result.changes || 0} imported events`);

    res.json({ success: true, deletedCount: result.changes || 0 });
  } catch (error) {
    console.error('Error deleting imported calendar events:', error);
    res.status(500).json({ error: 'Failed to delete imported calendar events' });
  }
});

/**
 * DELETE /api/native/availability/imported/batch - Batch delete imported events by external_event_id
 * Body: { eventIds: string[] }
 */
router.delete('/imported/batch', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { eventIds } = req.body;

    console.log(`[Batch Delete] Received request:`, {
      userId,
      eventIdsCount: eventIds?.length,
      eventIds: eventIds,
    });

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      console.log('[Batch Delete] Invalid request - eventIds missing or empty');
      return res.status(400).json({ error: 'eventIds array is required' });
    }

    console.log(`[Batch Delete] Deleting ${eventIds.length} imported events for user ${userId}`);

    // Delete in batches of 50 to avoid SQL parameter limits
    const BATCH_SIZE = 50;
    let totalDeleted = 0;

    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, idx) => `$${idx + 4}`).join(',');

      const sql = `DELETE FROM native_user_availability
         WHERE user_id = $1
         AND source IN ($2, $3)
         AND external_event_id IN (${placeholders})`;

      console.log(`[Batch Delete] Executing SQL:`, sql);
      console.log(`[Batch Delete] Parameters:`, [userId, AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE, ...batch]);

      const result = await db.run(sql, [userId, AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE, ...batch]);

      console.log(`[Batch Delete] Batch result:`, {
        changes: result.changes,
        batchSize: batch.length,
      });

      totalDeleted += result.changes || 0;
    }

    console.log(`[Batch Delete] Deleted ${totalDeleted} imported events`);
    res.json({ success: true, deletedCount: totalDeleted });
  } catch (error) {
    console.error('Error batch deleting imported events:', error);
    res.status(500).json({ error: 'Failed to batch delete imported events' });
  }
});

/**
 * PUT /api/native/availability/imported/batch - Batch update imported events
 * Body: { updates: [{ externalEventId, startsAt, endsAt, title, isAllDay }] }
 */
router.put('/imported/batch', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array is required' });
    }

    console.log(`[Batch Update] Updating ${updates.length} imported events for user ${userId}`);

    let totalUpdated = 0;

    for (const update of updates) {
      const { externalEventId, startsAt, endsAt, title, isAllDay } = update;

      if (!externalEventId || !startsAt || !endsAt) {
        console.warn('[Batch Update] Skipping invalid update:', update);
        continue;
      }

      const result = await db.run(
        `UPDATE native_user_availability
         SET starts_at = $1::timestamptz,
             ends_at = $2::timestamptz,
             title = $3,
             is_all_day = $4
         WHERE user_id = $5
         AND external_event_id = $6
         AND source IN ($7, $8)`,
        [startsAt, endsAt, title || null, isAllDay || false, userId, externalEventId, AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE]
      );

      console.log(`[Batch Update] Updated event ${externalEventId}:`, {
        changes: result.changes,
      });

      totalUpdated += result.changes || 0;
    }

    console.log(`[Batch Update] Updated ${totalUpdated} imported events`);
    res.json({ success: true, updatedCount: totalUpdated });
  } catch (error) {
    console.error('Error batch updating imported events:', error);
    res.status(500).json({ error: 'Failed to batch update imported events' });
  }
});

export default router;
