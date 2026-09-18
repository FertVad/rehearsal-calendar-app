import { asyncHandler } from '../../middleware/asyncHandler.js';
import { logger } from '../../utils/logger.js';
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { createLocalTimestampConverter, timestampToISO } from '../../utils/timezone.js';
import { consumeMemberAvailabilityBudget } from '../../services/memberAvailabilityRateLimit.js';
import { limits, positiveId, parseMemberAvailabilityQuery, expandMemberAvailabilityDates, availabilityBudgetError } from '../../services/memberAvailabilityQuery.js';
import { DEFAULT_TIMEZONE } from '../../constants/timezone.js';
import { notifyRoleChanged, notifyMemberRemoved, notifyAdminAppointed } from '../../services/notifications/pushNotificationService.js';
import { fullName } from '../../utils/names.js';

const router = Router();

// GET /api/native/projects/:projectId/members/availability - Get availability for project members
// IMPORTANT: This route MUST come BEFORE /projects/:projectId/members to match correctly
// Supports both single date (?date=2024-12-04) and date range (?startDate=2024-12-01&endDate=2024-12-07)
router.get('/:projectId/members/availability', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const projectId = positiveId(req.params.projectId);
    const window = parseMemberAvailabilityQuery(req.query);

    // Check if user is a member of the project
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You must be a project member to view availability' });
    }

    // One shared per-account budget across projects, aliases and instances.
    // A missing migration/storage failure never disables the limit silently.
    let budget;
    try {
      budget = await consumeMemberAvailabilityBudget(userId);
    } catch {
      return res.status(503).json({ error: 'Availability is temporarily unavailable' });
    }
    if (!budget.allowed) {
      res.set('Retry-After', String(budget.retryAfter));
      return res.status(429).json({ error: 'Too many availability requests; try again later' });
    }

    const memberParams = [projectId, ...(window.requestedIds || [])];
    const memberFilter = window.requestedIds
      ? ` AND user_id IN (${window.requestedIds.map((_, i) => `$${i + 2}`).join(',')})`
      : '';
    // Fetch one extra row to detect overflow; never return a truncated roster.
    // Filtering here also permits a bounded selection from a larger project.
    const members = await db.all(
      `SELECT DISTINCT user_id FROM native_project_members
       WHERE project_id = $1 AND status = 'active'${memberFilter}
       ORDER BY user_id LIMIT ${limits.maxMembers + 1}`,
      memberParams
    );
    const targetUserIds = members.map(m => Number(m.user_id));
    if (targetUserIds.length > limits.maxMembers || targetUserIds.length * window.dayCount > limits.maxMemberDays) {
      throw availabilityBudgetError();
    }
    if (targetUserIds.length === 0) return res.json({ availability: [] });

    // All authorization and cardinality budgets precede date expansion.
    const dates = expandMemberAvailabilityDates(window);
    const dateDays = dates.map(date => ({ date, day: Date.parse(`${date}T00:00:00Z`) }));
    const requestedDates = new Set(dates);
    // Get availability for each user across all dates
    const availability = [];

    // Get requester's timezone - ALL availability will be converted to this timezone
    // This ensures that when viewing the planner, all members' busy slots appear
    // in the requester's timezone, not each member's individual timezone
    const requester = await db.get(
      'SELECT substr(timezone, 1, 129) AS timezone FROM native_users WHERE id = $1',
      [userId]
    );
    const requesterTimezone = requester?.timezone || DEFAULT_TIMEZONE;
    if (requesterTimezone.length > 128) throw availabilityBudgetError();

    logger.debug(`[Availability API] User ID ${userId} requesting availability, timezone: ${requesterTimezone}`);

    // Batch fetch all users info (no need for individual timezones anymore).
    // No email: the planner is the only reader and never used it, so sending it
    // handed every member of a project every other member's address for nothing.
    const usersQuery = `SELECT u.id,
      substr(u.first_name, 1, 4097) AS first_name, substr(u.last_name, 1, 4097) AS last_name,
      EXISTS (SELECT 1 FROM native_user_availability a WHERE a.user_id = u.id) AS has_data
      FROM native_users u WHERE u.id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})`;
    const users = await db.all(usersQuery, targetUserIds);
    if (users.some(u => u.first_name?.length > 4096 || u.last_name?.length > 4096)) throw availabilityBudgetError();
    const usersMap = new Map(users.map(u => [Number(u.id), u]));
    const toLocal = createLocalTimestampConverter(requesterTimezone);

    // Build date range for TIMESTAMPTZ query
    // We need to query starts_at timestamps that fall on these dates in requester's timezone
    // For safety, query the full day range expanded by 24 hours on both sides
    const startDateStr = dates[0];
    const endDateStr = dates[dates.length - 1];

    // Build query params
    const queryParams = [...targetUserIds, startDateStr, endDateStr];
    let excludeClause = '';
    if (window.excludedId !== undefined) {
      excludeClause = ` AND NOT (source = 'rehearsal' AND external_event_id = $${queryParams.length + 1})`;
      queryParams.push(String(window.excludedId));
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
      `SELECT user_id, starts_at, ends_at, substr(type, 1, 33) AS type, is_all_day
       FROM native_user_availability
       WHERE user_id IN (${targetUserIds.map((_, i) => `$${i + 1}`).join(',')})
         AND starts_at < $${targetUserIds.length + 2}::date + interval '2 days'
         AND ends_at >= $${targetUserIds.length + 1}::date - interval '1 day'${excludeClause}
       ORDER BY user_id, starts_at ASC LIMIT ${limits.maxRecords + 1}`,
      queryParams
    );

    if (availabilityRecords.length > limits.maxRecords || availabilityRecords.some(r => r.type?.length > 32)) {
      throw availabilityBudgetError();
    }

    // Group records by user
    const recordsByUser = new Map();
    for (const record of availabilityRecords) {
      if (!recordsByUser.has(Number(record.user_id))) {
        recordsByUser.set(Number(record.user_id), []);
      }
      recordsByUser.get(Number(record.user_id)).push(record);
    }

    let rangeCount = 0;
    // Account for actual escaped UTF-8 JSON while building, before allocation
    // can grow beyond the response budget. Final serialization verifies it too.
    let responseBytes = Buffer.byteLength('{"availability":[]}');
    const charge = value => {
      responseBytes += Buffer.byteLength(JSON.stringify(value)) + 1;
      if (responseBytes > limits.maxResponseBytes) throw availabilityBudgetError();
    };

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
        hasData: Boolean(user.has_data),
        dates: []
      };

      charge(userAvailability);

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
      const addRange = (dateStr, range) => {
        if (!requestedDates.has(dateStr)) return;
        if (++rangeCount > limits.maxRanges) throw availabilityBudgetError();
        if (!rangesByDate.has(dateStr)) {
          charge({ date: dateStr, timeRanges: [] });
          rangesByDate.set(dateStr, []);
        }
        charge(range);
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
          const firstDay = Date.parse(`${startsAtISO.split('T')[0]}T00:00:00Z`);
          const lastDay = Date.parse(`${endsAtISO.split('T')[0]}T00:00:00Z`);
          for (const { date: d, day } of dateDays) {
            if (day >= firstDay && day <= lastDay) {
              addRange(d, { start: '00:00', end: '23:59', type: record.type, isAllDay: true });
            }
          }
          continue;
        }

        const from = toLocal(startsAtISO);
        const to = toLocal(endsAtISO);
        const fromDay = Date.parse(`${from.date}T00:00:00Z`);
        const toDay = Date.parse(`${to.date}T00:00:00Z`);
        const range = (start, end) => ({ start, end, type: record.type, isAllDay: false });

        if (from.date === to.date) {
          addRange(from.date, range(from.time, to.time));
          continue;
        }

        addRange(from.date, range(from.time, '23:59'));
        for (const { date: d, day } of dateDays) {
          if (day > fromDay && day < toDay) addRange(d, range('00:00', '23:59'));
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

    const body = JSON.stringify({ availability });
    if (Buffer.byteLength(body) > limits.maxResponseBytes) throw availabilityBudgetError();
    res.type('json').send(body);
  } catch (error) {
    if (error.status === 400 || error.code === 'AVAILABILITY_BUDGET_EXCEEDED') {
      return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
    console.error('[Availability] Error getting members availability:', error);
    res.status(500).json({ error: 'Failed to get members availability' });
  }
}));

