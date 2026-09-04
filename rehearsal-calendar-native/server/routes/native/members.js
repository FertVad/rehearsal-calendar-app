import { logger } from '../../utils/logger.js';
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { timestampToLocal, timestampToISO } from '../../utils/timezone.js';
import { DEFAULT_TIMEZONE } from '../../constants/timezone.js';
import { notifyRoleChanged, notifyMemberRemoved, notifyAdminAppointed } from '../../services/notifications/pushNotificationService.js';
import { fullName } from '../../utils/names.js';

const router = Router();

// GET /api/native/projects/:projectId/members/availability - Get availability for project members
// IMPORTANT: This route MUST come BEFORE /projects/:projectId/members to match correctly
// Supports both single date (?date=2024-12-04) and date range (?startDate=2024-12-01&endDate=2024-12-07)
router.get('/:projectId/members/availability', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { date, startDate, endDate, userIds, excludeRehearsalId } = req.query;

    // Support both single date and date range
    let dates = [];
    if (date) {
      // Single date mode (backward compatibility)
      dates = [date];
    } else if (startDate && endDate) {
      // Date range mode (for Smart Planner).
      //
      // Walked with the UTC accessors throughout. Anchoring on UTC midnight and
      // then stepping with setDate(), which moves the local components, agrees
      // with itself only until a clock change — harmless on Vercel, which runs
      // UTC, but wrong on a developer machine that observes one.
      const current = new Date(`${startDate}T00:00:00Z`);
      const last = new Date(`${endDate}T00:00:00Z`);

      while (current <= last) {
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
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

    // The project's active members are the only people whose availability may
    // be returned here. Fetch them up front: they are both the default target
    // set and the allow-list for an explicit ?userIds= filter. Without that
    // intersection, any member of any project could read arbitrary users'
    // emails, names and schedules by enumerating IDs.
    const members = await db.all(
      "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
      [projectId]
    );
    const memberIds = new Set(members.map(m => Number(m.user_id)));

    let targetUserIds = [];
    if (userIds) {
      targetUserIds = userIds
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id) && memberIds.has(id));
    } else {
      targetUserIds = [...memberIds];
    }

    if (targetUserIds.length === 0) {
      return res.json({ availability: [] });
    }

    // Get availability for each user across all dates
    const availability = [];

    // Get requester's timezone - ALL availability will be converted to this timezone
    // This ensures that when viewing the planner, all members' busy slots appear
    // in the requester's timezone, not each member's individual timezone
    const requester = await db.get(
      'SELECT timezone FROM native_users WHERE id = $1',
      [userId]
    );
    const requesterTimezone = requester?.timezone || DEFAULT_TIMEZONE;

    logger.debug(`[Availability API] User ID ${userId} requesting availability, timezone: ${requesterTimezone}`);

    // Batch fetch all users info (no need for individual timezones anymore)
    const usersQuery = `SELECT id, first_name, last_name, email FROM native_users WHERE id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})`;
    const users = await db.all(usersQuery, targetUserIds);
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Build date range for TIMESTAMPTZ query
    // We need to query starts_at timestamps that fall on these dates in requester's timezone
    // For safety, query the full day range expanded by 24 hours on both sides
    const startDateStr = dates[0];
    const endDateStr = dates[dates.length - 1];

    // Build query params
    const queryParams = [...targetUserIds, startDateStr, endDateStr];
    let excludeClause = '';
    if (excludeRehearsalId) {
      excludeClause = ` AND NOT (source = 'rehearsal' AND external_event_id = $${queryParams.length + 1})`;
      queryParams.push(excludeRehearsalId);
    }

    // Overlap test, not a test on starts_at alone. A span that began before the
    // window and runs into it — a tour, a trip, a night shift — was not merely
    // put on the wrong day, it was never fetched at all, and the person read as
    // free for the whole of it.
    //
    // The day of slack on each side covers every zone the requester can be in:
    // one day back reaches UTC+14, two forward reach UTC-12, and all-day rows
    // sit at UTC midnight of their own date, well inside both.
    const availabilityRecords = await db.all(
      `SELECT user_id, starts_at, ends_at, type, is_all_day
       FROM native_user_availability
       WHERE user_id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})
         AND starts_at < $${targetUserIds.length + 2}::date + interval '2 days'
         AND ends_at >= $${targetUserIds.length + 1}::date - interval '1 day'${excludeClause}
       ORDER BY user_id, starts_at ASC`,
      queryParams
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

      const userRecords = recordsByUser.get(targetUserId) || [];

      const userAvailability = {
        userId: String(targetUserId),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        dates: []
      };

      // Lay each record across every day it actually covers, in the requester's
      // timezone, clipped to that day.
      //
      // The wire format is (date → list of HH:mm–HH:mm), which cannot express a
      // span, so a record has to be cut into one range per day. Bucketing it on
      // its start date alone lost everything after the first: a tour Monday
      // 10:00 to Wednesday 18:00 arrived as "Monday 10:00–18:00" and left
      // Tuesday and Wednesday reading Perfect.
      //
      // Worse for the short ones. A span crossing local midnight came back as
      // 22:00–02:00, and the client drops any range whose end is not after its
      // start — silently, so the whole evening read free rather than busy. That
      // needs no exotic input: the availability editor deliberately supports an
      // overnight slot, an imported red-eye is one, and an ordinary 21:00–23:00
      // rehearsal becomes one for any teammate a timezone or two east.
      const rangesByDate = new Map();
      const windowFirst = dates[0];
      const windowLast = dates[dates.length - 1];

      const nextDate = (dateStr) => {
        const d = new Date(`${dateStr}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().split('T')[0];
      };

      const addRange = (dateStr, range) => {
        if (dateStr < windowFirst || dateStr > windowLast) return;
        if (!rangesByDate.has(dateStr)) rangesByDate.set(dateStr, []);
        rangesByDate.get(dateStr).push(range);
      };

      for (const record of userRecords) {
        const startsAtISO = timestampToISO(record.starts_at);
        const endsAtISO = timestampToISO(record.ends_at);

        // A whole-day entry is stored as UTC midnight standing for a calendar
        // date, not for an instant — so take the dates it says, without
        // converting into the requester's zone, which landed it on the wrong
        // day whenever the two disagreed.
        if (record.is_all_day) {
          const firstDate = startsAtISO.split('T')[0];
          const lastDate = endsAtISO.split('T')[0];
          for (
            let d = firstDate > windowFirst ? firstDate : windowFirst;
            d <= lastDate && d <= windowLast;
            d = nextDate(d)
          ) {
            addRange(d, { start: '00:00', end: '23:59', type: record.type, isAllDay: true });
          }
          continue;
        }

        const from = timestampToLocal(startsAtISO, requesterTimezone);
        const to = timestampToLocal(endsAtISO, requesterTimezone);
        const range = (start, end) => ({ start, end, type: record.type, isAllDay: false });

        if (from.date === to.date) {
          addRange(from.date, range(from.time, to.time));
          continue;
        }

        addRange(from.date, range(from.time, '23:59'));
        for (
          let d = nextDate(from.date) > windowFirst ? nextDate(from.date) : windowFirst;
          d < to.date && d <= windowLast;
          d = nextDate(d)
        ) {
          addRange(d, range('00:00', '23:59'));
        }
        // An end of exactly midnight belongs to the day before, not as a
        // zero-length range on the next one.
        if (to.time !== '00:00') {
          addRange(to.date, range('00:00', to.time));
        }
      }

      // Process each requested date
      for (const currentDate of dates) {
        const timeRanges = rangesByDate.get(currentDate);

        if (timeRanges?.length) {
          userAvailability.dates.push({
            date: currentDate,
            timeRanges
          });
        }
      }

      availability.push(userAvailability);
    }

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

// PUT /api/native/projects/:projectId/members/:userId/role - Update member role
router.put('/:projectId/members/:userId/role', requireAuth, async (req, res) => {
  try {
    const requesterId = req.userId;
    const { projectId, userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "member"' });
    }

    // Check if requester is admin/owner
    const requesterMembership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, requesterId, 'active']
    );

    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only project admins can update member roles' });
    }

    // Check target member exists
    const targetMembership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, userId, 'active']
    );

    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot change owner role
    if (targetMembership.role === 'owner') {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }

    // Update role
    await db.run(
      'UPDATE native_project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
      [role, projectId, userId]
    );

    try {
      const project = await db.get('SELECT name FROM native_projects WHERE id = $1', [projectId]);

      // The person themselves, in the second person.
      await notifyRoleChanged(project.name, parseInt(userId), role);

      // And everyone else who runs the project, because administrators may
      // appoint administrators here — so the owner cannot assume they did it.
      // Whoever made the change is left out; they were there.
      if (role === 'admin') {
        const others = await db.all(
          `SELECT user_id FROM native_project_members
           WHERE project_id = $1 AND status = 'active' AND role IN ('owner', 'admin')
             AND user_id <> $2 AND user_id <> $3`,
          [projectId, parseInt(userId), requesterId]
        );

        if (others.length > 0) {
          const member = await db.get(
            'SELECT first_name, last_name FROM native_users WHERE id = $1',
            [parseInt(userId)]
          );
          const memberName = fullName(member);
          await notifyAdminAppointed(project.name, memberName, others.map((o) => o.user_id));
        }
      }
    } catch (notifErr) {
      logger.error('[Members] Could not announce the role change:', notifErr);
    }

    res.json({
      success: true,
      message: 'Member role updated successfully',
      role
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/native/projects/:projectId/members/:userId - Remove member from project
router.delete('/:projectId/members/:userId', requireAuth, async (req, res) => {
  try {
    const requesterId = req.userId;
    const { projectId, userId } = req.params;

    // Check if requester is admin/owner
    const requesterMembership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, requesterId, 'active']
    );

    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only project admins can remove members' });
    }

    // Check target member exists
    const targetMembership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, userId, 'active']
    );

    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot remove owner
    if (targetMembership.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove project owner' });
    }

    // Get project name BEFORE deletion
    const project = await db.get('SELECT name FROM native_projects WHERE id = $1', [projectId]);

    // Remove member from project
    await db.run(
      'DELETE FROM native_project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    // And take them off the project's rehearsals.
    //
    // Membership is not what grants access to a rehearsal — a row in
    // native_rehearsal_responses is, and nothing cascades it. So removing
    // someone used to leave every one of those rows in place: they went on
    // receiving the reminders and the edited/cancelled pushes, and could still
    // read any of those rehearsals by id, including changes made after they
    // were removed. Only an admin re-saving that rehearsal's participants ever
    // cleared it.
    await db.run(
      `DELETE FROM native_rehearsal_responses
       WHERE user_id = $1
       AND rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $2)`,
      [userId, projectId]
    );

    // The busy slots those rehearsals put on their calendar go too, or they
    // stay unavailable to their other projects at times nobody expects them.
    await db.run(
      `DELETE FROM native_user_availability
       WHERE user_id = $1 AND source = 'rehearsal'
       AND external_event_id IN (SELECT CAST(id AS TEXT) FROM native_rehearsals WHERE project_id = $2)`,
      [userId, projectId]
    );

    // Send push notification to the removed user
    try {
      await notifyMemberRemoved(project.name, parseInt(userId));
    } catch (notifErr) {
      console.error('Error sending member removed notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
