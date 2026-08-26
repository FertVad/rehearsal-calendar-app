import { logger } from '../../utils/logger.js';
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import {
  checkUserMembership,
  checkUserIsAdmin,
  checkRehearsalExists,
  getRehearsalsForProjects,
  getProjectRehearsals,
  createRehearsal,
  updateRehearsal,
  deleteRehearsal,
} from '../../services/rehearsals/rehearsalService.js';
import {
  respondToRehearsal,
  getRehearsalResponses,
  getUserResponse,
} from '../../services/rehearsals/rsvpService.js';
import {
  notifyRehearsalCreated,
  notifyRehearsalUpdated,
  notifyRehearsalDeleted,
  notifyMemberResponse,
} from '../../services/notifications/pushNotificationService.js';

const router = Router();

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

    const rehearsals = await getRehearsalsForProjects(projectIdArray, userId);

    res.json({ rehearsals });
  } catch (error) {
    console.error('[Batch Rehearsals] Error:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
});

// GET /api/native/projects/:projectId/rehearsals - Get rehearsals where user is invited
router.get('/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    logger.debug(`[ROUTE] GET /:projectId/rehearsals - projectId: ${projectId}, userId: ${userId}`);

    // Check if user is a member
    const membership = await checkUserMembership(projectId, userId);

    if (!membership) {
      logger.debug(`[ROUTE] Access denied - user ${userId} not a member of project ${projectId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    logger.debug(`[ROUTE] User is a member, calling getProjectRehearsals...`);
    const rehearsals = await getProjectRehearsals(projectId, userId);

    logger.debug(`[ROUTE] Returning ${rehearsals.length} rehearsals`);
    res.json({ rehearsals });
  } catch (error) {
    console.error('[ROUTE] Error fetching rehearsals:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
});

// POST /api/native/projects/:projectId/rehearsals - Create a new rehearsal
router.post('/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin/owner
    const isAdmin = await checkUserIsAdmin(projectId, userId);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can create rehearsals' });
    }

    const rehearsal = await createRehearsal(projectId, userId, req.body);

    // Tell the people who are on this rehearsal, not the whole project.
    //
    // The roster is native_rehearsal_responses, and the app only ever shows a
    // rehearsal to someone who has a row there. Notifying everyone announced
    // rehearsals that never appeared in the recipient's calendar and could not
    // be opened from the notification either.
    try {
      const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [projectId]);
      const members = await db.all(
        'SELECT user_id FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsal.id]
      );
      await notifyRehearsalCreated(rehearsal, project.name, members);
    } catch (notifErr) {
      console.error('Error sending rehearsal created notification:', notifErr);
    }

    res.status(201).json({ rehearsal });
  } catch (error) {
    console.error('Error creating rehearsal:', error);
    if (error.message === 'Invalid date format' || error.message.includes('are required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create rehearsal' });
  }
});

// PUT /api/native/projects/:projectId/rehearsals/:rehearsalId - Update a rehearsal
router.put('/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId, rehearsalId } = req.params;

    // Check if user is admin/owner
    const isAdmin = await checkUserIsAdmin(projectId, userId);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update rehearsals' });
    }

    // Check if rehearsal exists
    const rehearsal = await checkRehearsalExists(rehearsalId, projectId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const updatedRehearsal = await updateRehearsal(rehearsalId, projectId, req.body);

    // The roster, not the project — see the note on creation. Participants are
    // already settled by this point, so newcomers to the rehearsal are included
    // and anyone dropped from it is not.
    try {
      const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [projectId]);
      const members = await db.all(
        'SELECT user_id FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [updatedRehearsal.id]
      );

      // Determine what changed — pass translation keys, service localizes per user
      const changeKeys = [];
      if (req.body.startsAt || req.body.endsAt) changeKeys.push('datetime');
      if (req.body.location) changeKeys.push('location');
      if (req.body.title) changeKeys.push('title');

      await notifyRehearsalUpdated(updatedRehearsal, project.name, members, changeKeys);
    } catch (notifErr) {
      console.error('Error sending rehearsal updated notification:', notifErr);
    }

    res.json({ rehearsal: updatedRehearsal });
  } catch (error) {
    console.error('Error updating rehearsal:', error);
    if (error.message === 'Invalid date format' || error.message.includes('are required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update rehearsal' });
  }
});

// DELETE /api/native/projects/:projectId/rehearsals/:rehearsalId - Delete a rehearsal
router.delete('/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId, rehearsalId } = req.params;

    // Check if user is admin/owner
    const isAdmin = await checkUserIsAdmin(projectId, userId);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can delete rehearsals' });
    }

    // Check if rehearsal exists
    const rehearsal = await checkRehearsalExists(rehearsalId, projectId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // The roster, read BEFORE deletion — those rows go with the rehearsal.
    const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [projectId]);
    const members = await db.all(
      'SELECT user_id FROM native_rehearsal_responses WHERE rehearsal_id = ?',
      [rehearsal.id]
    );

    await deleteRehearsal(rehearsalId);

    // Send push notifications after deletion
    try {
      await notifyRehearsalDeleted(rehearsal, project.name, members);
    } catch (notifErr) {
      console.error('Error sending rehearsal deleted notification:', notifErr);
    }

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
    const { response, notes } = req.body;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member
    const membership = await checkUserMembership(rehearsal.project_id, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await respondToRehearsal(rehearsalId, userId, response, notes, rehearsal.project_id);

    // Send push notifications to admins when member responds
    if (response === 'yes') {
      try {
        const responder = await db.get('SELECT first_name, last_name FROM native_users WHERE id = ?', [userId]);
        const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [rehearsal.project_id]);
        const admins = await db.all(
          `SELECT user_id FROM native_project_members
           WHERE project_id = ? AND role IN ('owner', 'admin') AND status = 'active' AND user_id != ?`,
          [rehearsal.project_id, userId]
        );

        if (admins.length > 0) {
          const responderName = `${responder.first_name}${responder.last_name ? ' ' + responder.last_name : ''}`;
          const adminIds = admins.map(a => a.user_id);
          await notifyMemberResponse(rehearsal, project.name, responderName, adminIds);
        }
      } catch (notifErr) {
        console.error('Error sending member response notification:', notifErr);
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Error responding to rehearsal:', error);
    if (error.message === 'Invalid response value. Must be "yes" or null.') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/responses - Get all responses for a rehearsal
router.get('/:rehearsalId/responses', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member
    const membership = await checkUserMembership(rehearsal.project_id, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await getRehearsalResponses(rehearsalId);

    res.json(result);
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/my-response - Get user's response
router.get('/:rehearsalId/my-response', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member
    const membership = await checkUserMembership(rehearsal.project_id, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const response = await getUserResponse(rehearsalId, userId);

    res.json({ response });
  } catch (error) {
    console.error('Error fetching user response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

export default router;