// GET /api/native/projects/:projectId/members - Get project members
router.get('/:projectId/members', requireAuth, asyncHandler(async (req, res) => {
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
}));

// PUT /api/native/projects/:projectId/members/:userId/role - Update member role
router.put('/:projectId/members/:userId/role', requireAuth, asyncHandler(async (req, res) => {
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
}));

// DELETE /api/native/projects/:projectId/members/:userId - Remove member from project
router.delete('/:projectId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
  try {
    const requesterId = req.userId;
    const { projectId, userId } = req.params;

    // Check if requester is admin/owner
    const requesterMembership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, requesterId, 'active']
    );

    // Removing somebody else needs a rank. Removing yourself does not — this is
    // also how a member leaves, and there was no other way out: an ordinary
    // member could only ask to be removed and wait.
    const leavingSelf = Number(requesterId) === Number(userId);
    const runsTheProject =
      requesterMembership &&
      (requesterMembership.role === 'owner' || requesterMembership.role === 'admin');

    if (!requesterMembership || (!leavingSelf && !runsTheProject)) {
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

    // The owner cannot be removed, and cannot leave either.
    //
    // Nobody inherits a project — that is the rule account deletion follows too
    // — so an owner walking out would leave it with no owner at all, which
    // nothing can set again: it could never be deleted or handed on. An owner
    // who wants out deletes the project.
    if (targetMembership.role === 'owner') {
      return res.status(403).json({
        error: leavingSelf
          ? 'The owner cannot leave their own project; delete it instead'
          : 'Cannot remove project owner',
      });
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
}));

export default router;
