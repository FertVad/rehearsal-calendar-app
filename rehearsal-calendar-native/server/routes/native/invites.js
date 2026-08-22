import { Router } from 'express';
import crypto from 'crypto';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import { getActiveAdminMembership } from '../../utils/projectAuth.js';
import { notifyProjectInvite } from '../../services/notifications/pushNotificationService.js';

const router = Router();

// Helper functions
// Crockford's base32 without the letters that get misread when a code is
// dictated or copied off a screen: no I, L, O, U, and no 0 or 1.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A code short enough to read aloud.
 *
 * Eight characters of this alphabet is about 6.5e11 combinations, which is
 * only safe alongside the rate limit on the lookup route — brute force is the
 * threat here, not guesswork. Codes also expire, and the old 32-character hex
 * ones keep working: lookup is an exact match, so existing rows are unaffected.
 */
const CODE_LENGTH = 8;

/** Whether a stored code is one of the short, dictatable ones. */
function isShortCode(code) {
  return typeof code === 'string' && code.length === CODE_LENGTH;
}

function generateInviteCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function generateInviteUrl(inviteCode) {
  if (process.env.NODE_ENV === 'development') {
    return `rehearsalapp://invite/${inviteCode}`;
  }
  const baseUrl = process.env.BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
  return `${baseUrl}/invite/${inviteCode}`;
}

// POST /api/native/projects/:projectId/invite - Create invite link
router.post('/:projectId/invite', requireAuth, async (req, res) => {
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
router.get('/:projectId/invite', requireAuth, async (req, res) => {
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
});

// DELETE /api/native/projects/:projectId/invite - Revoke invite link
router.delete('/:projectId/invite', requireAuth, async (req, res) => {
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
});

// GET /api/native/invite/:code - Get invite info (public, for preview before joining)
router.get('/:code', async (req, res) => {
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
router.post('/:code/join', requireAuth, async (req, res) => {
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
      // Get the project owner/creator
      const owner = await db.get(
        `SELECT u.first_name, u.last_name
         FROM native_users u
         JOIN native_project_members pm ON u.id = pm.user_id
         WHERE pm.project_id = $1 AND pm.role = 'owner'`,
        [project.id]
      );

      if (owner) {
        const inviterName = `${owner.first_name}${owner.last_name ? ' ' + owner.last_name : ''}`;
        await notifyProjectInvite(project.name, userId, inviterName);
      }
    } catch (notifErr) {
      console.error('Error sending project invite notification:', notifErr);
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

export default router;
