import { asyncHandler } from '../../middleware/asyncHandler.js';
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { notifyProjectDeleted } from '../../services/notifications/pushNotificationService.js';
import { DEFAULT_TIMEZONE } from '../../constants/timezone.js';
import { idempotencyKeyOf, IdempotencyRefused, once } from '../../services/idempotency.js';
import { lockProject } from '../../services/rehearsals/projectLock.js';

const router = Router();

// GET /api/native/projects - Get user's projects
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const accountId = req.userId;

    // Get projects where user is a member
    const projects = await db.all(
      `SELECT p.*,
              CASE WHEN pm.role IN ('owner', 'admin') THEN true ELSE false END as is_admin
       FROM native_projects p
       INNER JOIN native_project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = $1 AND pm.status = 'active'
       ORDER BY p.created_at DESC`,
      [accountId]
    );

    const now = new Date();

    res.json({
      projects: projects.map(p => {
        const isAdmin = Boolean(p.is_admin);
        const inviteLive =
          Boolean(p.invite_code) &&
          Boolean(p.invite_expires_at) &&
          new Date(p.invite_expires_at) > now;

        return {
          id: String(p.id),
          name: p.name,
          description: p.description || '',
          timezone: p.timezone || DEFAULT_TIMEZONE,
          is_admin: isAdmin,
          // Carried here so the list can offer the code without a request per
          // card. Admins only, and only while it is still good — for everyone
          // else this is a way into the project they were never given.
          inviteCode: isAdmin && inviteLive ? p.invite_code : null,
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}));

// POST /api/native/projects - Create new project
// Free for everyone: the paid tier is gone. If money is ever taken it goes
// through App Store in-app purchase — see docs/app-store-release.md
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const accountId = req.userId;
    const { name, description, timezone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // The project and its owner, one transaction (R4: B02). Committed apart, a
    // failure between them left a project nobody owns — nobody could see,
    // delete or hand it on. A repeat with the same key gets the same project
    // back instead of a second one (services/idempotency.js).
    const key = idempotencyKeyOf(req);
    const projectTimezone = timezone || DEFAULT_TIMEZONE;
    const { response: project } = await db.transaction((tx) => once(tx, {
      userId: accountId,
      key,
      operation: 'project.create',
      request: req.body,
    }, async () => {
      const created = await tx.get(
        'INSERT INTO native_projects (name, description, timezone, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
        [name, description || null, projectTimezone]
      );
      await tx.run(
        'INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [created.id, accountId, 'owner', 'active']
      );
      return {
        id: String(created.id),
        name: created.name,
        description: created.description || '',
        timezone: created.timezone || DEFAULT_TIMEZONE,
        is_admin: true,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };
    }));

    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof IdempotencyRefused) return res.status(error.status).json(error.body);
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
}));

// GET /api/native/projects/:projectId - Get single project
router.get('/:projectId', requireAuth, asyncHandler(async (req, res) => {
  try {
    const accountId = req.userId;
    const projectId = req.params.projectId;

    // Check if user is a member
    const membership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, accountId, 'active']
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await db.get('SELECT * FROM native_projects WHERE id = $1', [projectId]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: {
        id: String(project.id),
        name: project.name,
        description: project.description || '',
        timezone: project.timezone || DEFAULT_TIMEZONE,
        is_admin: membership.role === 'owner' || membership.role === 'admin',
        is_owner: membership.role === 'owner',
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}));

// DELETE /api/native/projects/:projectId - Delete project
router.delete('/:projectId', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is the owner
    const membership = await db.get(
      'SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = $3',
      [projectId, userId, 'active']
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can delete the project' });
    }

    // Check if project exists
    const project = await db.get('SELECT * FROM native_projects WHERE id = $1', [projectId]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all members BEFORE deletion (excluding owner)
    const members = await db.all(
      "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active' AND user_id != $2",
      [projectId, userId]
    );

    // The busy slots these rehearsals put on people's calendars go first.
    //
    // The cascade cannot reach them: native_user_availability is tied to a
    // rehearsal only by source='rehearsal' and an external_event_id holding the
    // id as text, which is no foreign key. Left behind they are permanent —
    // read-only in the editor, untouched by marking a day free (that clears
    // source='manual'), and reachable by no endpoint once the project they name
    // is gone. And they are not confined to this project: the members endpoint
    // returns availability with no source filter, so those hours would make
    // someone look unavailable in every other project's planner, forever.
    //
    // Must run before the project, or the subselect has nothing left to find —
    // and in the same transaction (R4: B02): committed alone, a failure of the
    // delete below left every rehearsal standing with nobody busy for it.
    //
    // The project row is locked first (projectLock.js): a rehearsal still being
    // created is committed before the slots are looked for, not cascaded away
    // afterwards with its slots left behind.
    await db.transaction(async (tx) => {
      await lockProject(tx, projectId, 'delete');

      await tx.run(
        `DELETE FROM native_user_availability
         WHERE source = 'rehearsal'
         AND external_event_id IN (SELECT CAST(id AS TEXT) FROM native_rehearsals WHERE project_id = $1)`,
        [projectId]
      );

      // Delete project (CASCADE will automatically delete all related data)
      await tx.run('DELETE FROM native_projects WHERE id = $1', [projectId]);
    });

    // Send push notifications to all members
    if (members.length > 0) {
      try {
        const memberIds = members.map(m => m.user_id);
        await notifyProjectDeleted(project.name, memberIds);
      } catch (notifErr) {
        console.error('Error sending project deleted notification:', notifErr);
      }
    }

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
}));

export default router;
