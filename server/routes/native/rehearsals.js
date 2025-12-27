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

// GET /api/native/projects/:projectId/rehearsals - Get all rehearsals for a project
router.get('/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is a member
    const membership = await checkUserMembership(projectId, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rehearsals = await getProjectRehearsals(projectId);

    res.json({ rehearsals });
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

    // Check if user is admin/owner
    const isAdmin = await checkUserIsAdmin(projectId, userId);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can create rehearsals' });
    }

    const rehearsal = await createRehearsal(projectId, userId, req.body);

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

    await deleteRehearsal(rehearsalId);

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

    const responses = await getRehearsalResponses(rehearsalId);

    res.json({ responses });
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
