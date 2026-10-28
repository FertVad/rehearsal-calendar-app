import { Router } from 'express';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { limitInviteIp, limitInviteAccount } from '../../middleware/inviteRateLimit.js';
import { isInviteCode } from '../../utils/inviteCodes.js';
import { notifyMemberJoined } from '../../services/notifications/pushNotificationService.js';
import { fullName } from '../../utils/names.js';

const router = Router();
const validateInviteCode = (req, res, next) => {
  if (!isInviteCode(req.params.code)) return res.status(404).json({ error: 'Invite not found' });
  next();
};

// GET /api/native/invite/:code - Get invite info (public, for preview before joining)
router.get('/:code', limitInviteIp, validateInviteCode, asyncHandler(async (req, res) => {
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
}));

// POST /api/native/invite/:code/join - Join project using invite
const joinHandlers = [limitInviteIp, requireAuth, limitInviteAccount, validateInviteCode, asyncHandler(async (req, res) => {
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

    // Send push notification to the user who just joined
    try {
      // Told to whoever runs the project, not to the person who just joined —
      // they tapped Join a moment ago. On a shared invite link the owner would
      // otherwise have no way to notice someone arriving.
      const runners = await db.all(
        `SELECT user_id FROM native_project_members
         WHERE project_id = $1 AND status = 'active' AND role IN ('owner', 'admin') AND user_id <> $2`,
        [project.id, userId]
      );

      if (runners.length > 0) {
        const joiner = await db.get(
          'SELECT first_name, last_name FROM native_users WHERE id = $1',
          [userId]
        );
        const joinerName = fullName(joiner);
        await notifyMemberJoined(project.name, joinerName, runners.map((r) => r.user_id));
      }
    } catch (notifErr) {
      logger.error('[Invites] Could not announce the new member:', notifErr);
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
})];
router.post('/:code/join', ...joinHandlers);

// Retained compatibility path, wired to the identical operation chain.
export const legacyProjectInviteRedemptionRouter = Router();
legacyProjectInviteRedemptionRouter.post('/:code/join', ...joinHandlers);

export default router;
