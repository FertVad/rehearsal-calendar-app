import { asyncHandler } from '../../middleware/asyncHandler.js';
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
  getRehearsalById,
  RehearsalTimesInvalid,
} from '../../services/rehearsals/rehearsalService.js';
import {
  markRehearsal,
  getRehearsalResponses,
  getUserResponse,
} from '../../services/rehearsals/rsvpService.js';
import { fullName } from '../../utils/names.js';
import { rosterOf, viewerOf, RosterRefused } from '../../services/rehearsals/roster.js';
import { idempotencyKeyOf, IdempotencyRefused } from '../../services/idempotency.js';
import {
  notifyRehearsalCreated,
  notifyRehearsalUpdated,
  notifyRehearsalDeleted,
  notifyAddedToRehearsal,
  notifyRemovedFromRehearsal,
  notifyMemberResponse,
} from '../../services/notifications/pushNotificationService.js';

const router = Router();

// GET /api/native/rehearsals/batch?projectIds=1,2,3 - Get rehearsals for multiple projects (Performance optimization)
router.get('/batch', requireAuth, asyncHandler(async (req, res) => {
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
}));

// GET /api/native/projects/:projectId/rehearsals - Get rehearsals where user is invited
router.get('/:projectId/rehearsals', requireAuth, asyncHandler(async (req, res) => {
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
}));

// POST /api/native/projects/:projectId/rehearsals - Create a new rehearsal
router.post('/:projectId/rehearsals', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin/owner
    const isAdmin = await checkUserIsAdmin(projectId, userId);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can create rehearsals' });
    }

    const { rehearsal, replayed } = await createRehearsal(projectId, userId, req.body, idempotencyKeyOf(req));

    // A repeat of a create that already happened: the same answer, and the
    // people on it were told the first time.
    if (replayed) return res.status(201).json({ rehearsal });

    // Tell the people who are on this rehearsal, not the whole project.
    //
    // The app only ever shows a rehearsal to the people on it (roster.js).
    // Notifying everyone announced rehearsals that never appeared in the
    // recipient's calendar and could not be opened from the notification either.
    try {
      const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [projectId]);
      const members = await rosterOf(db, rehearsal.id);

      // Everyone on it except whoever scheduled it — they were there. This used
      // to be done inside the notifier, against a created_by the service did
      // not return, so it compared with undefined and excluded nobody: the
      // author was told about their own rehearsal.
      const toNotify = members.filter((m) => Number(m.user_id) !== Number(userId));
      await notifyRehearsalCreated(rehearsal, project.name, toNotify);
    } catch (notifErr) {
      console.error('Error sending rehearsal created notification:', notifErr);
    }

    res.status(201).json({ rehearsal });
  } catch (error) {
    if (error instanceof RosterRefused || error instanceof IdempotencyRefused || error instanceof RehearsalTimesInvalid) {
      return res.status(error.status).json(error.body);
    }
    console.error('Error creating rehearsal:', error);
    if (error.message === 'Invalid date format' || error.message.includes('are required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create rehearsal' });
  }
}));

// PUT /api/native/projects/:projectId/rehearsals/:rehearsalId - Update a rehearsal
router.put('/:projectId/rehearsals/:rehearsalId', requireAuth, asyncHandler(async (req, res) => {
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

    const edit = await updateRehearsal(rehearsalId, projectId, req.body);

    // Deleted between the check above and the edit.
    if (!edit) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }
    const updatedRehearsal = edit.rehearsal;

    // The roster, not the project — see the note on creation. Who was put on
    // it, taken off it and left on it comes from the edit's own transaction,
    // the roster read before and after it was settled (T-233).
    //
    // One save, one notification each. Whoever made the change gets none.
    // Someone added is told they are on it, as of a new rehearsal, and not
    // also that its time moved; someone removed is told so, as of a
    // cancellation — it is gone from their calendar and they know why. Only
    // those who were on it and stay are told what changed, and only when
    // something they can see did.
    try {
      const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [projectId]);
      const others = (ids) => ids.filter((id) => id !== Number(userId)).map((id) => ({ user_id: id }));
      const added = others(edit.added);
      const removed = others(edit.removed);
      const toNotify = others(edit.kept);

      if (added.length > 0) {
        await notifyAddedToRehearsal(updatedRehearsal, project.name, added);
      }
      if (removed.length > 0) {
        await notifyRemovedFromRehearsal(updatedRehearsal, project.name, removed);
      }

      // What actually changed, not what the request happened to carry. The app
      // sends the whole form on save, so listing every field that arrived meant
      // every edit announced "date/time, location, title" whatever was touched.
      //
      // The start and the length apart: a rehearsal made an hour longer did
      // not move, and "moved to today at 19:00" lost the new end (T-250).
      // 'datetime' — the start moved; 'end' — it ends other than the move
      // alone would put it, i.e. it got longer or shorter.
      const changeKeys = [];
      const ms = (value) => new Date(value).getTime();
      const startShift = ms(updatedRehearsal.startsAt) - ms(rehearsal.starts_at);
      const endShift = ms(updatedRehearsal.endsAt) - ms(rehearsal.ends_at);
      if (startShift !== 0) changeKeys.push('datetime');
      if (endShift !== startShift) changeKeys.push('end');
      if ((rehearsal.location || '') !== (updatedRehearsal.location || '')) changeKeys.push('location');
      if ((rehearsal.title || '') !== (updatedRehearsal.title || '')) changeKeys.push('title');

      // Nothing worth announcing to those who stay when nothing visible
      // changed; those added or removed were told above.
      if (changeKeys.length > 0 && toNotify.length > 0) {
        await notifyRehearsalUpdated(updatedRehearsal, project.name, toNotify, changeKeys);
      }
    } catch (notifErr) {
      console.error('Error sending rehearsal updated notification:', notifErr);
    }

    res.json({ rehearsal: updatedRehearsal });
  } catch (error) {
    if (error instanceof RosterRefused || error instanceof RehearsalTimesInvalid) {
      return res.status(error.status).json(error.body);
    }
    console.error('Error updating rehearsal:', error);
    if (error.message === 'Invalid date format' || error.message.includes('are required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update rehearsal' });
  }
}));

