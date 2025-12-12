import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { timestampToLocal, timestampToISO } from '../../utils/timezone.js';

const router = Router();

// GET /api/native/projects/:projectId/members/availability - Get availability for project members
// IMPORTANT: This route MUST come BEFORE /projects/:projectId/members to match correctly
// Supports both single date (?date=2024-12-04) and date range (?startDate=2024-12-01&endDate=2024-12-07)
router.get('/:projectId/members/availability', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { date, startDate, endDate, userIds } = req.query;

    // Support both single date and date range
    let dates = [];
    if (date) {
      // Single date mode (backward compatibility)
      dates = [date];
    } else if (startDate && endDate) {
      // Date range mode (for Smart Planner)
      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = new Date(start);

      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    } else {
      return res.status(400).json({ error: 'Either date or both startDate and endDate are required' });
    }

    // Check if user is a member of the project
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You must be a project member to view availability' });
    }

    // Parse user IDs if provided (comma-separated), otherwise get all project members
    let targetUserIds = [];
    if (userIds) {
      targetUserIds = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    } else {
      // Get all active project members
      const members = await db.all(
        "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
        [projectId]
      );
      targetUserIds = members.map(m => m.user_id);
    }

    if (targetUserIds.length === 0) {
      return res.json({ availability: [] });
    }

    // Get availability for each user across all dates
    const availability = [];

    // Batch fetch all users info
    const usersQuery = `SELECT id, first_name, last_name, email, timezone FROM native_users WHERE id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})`;
    const users = await db.all(usersQuery, targetUserIds);
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Build date range for TIMESTAMPTZ query
    // We need to query starts_at timestamps that fall on these dates in each user's timezone
    // For safety, query the full day range expanded by 24 hours on both sides
    const startDateStr = dates[0];
    const endDateStr = dates[dates.length - 1];

    const availabilityRecords = await db.all(
      `SELECT user_id, starts_at, ends_at, type, is_all_day
       FROM native_user_availability
       WHERE user_id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})
         AND starts_at >= $${targetUserIds.length + 1}::date - interval '1 day'
         AND starts_at < $${targetUserIds.length + 2}::date + interval '2 days'
       ORDER BY user_id, starts_at ASC`,
      [...targetUserIds, startDateStr, endDateStr]
    );


    // Group records by user
    const recordsByUser = new Map();
    for (const record of availabilityRecords) {
      if (!recordsByUser.has(record.user_id)) {
        recordsByUser.set(record.user_id, []);
      }
      recordsByUser.get(record.user_id).push(record);
    }

    for (const targetUserId of targetUserIds) {
      const user = usersMap.get(targetUserId);

      if (!user) {
        continue;
      }

      const userTimezone = user.timezone || 'Asia/Jerusalem';
      const userRecords = recordsByUser.get(targetUserId) || [];

      const userAvailability = {
        userId: String(targetUserId),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        dates: []
      };

      // Group records by date in user's timezone
      const recordsByDate = new Map();
      for (const record of userRecords) {
        // Convert timestamp to user's local date
        const startsAtISO = timestampToISO(record.starts_at);
        const { date: localDate } = timestampToLocal(startsAtISO, userTimezone);

        if (!recordsByDate.has(localDate)) {
          recordsByDate.set(localDate, []);
        }
        recordsByDate.get(localDate).push(record);
      }

      // Process each requested date
      for (const currentDate of dates) {
        const records = recordsByDate.get(currentDate) || [];

        if (records.length > 0) {
          // Convert timestamps to time ranges in user's local timezone
          const timeRanges = records.map(record => {
            const startsAtISO = timestampToISO(record.starts_at);
            const endsAtISO = timestampToISO(record.ends_at);
            const { time: startTime } = timestampToLocal(startsAtISO, userTimezone);
            const { time: endTime } = timestampToLocal(endsAtISO, userTimezone);

            return {
              start: startTime,
              end: endTime,
              type: record.type,
              isAllDay: record.is_all_day
            };
          });

          userAvailability.dates.push({
            date: currentDate,
            timeRanges
          });
        }
      }

      availability.push(userAvailability);
    }

    console.log('[Members Availability] Response:', JSON.stringify(availability, null, 2));
    res.json({ availability });
  } catch (error) {
    console.error('[Availability] Error getting members availability:', error);
    res.status(500).json({ error: 'Failed to get members availability' });
  }
});

// GET /api/native/projects/:projectId/members - Get project members
router.get('/:projectId/members', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is a member
    const membership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, userId, 'active']
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all members with user info
    const members = await db.all(
      `SELECT
        m.id,
        m.user_id,
        m.role,
        m.character_name,
        m.status,
        m.joined_at,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar_url
      FROM native_project_members m
      JOIN native_users u ON m.user_id = u.id
      WHERE m.project_id = $1 AND m.status = 'active'
      ORDER BY
        CASE m.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          ELSE 3
        END,
        m.joined_at`,
      [projectId]
    );

    res.json({
      members: members.map(m => ({
        id: String(m.id),
        userId: String(m.user_id),
        role: m.role,
        characterName: m.character_name,
        status: m.status,
        joinedAt: m.joined_at,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        avatarUrl: m.avatar_url,
      })),
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

export default router;
