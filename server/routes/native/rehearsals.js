import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import {
  localToTimestamp,
  timestampToISO,
  formatRehearsalResponse,
} from '../../utils/timezone.js';
import {
  DEFAULT_TIMEZONE,
  AVAILABILITY_TYPES,
  AVAILABILITY_SOURCES,
  mapDBStatusToClient,
  mapClientStatusToDB,
} from '../../constants/timezone.js';

const router = Router();

// Helper functions for rehearsal management
/**
 * Get project's timezone setting
 * @param {number} projectId - Project ID
 * @returns {Promise<string>} - IANA timezone string
 */
async function getProjectTimezone(projectId) {
  const project = await db.get(
    'SELECT timezone FROM native_projects WHERE id = $1',
    [projectId]
  );
  return project?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Book availability slots for all project members when rehearsal is created
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
async function bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  // Get all project members
  const members = await db.all(
    "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
    [projectId]
  );

  // For each member, insert a busy slot using TIMESTAMPTZ columns
  for (const member of members) {
    await db.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, 'Rehearsal', FALSE)`,
      [
        member.user_id,
        startsAt,
        endsAt,
        AVAILABILITY_TYPES.BUSY,
        AVAILABILITY_SOURCES.REHEARSAL,
        rehearsalId.toString(),
      ]
    );
  }
}

/**
 * Update availability slots when rehearsal time is changed
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
async function updateRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  console.log('[updateRehearsalSlots] Updating slots for rehearsal:', {
    rehearsalId,
    projectId,
    startsAt,
    endsAt,
  });

  // Delete existing booked slots
  await deleteRehearsalSlots(rehearsalId);

  // Book new slots
  await bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt);
}

/**
 * Delete all availability slots associated with a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 */
async function deleteRehearsalSlots(rehearsalId) {
  console.log('[deleteRehearsalSlots] Deleting slots for rehearsal:', rehearsalId);

  await db.run(
    "DELETE FROM native_user_availability WHERE source = $1 AND external_event_id = $2",
    [AVAILABILITY_SOURCES.REHEARSAL, rehearsalId.toString()]
  );

  console.log('[deleteRehearsalSlots] Deleted all slots');
}

function formatDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/native/rehearsals/batch?projectIds=1,2,3 - Get rehearsals for multiple projects (Performance optimization)
router.get('/batch', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectIds } = req.query;

    if (!projectIds) {
      return res.status(400).json({ error: 'projectIds query parameter is required' });
    }

    // Parse comma-separated project IDs
    const projectIdArray = projectIds.split(',').map(id => id.trim()).filter(Boolean);

    if (projectIdArray.length === 0) {
      return res.json({ rehearsals: [] });
    }

    console.log('[Batch Rehearsals] Fetching for projects:', projectIdArray);

    // Check user membership for all projects in one query
    const memberships = await db.all(
      `SELECT project_id FROM native_project_members
       WHERE project_id IN (${projectIdArray.map(() => '?').join(',')})
       AND user_id = ?
       AND status = 'active'`,
      [...projectIdArray, userId]
    );

    const accessibleProjectIds = memberships.map(m => String(m.project_id));

    if (accessibleProjectIds.length === 0) {
      return res.json({ rehearsals: [] });
    }

    console.log('[Batch Rehearsals] User has access to:', accessibleProjectIds);

    // Fetch all rehearsals for accessible projects in one query
    const rehearsals = await db.all(
      `SELECT r.*, p.name as project_name
       FROM native_rehearsals r
       JOIN native_projects p ON r.project_id = p.id
       WHERE r.project_id IN (${accessibleProjectIds.map(() => '?').join(',')})
       ORDER BY r.starts_at DESC`,
      accessibleProjectIds
    );

    console.log(`[Batch Rehearsals] Found ${rehearsals.length} rehearsals`);

    res.json({
      rehearsals: rehearsals.map(r => ({
        id: String(r.id),
        projectId: String(r.project_id),
        projectName: r.project_name,
        title: r.title,
        description: r.description,
        startsAt: timestampToISO(r.starts_at),
        endsAt: timestampToISO(r.ends_at),
        location: r.location,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('[Batch Rehearsals] Error:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
});

// GET /api/native/projects/:projectId/rehearsals - Get all rehearsals for a project
router.get('/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is a member
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get project timezone
    const timezone = await getProjectTimezone(projectId);

    // Get all rehearsals for the project using new TIMESTAMPTZ columns
    const rehearsals = await db.all(
      `SELECT * FROM native_rehearsals
       WHERE project_id = $1
       ORDER BY starts_at DESC`,
      [projectId]
    );

    res.json({
      rehearsals: rehearsals.map(r => {
        return {
          id: String(r.id),
          projectId: String(r.project_id),
          title: r.title,
          description: r.description,
          startsAt: timestampToISO(r.starts_at),
          endsAt: timestampToISO(r.ends_at),
          location: r.location,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching rehearsals:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
});

// POST /api/native/projects/:projectId/rehearsals - Create a new rehearsal
router.post('/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { title, description, date, startTime, endTime, startsAt, endsAt, location } = req.body;

    console.log('[Create Rehearsal] Request:', {
      userId,
      projectId,
      title,
      date,
      startTime,
      endTime,
      startsAt,
      endsAt,
      location,
    });

    // Check if user is admin/owner
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    console.log('[Create Rehearsal] Membership:', membership);

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only admins can create rehearsals' });
    }

    let startsAtISO, endsAtISO;

    // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
    if (startsAt && endsAt) {
      // New format: ISO timestamps
      startsAtISO = startsAt;
      endsAtISO = endsAt;
    } else if (date && startTime && endTime) {
      // Old format: convert to ISO timestamps
      const timezone = await getProjectTimezone(projectId);
      const formattedDate = formatDateString(date);
      if (!formattedDate) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
      endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
    } else {
      return res.status(400).json({ error: 'Either (startsAt, endsAt) or (date, startTime, endTime) are required' });
    }

    console.log('[Create Rehearsal] Timestamps:', {
      startsAtISO,
      endsAtISO,
    });

    // Create rehearsal using new TIMESTAMPTZ columns
    const newRehearsal = await db.get(
      `INSERT INTO native_rehearsals (project_id, starts_at, ends_at, location, created_by, created_at, updated_at)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, NOW(), NOW())
       RETURNING *`,
      [
        projectId,
        startsAtISO,
        endsAtISO,
        location || null,
        userId,
      ]
    );

    console.log('[Create Rehearsal] Created rehearsal:', newRehearsal);

    // Book slots in user availability for all project members
    await bookRehearsalSlots(
      newRehearsal.id,
      projectId,
      startsAtISO,
      endsAtISO
    );

    res.status(201).json({
      rehearsal: {
        id: String(newRehearsal.id),
        projectId: String(newRehearsal.project_id),
        title: newRehearsal.title,
        description: newRehearsal.description,
        startsAt: timestampToISO(newRehearsal.starts_at),
        endsAt: timestampToISO(newRehearsal.ends_at),
        location: newRehearsal.location,
        createdAt: newRehearsal.created_at,
        updatedAt: newRehearsal.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating rehearsal:', error);
    res.status(500).json({ error: 'Failed to create rehearsal' });
  }
});

// PUT /api/native/projects/:projectId/rehearsals/:rehearsalId - Update a rehearsal
router.put('/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId, rehearsalId } = req.params;
    const { title, description, date, startTime, endTime, startsAt, endsAt, location } = req.body;

    // Check if user is admin/owner
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only admins can update rehearsals' });
    }

    // Check if rehearsal exists
    const rehearsal = await db.get(
      'SELECT * FROM native_rehearsals WHERE id = $1 AND project_id = $2',
      [rehearsalId, projectId]
    );

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    let startsAtISO, endsAtISO;

    // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
    if (startsAt && endsAt) {
      // New format: ISO timestamps
      startsAtISO = startsAt;
      endsAtISO = endsAt;
    } else if (date && startTime && endTime) {
      // Old format: convert to ISO timestamps
      const timezone = await getProjectTimezone(projectId);
      const formattedDate = formatDateString(date);
      if (!formattedDate) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
      endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
    } else {
      return res.status(400).json({ error: 'Either (startsAt, endsAt) or (date, startTime, endTime) are required' });
    }

    // Update rehearsal using new TIMESTAMPTZ columns
    const updatedRehearsal = await db.get(
      `UPDATE native_rehearsals
       SET starts_at = $1::timestamptz, ends_at = $2::timestamptz, location = $3, updated_at = NOW()
       WHERE id = $4 AND project_id = $5
       RETURNING *`,
      [
        startsAtISO,
        endsAtISO,
        location || null,
        rehearsalId,
        projectId,
      ]
    );

    // Update booked slots
    await updateRehearsalSlots(
      rehearsalId,
      projectId,
      startsAtISO,
      endsAtISO
    );

    res.json({
      rehearsal: {
        id: String(updatedRehearsal.id),
        projectId: String(updatedRehearsal.project_id),
        title: updatedRehearsal.title,
        description: updatedRehearsal.description,
        startsAt: timestampToISO(updatedRehearsal.starts_at),
        endsAt: timestampToISO(updatedRehearsal.ends_at),
        location: updatedRehearsal.location,
        createdAt: updatedRehearsal.created_at,
        updatedAt: updatedRehearsal.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating rehearsal:', error);
    res.status(500).json({ error: 'Failed to update rehearsal' });
  }
});

// DELETE /api/native/projects/:projectId/rehearsals/:rehearsalId - Delete a rehearsal
router.delete('/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId, rehearsalId } = req.params;

    // Check if user is admin/owner
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [projectId, userId]
    );

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only admins can delete rehearsals' });
    }

    // Check if rehearsal exists
    const rehearsal = await db.get(
      'SELECT * FROM native_rehearsals WHERE id = $1 AND project_id = $2',
      [rehearsalId, projectId]
    );

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Delete booked slots first
    await deleteRehearsalSlots(rehearsalId);

    // Delete RSVP responses
    await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

    // Delete rehearsal
    await db.run('DELETE FROM native_rehearsals WHERE id = $1', [rehearsalId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rehearsal:', error);
    res.status(500).json({ error: 'Failed to delete rehearsal' });
  }
});

// POST /api/native/rehearsals/:rehearsalId/respond - RSVP to a rehearsal
router.post('/:rehearsalId/respond', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;
    const { status, notes } = req.body;

    console.log('[RSVP] Request:', { userId, rehearsalId, status, notes });

    // Map client status to database response values
    const statusMap = {
      'confirmed': 'yes',
      'declined': 'no',
      'tentative': 'maybe',
      'invited': 'maybe', // For like system: unliked/invited state
      // Also accept database values directly
      'yes': 'yes',
      'no': 'no',
      'maybe': 'maybe',
    };

    const response = statusMap[status];

    // Validate response
    if (!response) {
      return res.status(400).json({ error: 'Invalid status. Must be confirmed, declined, tentative, yes, no, or maybe' });
    }

    // Check if rehearsal exists and get project
    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    console.log('[RSVP] Rehearsal:', rehearsal);

    // Check if user is a member of the project
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [rehearsal.project_id, userId]
    );

    console.log('[RSVP] Membership:', membership);

    if (!membership) {
      return res.status(403).json({ error: 'You must be a project member to RSVP' });
    }

    // Check if response already exists
    const existingResponse = await db.get(
      'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id = $2',
      [rehearsalId, userId]
    );

    console.log('[RSVP] Existing response:', existingResponse);

    let rsvpResponse;
    let wasDeleted = false;

    // For like system: if status is 'tentative' (unlike), delete the response instead of updating
    if (status === 'tentative' && existingResponse) {
      // Delete response (unlike)
      await db.run(
        'DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id = $2',
        [rehearsalId, userId]
      );
      console.log('[RSVP] Deleted response (unlike)');
      wasDeleted = true;
      rsvpResponse = null;
    } else if (existingResponse && status !== 'tentative') {
      // Update existing response
      rsvpResponse = await db.get(
        `UPDATE native_rehearsal_responses
         SET response = $1, notes = $2, updated_at = NOW()
         WHERE rehearsal_id = $3 AND user_id = $4
         RETURNING *`,
        [response, notes || null, rehearsalId, userId]
      );
      console.log('[RSVP] Updated response:', rsvpResponse);
    } else if (!existingResponse && status !== 'tentative') {
      // Create new response
      rsvpResponse = await db.get(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [rehearsalId, userId, response, notes || null]
      );
      console.log('[RSVP] Created response:', rsvpResponse);
    }

    // Calculate updated stats
    const responses = await db.all(
      'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = $1',
      [rehearsalId]
    );

    const allMembers = await db.all(
      "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
      [rehearsal.project_id]
    );

    const respondedUserIds = responses.map(r => r.user_id);
    const invited = allMembers.filter(m => !respondedUserIds.includes(m.user_id)).length;

    const stats = {
      confirmed: responses.filter(r => r.response === 'yes').length,
      declined: responses.filter(r => r.response === 'no').length,
      tentative: responses.filter(r => r.response === 'maybe').length,
      invited: invited,
    };

    console.log('[RSVP] Updated stats:', stats);

    res.json({
      response: wasDeleted ? null : {
        id: String(rsvpResponse.id),
        rehearsalId: String(rsvpResponse.rehearsal_id),
        userId: String(rsvpResponse.user_id),
        response: rsvpResponse.response,
        notes: rsvpResponse.notes,
        createdAt: rsvpResponse.created_at,
        updatedAt: rsvpResponse.updated_at,
      },
      stats, // Return updated stats
    });
  } catch (error) {
    console.error('Error submitting RSVP:', error);
    res.status(500).json({ error: 'Failed to submit RSVP' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/responses - Get all responses for a rehearsal
router.get('/:rehearsalId/responses', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [rehearsal.project_id, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all responses with user info
    const responses = await db.all(
      `SELECT r.*, u.first_name, u.last_name, u.email
       FROM native_rehearsal_responses r
       JOIN native_users u ON r.user_id = u.id
       WHERE r.rehearsal_id = $1
       ORDER BY r.created_at DESC`,
      [rehearsalId]
    );

    // Get total project members to calculate who hasn't responded
    const allMembers = await db.all(
      "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
      [rehearsal.project_id]
    );

    // Calculate how many members haven't responded
    const respondedUserIds = responses.map(r => r.user_id);
    const invited = allMembers.filter(m => !respondedUserIds.includes(m.user_id)).length;

    // Calculate stats
    const stats = {
      confirmed: responses.filter(r => r.response === 'yes').length,
      declined: responses.filter(r => r.response === 'no').length,
      tentative: responses.filter(r => r.response === 'maybe').length,
      invited: invited,
    };

    // Get all project members with their info
    const allMembersWithInfo = await db.all(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM native_project_members pm
       JOIN native_users u ON pm.user_id = u.id
       WHERE pm.project_id = $1 AND pm.status = 'active'
       ORDER BY u.first_name, u.last_name`,
      [rehearsal.project_id]
    );

    // Create a map of user responses for quick lookup
    const responseMap = new Map();
    responses.forEach(r => {
      responseMap.set(r.user_id, r.response);
    });

    // Combine all members with their response status
    const allParticipants = allMembersWithInfo.map(member => ({
      userId: String(member.id),
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      response: responseMap.get(member.id) || null, // null if no response
    }));

    console.log('[Responses] Returning data:', {
      responsesCount: responses.length,
      allParticipantsCount: allParticipants.length,
      stats,
    });

    res.json({
      responses: responses.map(r => ({
        id: String(r.id),
        rehearsalId: String(r.rehearsal_id),
        userId: String(r.user_id),
        response: r.response,
        notes: r.notes,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      allParticipants, // All project members with their response status
      stats,
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/my-response - Get current user's response
router.get('/:rehearsalId/my-response', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [rehearsal.project_id, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user's response
    const response = await db.get(
      'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id = $2',
      [rehearsalId, userId]
    );

    if (!response) {
      return res.json({ response: null });
    }

    res.json({
      response: {
        id: String(response.id),
        rehearsalId: String(response.rehearsal_id),
        userId: String(response.user_id),
        response: response.response,
        notes: response.notes,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

export default router;
