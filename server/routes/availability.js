import { Router } from 'express';
import * as NativeAvailability from '../database/models/NativeAvailability.js';
import { requireAuth } from '../middleware/jwtMiddleware.js';
import db from '../database/db.js';
import { localToUTC, utcToLocal } from '../utils/timezone.js';

const router = Router();

// Helper to get user's timezone
async function getUserTimezone(userId) {
  const user = await db.get('SELECT timezone FROM native_users WHERE id = $1', [userId]);
  return user?.timezone || 'Asia/Jerusalem';
}

// Convert slots from user timezone to UTC for storage
function convertSlotsToUTC(date, slots, timezone) {
  if (!slots || slots.length === 0) return [];

  return slots.map(slot => {
    const startUTC = localToUTC(date, slot.start, timezone);
    const endUTC = localToUTC(date, slot.end, timezone);

    return {
      start: startUTC.time,
      end: endUTC.time,
      // Store original date in case slot crosses midnight
      utcDate: startUTC.date,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

// Convert slots from UTC to user timezone for display
function convertSlotsFromUTC(date, slots, timezone) {
  if (!slots || slots.length === 0) return [];

  return slots.map(slot => {
    const startLocal = utcToLocal(date, slot.startTime || slot.start_time, timezone);
    const endLocal = utcToLocal(date, slot.endTime || slot.end_time, timezone);

    return {
      id: slot.id,
      startTime: startLocal.time,
      endTime: endLocal.time,
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
      localDate: startLocal.date,
    };
  });
}

/**
 * GET /api/availability
 * Get all availability for current user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const timezone = await getUserTimezone(req.userId);
    const availability = await NativeAvailability.getAllForUser(req.userId);

    // Group by date for easier client-side processing
    const grouped = {};
    for (const record of availability) {
      // Format date as YYYY-MM-DD string (PostgreSQL returns Date object)
      let utcDate = record.date;
      if (utcDate instanceof Date) {
        const year = utcDate.getFullYear();
        const month = String(utcDate.getMonth() + 1).padStart(2, '0');
        const day = String(utcDate.getDate()).padStart(2, '0');
        utcDate = `${year}-${month}-${day}`;
      } else if (typeof utcDate === 'string' && !utcDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const d = new Date(utcDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        utcDate = `${year}-${month}-${day}`;
      }

      // Convert times from UTC to user timezone
      const startLocal = utcToLocal(utcDate, record.start_time, timezone);
      const endLocal = utcToLocal(utcDate, record.end_time, timezone);
      const localDate = startLocal.date;

      if (!grouped[localDate]) {
        grouped[localDate] = [];
      }
      grouped[localDate].push({
        id: record.id,
        startTime: startLocal.time,
        endTime: endLocal.time,
        type: record.type,
        title: record.title,
        notes: record.notes,
      });
    }

    console.log('[Availability] GET all - grouped keys:', Object.keys(grouped));
    res.json({ availability: grouped });
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/availability/range
 * Get availability for date range
 */
router.get('/range', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const timezone = await getUserTimezone(req.userId);
    const availability = await NativeAvailability.getByDateRange(req.userId, startDate, endDate);

    // Group by date and convert from UTC to user timezone
    const grouped = {};
    for (const record of availability) {
      // Format date as YYYY-MM-DD string
      let utcDate = record.date;
      if (utcDate instanceof Date) {
        const year = utcDate.getFullYear();
        const month = String(utcDate.getMonth() + 1).padStart(2, '0');
        const day = String(utcDate.getDate()).padStart(2, '0');
        utcDate = `${year}-${month}-${day}`;
      } else if (typeof utcDate === 'string' && !utcDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const d = new Date(utcDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        utcDate = `${year}-${month}-${day}`;
      }

      // Convert times from UTC to user timezone
      const startLocal = utcToLocal(utcDate, record.start_time, timezone);
      const endLocal = utcToLocal(utcDate, record.end_time, timezone);
      const localDate = startLocal.date;

      if (!grouped[localDate]) {
        grouped[localDate] = [];
      }
      grouped[localDate].push({
        id: record.id,
        startTime: startLocal.time,
        endTime: endLocal.time,
        type: record.type,
        title: record.title,
        notes: record.notes,
      });
    }

    res.json({ availability: grouped });
  } catch (err) {
    console.error('Get availability range error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/availability/:date
 * Set availability for a specific date
 */
router.put('/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const { type, slots } = req.body;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate type
    if (!['available', 'busy', 'tentative'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Use available, busy, or tentative' });
    }

    // Validate slots for custom availability
    if (type === 'tentative' && (!slots || slots.length === 0)) {
      return res.status(400).json({ error: 'Slots are required for partial availability' });
    }

    // Get user timezone and convert slots to UTC
    const timezone = await getUserTimezone(req.userId);
    let utcSlots = [];
    let utcDate = date;

    if (type === 'available' || type === 'busy') {
      // Full day - convert reference times to UTC
      const startUTC = localToUTC(date, '00:00', timezone);
      const endUTC = localToUTC(date, '23:59', timezone);
      utcDate = startUTC.date;
      utcSlots = [{ start: startUTC.time, end: endUTC.time }];
    } else if (slots && slots.length > 0) {
      // Convert slots from user timezone to UTC
      utcSlots = convertSlotsToUTC(date, slots, timezone);
      if (utcSlots.length > 0) {
        utcDate = utcSlots[0].utcDate || date;
      }
    }

    const records = await NativeAvailability.setForDate(req.userId, utcDate, type, utcSlots);

    // Convert response back to user timezone
    const responseRecords = records.map(r => {
      const startLocal = utcToLocal(utcDate, r.start_time, timezone);
      const endLocal = utcToLocal(utcDate, r.end_time, timezone);
      return {
        id: r.id,
        startTime: startLocal.time,
        endTime: endLocal.time,
        type: r.type,
      };
    });

    res.json({
      date,
      type,
      records: responseRecords,
    });
  } catch (err) {
    console.error('Set availability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/availability/bulk
 * Bulk set availability for multiple dates
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    // Get user timezone
    const timezone = await getUserTimezone(req.userId);

    // Validate and convert entries
    console.log('[Availability] Bulk entries:', JSON.stringify(entries, null, 2));
    const convertedEntries = [];

    for (const entry of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        console.log('[Availability] Invalid date:', entry.date, typeof entry.date);
        return res.status(400).json({ error: `Invalid date format: ${entry.date}` });
      }
      if (!['available', 'busy', 'tentative'].includes(entry.type)) {
        return res.status(400).json({ error: `Invalid type for ${entry.date}` });
      }

      // Convert slots from user timezone to UTC
      const utcSlots = convertSlotsToUTC(entry.date, entry.slots || [], timezone);

      // For full day entries, convert the reference times too
      if (entry.type === 'available' || entry.type === 'busy') {
        const startUTC = localToUTC(entry.date, '00:00', timezone);
        const endUTC = localToUTC(entry.date, '23:59', timezone);

        convertedEntries.push({
          date: startUTC.date,
          type: entry.type,
          slots: [{ start: startUTC.time, end: endUTC.time }],
        });
      } else {
        // For tentative/custom, use the converted slots
        if (utcSlots.length > 0) {
          convertedEntries.push({
            date: utcSlots[0].utcDate || entry.date,
            type: entry.type,
            slots: utcSlots.map(s => ({ start: s.start, end: s.end })),
          });
        }
      }
    }

    console.log('[Availability] Converted to UTC:', JSON.stringify(convertedEntries, null, 2));
    const results = await NativeAvailability.bulkSet(req.userId, convertedEntries);

    res.json({ results });
  } catch (err) {
    console.error('Bulk set availability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/availability/:date
 * Delete availability for a specific date
 */
router.delete('/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    await NativeAvailability.deleteForDate(req.userId, date);

    res.json({ message: 'Availability deleted', date });
  } catch (err) {
    console.error('Delete availability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
