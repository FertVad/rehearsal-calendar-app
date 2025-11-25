import { Router } from 'express';
import crypto from 'crypto';
import db from '../database/db.js';
import { requireAuth } from '../middleware/jwtMiddleware.js';

// Generate unique invite code
function generateInviteCode() {
  return crypto.randomBytes(16).toString('hex');
}

// Generate invite URL based on environment
function generateInviteUrl(inviteCode) {
  // In development: Use Expo dev server URL (for testing)
  // In production: Use the production app scheme
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (isDevelopment) {
    // For local development with Expo Go
    const devHost = process.env.DEV_HOST || '192.168.1.38:8081';
    return `exp://${devHost}/--/invite/${inviteCode}`;
  } else {
    // For production builds (standalone apps)
    return `rehearsalapp://invite/${inviteCode}`;
  }
}

/**
 * Router for React Native app endpoints (non-Telegram)
 * These endpoints work with regular user accounts (email/password)
 */
const router = Router();

// Helper to format date as YYYY-MM-DD string
function formatDateString(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    // Already a string, but might be ISO format
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(date);
}

// GET /api/native/projects - Get user's projects
router.get('/projects', requireAuth, async (req, res) => {
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

    res.json({
      projects: projects.map(p => ({
        id: String(p.id),
        name: p.name,
        description: p.description || '',
        timezone: p.timezone || 'Asia/Jerusalem',
        is_admin: Boolean(p.is_admin),
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/native/projects - Create new project
router.post('/projects', requireAuth, async (req, res) => {
  try {
    const accountId = req.userId;
    const { name, description, timezone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Create project in native_projects table
    const projectTimezone = timezone || 'Asia/Jerusalem';
    const newProject = await db.get(
      'INSERT INTO native_projects (name, description, timezone, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [name, description || null, projectTimezone]
    );

    const projectId = newProject.id;

    // Add creator as owner member
    await db.run(
      'INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
      [projectId, accountId, 'owner', 'active']
    );

    res.status(201).json({
      project: {
        id: String(newProject.id),
        name: newProject.name,
        description: newProject.description || '',
        timezone: newProject.timezone || 'Asia/Jerusalem',
        is_admin: true,
        created_at: newProject.created_at,
        updated_at: newProject.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/native/projects/:projectId - Get single project
router.get('/projects/:projectId', requireAuth, async (req, res) => {
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
        timezone: project.timezone || 'Asia/Jerusalem',
        is_admin: membership.role === 'owner' || membership.role === 'admin',
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// GET /api/native/projects/:projectId/members - Get project members
router.get('/projects/:projectId/members', requireAuth, async (req, res) => {
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

// GET /api/native/projects/:projectId/rehearsals - Get project rehearsals
router.get('/projects/:projectId/rehearsals', requireAuth, async (req, res) => {
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

    const rehearsals = await db.all(
      'SELECT * FROM native_rehearsals WHERE project_id = $1 ORDER BY date DESC, start_time DESC',
      [projectId]
    );

    res.json({
      rehearsals: rehearsals.map(r => ({
        id: String(r.id),
        projectId: String(r.project_id),
        date: formatDateString(r.date),
        time: r.start_time,
        endTime: r.end_time,
        location: r.location || '',
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching rehearsals:', error);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
});

// POST /api/native/projects/:projectId/rehearsals - Create rehearsal
router.post('/projects/:projectId/rehearsals', requireAuth, async (req, res) => {
  try {
    const accountId = req.userId;
    const projectId = req.params.projectId;
    const { date, time, end_time, location } = req.body;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, accountId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can create rehearsals' });
    }

    if (!date || !time) {
      return res.status(400).json({ error: 'Date and time are required' });
    }

    const result = await db.get(
      `INSERT INTO native_rehearsals
       (project_id, date, start_time, end_time, location, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled') RETURNING *`,
      [projectId, date, time, end_time || time, location || '', accountId]
    );

    const rehearsal = result;

    res.status(201).json({
      rehearsal: {
        id: String(rehearsal.id),
        projectId: String(rehearsal.project_id),
        date: formatDateString(rehearsal.date),
        time: rehearsal.start_time,
        endTime: rehearsal.end_time,
        location: rehearsal.location || '',
        status: rehearsal.status,
        createdAt: rehearsal.created_at,
        updatedAt: rehearsal.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating rehearsal:', error);
    res.status(500).json({ error: 'Failed to create rehearsal' });
  }
});

// PUT /api/native/projects/:projectId/rehearsals/:rehearsalId - Update rehearsal
router.put('/projects/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const accountId = req.userId;
    const { projectId, rehearsalId } = req.params;
    const { date, time, end_time, location, status } = req.body;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, accountId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can update rehearsals' });
    }

    await db.run(
      `UPDATE native_rehearsals
       SET date = $1, start_time = $2, end_time = $3, location = $4, status = $5, updated_at = NOW()
       WHERE id = $6 AND project_id = $7`,
      [date, time, end_time || time, location || '', status || 'scheduled', rehearsalId, projectId]
    );

    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);

    res.json({
      rehearsal: {
        id: String(rehearsal.id),
        projectId: String(rehearsal.project_id),
        date: formatDateString(rehearsal.date),
        time: rehearsal.start_time,
        endTime: rehearsal.end_time,
        location: rehearsal.location || '',
        status: rehearsal.status,
        createdAt: rehearsal.created_at,
        updatedAt: rehearsal.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating rehearsal:', error);
    res.status(500).json({ error: 'Failed to update rehearsal' });
  }
});

// DELETE /api/native/projects/:projectId/rehearsals/:rehearsalId - Delete rehearsal
router.delete('/projects/:projectId/rehearsals/:rehearsalId', requireAuth, async (req, res) => {
  try {
    const accountId = req.userId;
    const { projectId, rehearsalId } = req.params;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, accountId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can delete rehearsals' });
    }

    await db.run('DELETE FROM native_rehearsals WHERE id = $1 AND project_id = $2', [rehearsalId, projectId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rehearsal:', error);
    res.status(500).json({ error: 'Failed to delete rehearsal' });
  }
});

// POST /api/native/rehearsals/:rehearsalId/respond - Submit RSVP response
router.post('/rehearsals/:rehearsalId/respond', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;
    const { status, notes } = req.body; // status: 'confirmed' | 'declined' | 'tentative'

    // Validate status
    const validStatuses = ['confirmed', 'declined', 'tentative'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: confirmed, declined, or tentative' });
    }

    // Check if rehearsal exists
    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);
    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    // Check if user is a member of the project
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [rehearsal.project_id, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You must be a project member to respond' });
    }

    // Insert or update response
    const existing = await db.get(
      'SELECT * FROM native_rehearsal_participants WHERE rehearsal_id = $1 AND user_id = $2',
      [rehearsalId, userId]
    );

    if (existing) {
      await db.run(
        `UPDATE native_rehearsal_participants
         SET status = $1, response_at = NOW(), notes = $2
         WHERE rehearsal_id = $3 AND user_id = $4`,
        [status, notes || null, rehearsalId, userId]
      );
    } else {
      await db.run(
        `INSERT INTO native_rehearsal_participants (rehearsal_id, user_id, status, response_at, notes)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [rehearsalId, userId, status, notes || null]
      );
    }

    res.json({
      success: true,
      status,
      message: status === 'confirmed' ? 'Репетиция подтверждена' :
               status === 'declined' ? 'Вы отказались от репетиции' :
               'Ваш ответ записан'
    });
  } catch (error) {
    console.error('Error submitting RSVP:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/responses - Get RSVP responses (for admin)
router.get('/rehearsals/:rehearsalId/responses', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    // Get rehearsal and check project membership
    const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);
    if (!rehearsal) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
      [rehearsal.project_id, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all responses with user info
    const responses = await db.all(
      `SELECT rp.*, u.first_name, u.last_name, u.email
       FROM native_rehearsal_participants rp
       INNER JOIN native_users u ON rp.user_id = u.id
       WHERE rp.rehearsal_id = $1
       ORDER BY rp.response_at DESC`,
      [rehearsalId]
    );

    // Get statistics
    const stats = {
      total: responses.length,
      confirmed: responses.filter(r => r.status === 'confirmed').length,
      declined: responses.filter(r => r.status === 'declined').length,
      tentative: responses.filter(r => r.status === 'tentative').length,
      invited: responses.filter(r => r.status === 'invited').length,
    };

    res.json({
      responses: responses.map(r => ({
        userId: String(r.user_id),
        userName: `${r.first_name} ${r.last_name || ''}`.trim(),
        email: r.email,
        status: r.status,
        responseAt: r.response_at,
        notes: r.notes,
      })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// GET /api/native/rehearsals/:rehearsalId/my-response - Get user's own response
router.get('/rehearsals/:rehearsalId/my-response', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rehearsalId } = req.params;

    const response = await db.get(
      'SELECT * FROM native_rehearsal_participants WHERE rehearsal_id = $1 AND user_id = $2',
      [rehearsalId, userId]
    );

    res.json({
      response: response ? {
        status: response.status,
        responseAt: response.response_at,
        notes: response.notes,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching my response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

// ==========================================
// PROJECT INVITES
// ==========================================

// POST /api/native/projects/:projectId/invite - Create invite link
router.post('/projects/:projectId/invite', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { expiresInDays = 7 } = req.body;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can create invite links' });
    }

    // Generate unique invite code
    const inviteCode = generateInviteCode();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Check if there's already an active invite for this project
    const project = await db.get(
      "SELECT * FROM native_projects WHERE id = $1",
      [projectId]
    );

    if (project && project.invite_code && project.invite_expires_at && new Date(project.invite_expires_at) > new Date()) {
      // Return existing invite
      return res.json({
        inviteCode: project.invite_code,
        expiresAt: project.invite_expires_at,
        inviteUrl: generateInviteUrl(project.invite_code),
      });
    }

    // Update project with new invite code
    await db.run(
      `UPDATE native_projects SET invite_code = $1, invite_expires_at = $2, invite_created_by = $3 WHERE id = $4`,
      [inviteCode, expiresAt, userId, projectId]
    );

    res.json({
      inviteCode,
      expiresAt: expiresAt.toISOString(),
      inviteUrl: generateInviteUrl(inviteCode),
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// GET /api/native/projects/:projectId/invite - Get current invite link
router.get('/projects/:projectId/invite', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can view invite links' });
    }

    // Get active invite from project
    const project = await db.get(
      "SELECT * FROM native_projects WHERE id = $1",
      [projectId]
    );

    if (!project || !project.invite_code) {
      return res.json({ invite: null });
    }

    // Check if expired
    if (project.invite_expires_at && new Date(project.invite_expires_at) < new Date()) {
      return res.json({ invite: null });
    }

    res.json({
      invite: {
        inviteCode: project.invite_code,
        expiresAt: project.invite_expires_at,
        inviteUrl: generateInviteUrl(project.invite_code),
      },
    });
  } catch (error) {
    console.error('Error getting invite:', error);
    res.status(500).json({ error: 'Failed to get invite' });
  }
});

// GET /api/native/invite/:code - Get invite info (public, for preview before joining)
router.get('/invite/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Get project by invite code
    const project = await db.get(
      `SELECT * FROM native_projects WHERE invite_code = $1`,
      [code]
    );

    if (!project) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if expired
    if (project.invite_expires_at && new Date(project.invite_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite has expired' });
    }

    res.json({
      projectId: String(project.id),
      projectName: project.name,
      projectDescription: project.description,
      expiresAt: project.invite_expires_at,
    });
  } catch (error) {
    console.error('Error getting invite info:', error);
    res.status(500).json({ error: 'Failed to get invite info' });
  }
});

// POST /api/native/invite/:code/join - Join project using invite
router.post('/invite/:code/join', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { code } = req.params;

    // Get project by invite code
    const project = await db.get(
      `SELECT * FROM native_projects WHERE invite_code = $1`,
      [code]
    );

    if (!project) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if expired
    if (project.invite_expires_at && new Date(project.invite_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite has expired' });
    }

    // Check if user is already a member
    const existingMembership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2",
      [project.id, userId]
    );

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return res.status(400).json({ error: 'You are already a member of this project' });
      }
      // Reactivate membership
      await db.run(
        "UPDATE native_project_members SET status = 'active', joined_at = NOW() WHERE id = $1",
        [existingMembership.id]
      );
    } else {
      // Create new membership
      await db.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
         VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
        [project.id, userId]
      );
    }

    res.json({
      success: true,
      projectId: String(project.id),
      projectName: project.name,
      message: 'Successfully joined the project',
    });
  } catch (error) {
    console.error('Error joining project:', error);
    res.status(500).json({ error: 'Failed to join project' });
  }
});

// DELETE /api/native/projects/:projectId/invite - Revoke invite link
router.delete('/projects/:projectId/invite', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin
    const membership = await db.get(
      "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'",
      [projectId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can revoke invite links' });
    }

    // Clear invite code from project
    await db.run(
      "UPDATE native_projects SET invite_code = NULL, invite_expires_at = NULL, invite_created_by = NULL WHERE id = $1",
      [projectId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking invite:', error);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

export default router;
