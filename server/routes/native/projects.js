import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';

const router = Router();

// GET /api/native/projects - Get user's projects
router.get('/', requireAuth, async (req, res) => {
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
router.post('/', requireAuth, async (req, res) => {
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
router.get('/:projectId', requireAuth, async (req, res) => {
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

export default router;
