import { asyncHandler } from '../../middleware/asyncHandler.js';
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { getActiveAdminMembership } from '../../utils/projectAuth.js';
import { generateInviteCode, isShortCode } from '../../utils/inviteCodes.js';

const router = Router();

function generateInviteUrl(inviteCode) {
  if (process.env.NODE_ENV === 'development') {
    return `rehearsalapp://invite/${inviteCode}`;
  }
  const baseUrl = process.env.BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
  return `${baseUrl}/invite/${inviteCode}`;
}

// POST /api/native/projects/:projectId/invite - Create invite link
router.post('/:projectId/invite', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { expiresInDays = 7 } = req.body;

    // Check if user is admin
    const membership = await getActiveAdminMembership(projectId, userId);

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

    // A live invite is reused so the link stays stable — unless it predates
    // the short codes, in which case it is replaced: a thirty-two character
    // string is exactly what nobody can pass on by voice, which is the reason
    // the short ones exist.
    if (
      project &&
      project.invite_code &&
      isShortCode(project.invite_code) &&
      project.invite_expires_at &&
      new Date(project.invite_expires_at) > new Date()
    ) {
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
      // An ISO string, not the Date itself — the convention everywhere else
      // here, and the only form both engines accept.
      [inviteCode, expiresAt.toISOString(), userId, projectId]
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
}));

// GET /api/native/projects/:projectId/invite - Get current invite link
router.get('/:projectId/invite', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin
    const membership = await getActiveAdminMembership(projectId, userId);

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
}));

// DELETE /api/native/projects/:projectId/invite - Revoke invite link
router.delete('/:projectId/invite', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    // Check if user is admin
    const membership = await getActiveAdminMembership(projectId, userId);

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
}));

export default router;
