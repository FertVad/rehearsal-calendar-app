import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { convertSlotsToUTC, convertSlotsFromUTC } from '../../utils/timezone.js';
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
 * Returns availability slots converted to user's local timezone
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's timezone
    const timezone = await getUserTimezone(userId);

    // Get availability from DB (stored in UTC)
    const availability = await db.all(
      `SELECT id, date, start_time, end_time, type, title, notes, is_all_day, source, external_event_id, created_at
       FROM native_user_availability
       WHERE user_id = $1
       ORDER BY date ASC, start_time ASC`,
      [userId]
    );

    // Group by date for conversion
    const byDate = {};
    for (const slot of availability) {
      if (!byDate[slot.date]) {
        byDate[slot.date] = [];
      }
      byDate[slot.date].push(slot);
    }

    // Convert each date's slots from UTC to local timezone
    const converted = [];
    for (const [date, slots] of Object.entries(byDate)) {
      const localSlots = convertSlotsFromUTC(date, slots, timezone);

      // Re-attach metadata to converted slots
      for (let i = 0; i < localSlots.length; i++) {
        converted.push({
          id: slots[i].id,
          date: date, // Keep original date for reference
          start: localSlots[i].start,
          end: localSlots[i].end,
          type: localSlots[i].type,
          title: localSlots[i].title,
          notes: localSlots[i].notes,
          isAllDay: slots[i].is_all_day,
          source: slots[i].source,
          externalEventId: slots[i].external_event_id,
          createdAt: slots[i].created_at,
        });
      }
    }

    res.json(converted);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * POST /api/native/availability/bulk - Bulk set availability
 * Accepts slots in user's local timezone, converts to UTC for storage
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    // Get user's timezone
    const timezone = await getUserTimezone(userId);

    // Process each entry
    for (const entry of entries) {
      const { date, type, slots, title, notes } = entry;

      if (!date || !type) {
        continue; // Skip invalid entries
      }

      // Delete existing manually-created availability for this date
      // Keep slots created from rehearsals or calendar sync
      await db.run(
        `DELETE FROM native_user_availability
         WHERE user_id = $1 AND date = $2 AND source = $3`,
        [userId, date, AVAILABILITY_SOURCES.MANUAL]
      );

      // Insert new slots
      if (slots && slots.length > 0) {
        // Convert slots from local timezone to UTC
        const utcSlots = convertSlotsToUTC(date, slots, timezone);

        for (const utcSlot of utcSlots) {
          await db.run(
            `INSERT INTO native_user_availability (user_id, date, start_time, end_time, type, title, notes, is_all_day, source)
             VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)`,
            [
              userId,
              utcSlot.date,
              utcSlot.startTime,
              utcSlot.endTime,
              type,
              title || null,
              notes || null,
              utcSlot.isAllDay || false,
              AVAILABILITY_SOURCES.MANUAL
            ]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving bulk availability:', error);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

/**
 * PUT /api/native/availability/:date - Set availability for a specific date
 * Accepts slots in user's local timezone, converts to UTC for storage
 */
router.put('/:date', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { date } = req.params;
    const { type, slots, title, notes } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Type is required' });
    }

    // Get user's timezone
    const timezone = await getUserTimezone(userId);

    // Delete existing manually-created availability for this date
    // Keep slots created from rehearsals or calendar sync
    await db.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1 AND date = $2 AND source = $3`,
      [userId, date, AVAILABILITY_SOURCES.MANUAL]
    );

    // Insert new slots
    if (slots && slots.length > 0) {
      // Convert slots from local timezone to UTC
      const utcSlots = convertSlotsToUTC(date, slots, timezone);

      for (const utcSlot of utcSlots) {
        await db.run(
          `INSERT INTO native_user_availability (user_id, date, start_time, end_time, type, title, notes, is_all_day, source)
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            utcSlot.date,
            utcSlot.startTime,
            utcSlot.endTime,
            type,
            title || null,
            notes || null,
            utcSlot.isAllDay || false,
            AVAILABILITY_SOURCES.MANUAL
          ]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving availability:', error);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

/**
 * DELETE /api/native/availability/:date - Delete manually-created availability for a specific date
 * Only deletes slots created manually, preserves rehearsal and calendar sync slots
 */
router.delete('/:date', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { date } = req.params;

    // Only delete manually-created availability
    // Keep slots from rehearsals or calendar sync
    await db.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1 AND date = $2 AND source = $3`,
      [userId, date, AVAILABILITY_SOURCES.MANUAL]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

export default router;
