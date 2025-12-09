import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { localToUTC, utcToLocal } from '../../utils/timezone.js';
import { convertRehearsalRequest } from '../../middleware/timezoneMiddleware.js';
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
 * @param {Object} startUTC - Start date/time in UTC
 * @param {Object} endUTC - End date/time in UTC
 */
async function bookRehearsalSlots(rehearsalId, projectId, startUTC, endUTC) {
  // Get all project members
  const members = await db.all(
    "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
    [projectId]
  );

  // For each member, insert a busy slot
  for (const member of members) {
    await db.run(
      `INSERT INTO native_user_availability (user_id, date, start_time, end_time, type, source, external_event_id, title, is_all_day)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, 'Rehearsal', FALSE)`,
      [
        member.user_id,
        startUTC.date,
        startUTC.time,
        endUTC.time,
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
 * @param {Object} startUTC - New start date/time in UTC
 * @param {Object} endUTC - New end date/time in UTC
 */
async function updateRehearsalSlots(rehearsalId, projectId, startUTC, endUTC) {
  console.log('[updateRehearsalSlots] Updating slots for rehearsal:', {
    rehearsalId,
    projectId,
    startUTC,
    endUTC,
  });

  // Delete existing booked slots
  await deleteRehearsalSlots(rehearsalId);

  // Book new slots
  await bookRehearsalSlots(rehearsalId, projectId, startUTC, endUTC);
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

    // Get all rehearsals for the project
    const rehearsals = await db.all(
      `SELECT * FROM native_rehearsals
       WHERE project_id = $1
       ORDER BY date DESC, start_time DESC`,
      [projectId]
    );

    res.json({
      rehearsals: rehearsals.map(r => {
        // Convert UTC to local timezone
        const localStart = utcToLocal(formatDateString(r.date), r.start_time, timezone);
        const localEnd = utcToLocal(formatDateString(r.date), r.end_time, timezone);

        return {
          id: String(r.id),
          projectId: String(r.project_id),
          title: r.title,
          description: r.description,
          date: localStart.date,  // Return date in local timezone
          time: localStart.time,  // Add 'time' field for backward compatibility
          startTime: localStart.time,
          endTime: localEnd.time,
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
    const { title, description, date, startTime, endTime, location } = req.body;

    console.log('[Create Rehearsal] Request:', {
      userId,
      projectId,
      title,
      date,
      startTime,
      endTime,
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

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, start time, and end time are required' });
    }

    // Get project timezone
    const timezone = await getProjectTimezone(projectId);
    console.log('[Create Rehearsal] Project timezone:', timezone);

    // Format date properly
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Convert local time to UTC for storage
    const startUTC = localToUTC(formattedDate, startTime, timezone);
    const endUTC = localToUTC(formattedDate, endTime, timezone);

    console.log('[Create Rehearsal] UTC conversion:', {
      formattedDate,
      startTime,
      endTime,
      timezone,
      startUTC,
      endUTC,
    });

    // Create rehearsal
    // Note: Cast date to DATE type to avoid timezone conversion issues in PostgreSQL
    const newRehearsal = await db.get(
      `INSERT INTO native_rehearsals (project_id, date, start_time, end_time, location, created_by, created_at, updated_at)
       VALUES ($1, $2::date, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        projectId,
        startUTC.date,
        startUTC.time,
        endUTC.time,
        location || null,
        userId,
      ]
    );

    console.log('[Create Rehearsal] Created rehearsal:', newRehearsal);

    // Book slots in user availability for all project members
    await bookRehearsalSlots(
      newRehearsal.id,
      projectId,
      startUTC,
      endUTC
    );

    res.status(201).json({
      rehearsal: {
        id: String(newRehearsal.id),
        projectId: String(newRehearsal.project_id),
        title: newRehearsal.title,
        description: newRehearsal.description,
        date: newRehearsal.date,
        startTime: newRehearsal.start_time,
        endTime: newRehearsal.end_time,
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
    const { title, description, date, startTime, endTime, location } = req.body;

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

    // Get project timezone
    const timezone = await getProjectTimezone(projectId);

    // Format date properly
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Convert local time to UTC
    const startUTC = localToUTC(formattedDate, startTime, timezone);
    const endUTC = localToUTC(formattedDate, endTime, timezone);

    // Update rehearsal
    const updatedRehearsal = await db.get(
      `UPDATE native_rehearsals
       SET date = $1, start_time = $2, end_time = $3, location = $4, updated_at = NOW()
       WHERE id = $5 AND project_id = $6
       RETURNING *`,
      [
        startUTC.date,
        startUTC.time,
        endUTC.time,
        location || null,
        rehearsalId,
        projectId,
      ]
    );

    // Update booked slots
    await updateRehearsalSlots(
      rehearsalId,
      projectId,
      startUTC,
      endUTC
    );

    res.json({
      rehearsal: {
        id: String(updatedRehearsal.id),
        projectId: String(updatedRehearsal.project_id),
        title: updatedRehearsal.title,
        description: updatedRehearsal.description,
        date: updatedRehearsal.date,
        startTime: updatedRehearsal.start_time,
        endTime: updatedRehearsal.end_time,
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

    if (existingResponse) {
      // Update existing response
      rsvpResponse = await db.get(
        `UPDATE native_rehearsal_responses
         SET response = $1, notes = $2, updated_at = NOW()
         WHERE rehearsal_id = $3 AND user_id = $4
         RETURNING *`,
        [response, notes || null, rehearsalId, userId]
      );
      console.log('[RSVP] Updated response:', rsvpResponse);
    } else {
      // Create new response
      rsvpResponse = await db.get(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [rehearsalId, userId, response, notes || null]
      );
      console.log('[RSVP] Created response:', rsvpResponse);
    }

    res.json({
      response: {
        id: String(rsvpResponse.id),
        rehearsalId: String(rsvpResponse.rehearsal_id),
        userId: String(rsvpResponse.user_id),
        response: rsvpResponse.response,
        notes: rsvpResponse.notes,
        createdAt: rsvpResponse.created_at,
        updatedAt: rsvpResponse.updated_at,
      },
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

    // Calculate stats
    const stats = {
      confirmed: responses.filter(r => r.response === 'yes').length,
      declined: responses.filter(r => r.response === 'no').length,
      tentative: responses.filter(r => r.response === 'maybe').length,
      invited: 0, // We don't track invited separately yet
    };

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