// DELETE /api/native/projects/:projectId/rehearsals/:rehearsalId - Delete a rehearsal
router.delete('/:projectId/rehearsals/:rehearsalId', requireAuth, asyncHandler(async (req, res) => {
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
    const members = await rosterOf(db, rehearsal.id);

    await deleteRehearsal(rehearsalId, projectId);

    // Send push notifications after deletion
    try {
      // Whoever cancelled it knows. Everyone else on it does not.
      const toNotify = members.filter((m) => Number(m.user_id) !== Number(userId));

      if (toNotify.length > 0) {
        await notifyRehearsalDeleted(rehearsal, project.name, toNotify);
      }
    } catch (notifErr) {
      console.error('Error sending rehearsal deleted notification:', notifErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rehearsal:', error);
    res.status(500).json({ error: 'Failed to delete rehearsal' });
  }
}));

// POST /api/native/rehearsals/:rehearsalId/respond - RSVP to a rehearsal
router.post('/:rehearsalId/respond', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;
    const { response, notes } = req.body;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Someone who may not see it gets the same answer as for one that does not
    // exist. Seeing is not enough to answer: an admin not on it is refused by
    // the service, which never puts anyone on a rehearsal (roster.js).
    if (!(await viewerOf(db, rehearsal, userId))) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const { stats, announce } = await markRehearsal(rehearsalId, userId, response, notes);

    // The admins hear of a "seen" once per person, and again only after the
    // rehearsal has moved; unmarking tells nobody (seenNotice.js).
    if (announce) {
      try {
        const responder = await db.get('SELECT first_name, last_name FROM native_users WHERE id = ?', [userId]);
        const project = await db.get('SELECT name FROM native_projects WHERE id = ?', [rehearsal.project_id]);
        const admins = await db.all(
          `SELECT user_id FROM native_project_members
           WHERE project_id = ? AND role IN ('owner', 'admin') AND status = 'active' AND user_id != ?`,
          [rehearsal.project_id, userId]
        );

        if (admins.length > 0) {
          const responderName = fullName(responder);
          const adminIds = admins.map(a => a.user_id);
          await notifyMemberResponse(rehearsal, project.name, responderName, adminIds);
        }
      } catch (notifErr) {
        console.error('Error sending member response notification:', notifErr);
      }
    }

    res.json(stats);
  } catch (error) {
    if (error instanceof RosterRefused) return res.status(error.status).json(error.body);
    console.error('Error responding to rehearsal:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
}));

// GET /api/native/rehearsals/:rehearsalId/responses - Get all responses for a rehearsal
router.get('/:rehearsalId/responses', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Visible to whoever may see the rehearsal itself, and to nobody else — the
    // cast of a rehearsal is not for project members who are not on it.
    if (!(await viewerOf(db, rehearsal, userId))) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const result = await getRehearsalResponses(rehearsalId);

    res.json(result);
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
}));

// GET /api/native/rehearsals/:rehearsalId - One rehearsal, by id
//
// The details screen is reached by id — from a card, a tapped notification, and
// in time a link from outside the app — so it cannot depend on the caller
// already holding the object.
//
// A rehearsal the caller may not see answers 404, the same as one that does not
// exist: telling the two apart would confirm that a given id belongs to someone
// else's project.
router.get('/:rehearsalId', requireAuth, asyncHandler(async (req, res) => {
  try {
    const rehearsal = await getRehearsalById(req.params.rehearsalId, req.userId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    res.json({ rehearsal });
  } catch (error) {
    logger.error('[Rehearsals] Fetch by id failed:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsal' });
  }
}));

// GET /api/native/rehearsals/:rehearsalId/my-response - Get user's response
router.get('/:rehearsalId/my-response', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Check if rehearsal exists and get project
    const rehearsal = await checkRehearsalExists(rehearsalId);

    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Visible to whoever may see the rehearsal itself, and to nobody else — the
    // cast of a rehearsal is not for project members who are not on it.
    if (!(await viewerOf(db, rehearsal, userId))) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const response = await getUserResponse(rehearsalId, userId);

    res.json({ response });
  } catch (error) {
    console.error('Error fetching user response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
}));

export default router;
