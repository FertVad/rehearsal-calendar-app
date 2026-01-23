import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { generateTokens, verifyToken, requireAuth } from '../middleware/jwtMiddleware.js';
import { serializeUser } from '../utils/userSerializer.js';
import { verifyGoogleToken, verifyAppleToken } from '../utils/oauthVerification.js';
import { findOrCreateOAuthUser, getUserAuthProviders, unlinkAuthProvider } from '../utils/accountLinking.js';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }

    // Check if user already exists
    const existing = await db.get('SELECT id FROM native_users WHERE email = $1', [email]);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.run(
      `INSERT INTO native_users (email, password_hash, first_name, last_name, last_login_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [email, passwordHash, firstName, lastName || null]
    );

    const userId = result.lastInsertId;

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(userId);

    // Get user data
    const user = await db.get(
      `SELECT id, email, first_name, last_name, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed
       FROM native_users WHERE id = $1`,
      [userId]
    );

    res.json({
      user: serializeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const user = await db.get(
      `SELECT id, email, password_hash, first_name, last_name, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed
       FROM native_users WHERE email = $1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.run('UPDATE native_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      user: serializeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Google OAuth Login/Register
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify token with Google
    const googleUser = await verifyGoogleToken(idToken);

    if (!googleUser.emailVerified) {
      return res.status(400).json({ error: 'Email not verified by Google' });
    }

    // Find or create user, link accounts if email matches
    const { userId, isNewUser, linked } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: googleUser.providerUserId,
      email: googleUser.email,
      emailVerified: googleUser.emailVerified,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      avatarUrl: googleUser.avatarUrl,
    });

    // Update last login
    await db.run(
      'UPDATE native_users SET last_login_at = $1 WHERE id = $2',
      [new Date().toISOString(), userId]
    );

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(userId);

    // Get user data
    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed, created_at
       FROM native_users WHERE id = $1`,
      [userId]
    );

    res.json({
      user: serializeUser(user),
      accessToken,
      refreshToken,
      isNewUser,
      linked, // Indicates if account was linked to existing user
    });
  } catch (err) {
    console.error('[Auth] Google OAuth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Apple Sign-In Login/Register
router.post('/apple', async (req, res) => {
  try {
    const { idToken, user } = req.body; // Apple sends user data only on first sign-in

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify token with Apple
    const appleUser = await verifyAppleToken(idToken);

    // Apple provides name only on first sign-in, extract from request if available
    const firstName = user?.givenName || user?.name?.givenName || user?.firstName || 'User';
    const lastName = user?.familyName || user?.name?.familyName || user?.lastName || '';

    // Find or create user, link accounts if email matches
    const { userId, isNewUser, linked } = await findOrCreateOAuthUser({
      provider: 'apple',
      providerUserId: appleUser.providerUserId,
      email: appleUser.email,
      emailVerified: appleUser.emailVerified,
      firstName,
      lastName,
      avatarUrl: null, // Apple doesn't provide avatars
    });

    // Update last login
    await db.run(
      'UPDATE native_users SET last_login_at = $1 WHERE id = $2',
      [new Date().toISOString(), userId]
    );

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(userId);

    // Get user data
    const user_data = await db.get(
      `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed, created_at
       FROM native_users WHERE id = $1`,
      [userId]
    );

    res.json({
      user: serializeUser(user_data),
      accessToken,
      refreshToken,
      isNewUser,
      linked,
    });
  } catch (err) {
    console.error('[Auth] Apple OAuth error:', err);
    res.status(500).json({ error: 'Apple authentication failed' });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyToken(refreshToken, 'refresh');
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    res.json(tokens);
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed, created_at
       FROM native_users WHERE id = $1`,
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: serializeUser(user)
    });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Whitelist of allowed fields for user updates (security)
const ALLOWED_USER_FIELDS = {
  firstName: { dbColumn: 'first_name', validate: null },
  lastName: { dbColumn: 'last_name', validate: null },
  phone: { dbColumn: 'phone', validate: null },
  timezone: { dbColumn: 'timezone', validate: null },
  locale: { dbColumn: 'locale', validate: null },
  notificationsEnabled: { dbColumn: 'notifications_enabled', validate: null },
  emailNotifications: { dbColumn: 'email_notifications', validate: null },
  weekStartDay: {
    dbColumn: 'week_start_day',
    validate: (value) => {
      if (value !== 'monday' && value !== 'sunday') {
        throw new Error('weekStartDay must be either "monday" or "sunday"');
      }
    }
  },
  onboardingCompleted: { dbColumn: 'onboarding_completed', validate: null },
  password: {
    dbColumn: 'password_hash',
    validate: null,
    transform: async (value) => await bcrypt.hash(value, 10)
  }
};

// Update current user info
router.put('/me', requireAuth, async (req, res) => {
  try {
    console.log('[Auth] Update user request body:', req.body);
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Process only whitelisted fields
    for (const [apiField, config] of Object.entries(ALLOWED_USER_FIELDS)) {
      const value = req.body[apiField];

      if (value === undefined) continue;

      // Run field-specific validation if exists
      if (config.validate) {
        try {
          config.validate(value);
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      }

      // Transform value if needed (e.g., hash password)
      const finalValue = config.transform ? await config.transform(value) : value;

      updates.push(`${config.dbColumn} = $${paramIndex++}`);
      values.push(finalValue);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.userId);

    await db.run(
      `UPDATE native_users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Get updated user
    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed
       FROM native_users WHERE id = $1`,
      [req.userId]
    );

    res.json({
      user: serializeUser(user)
    });
  } catch (err) {
    console.error('[Auth] Update me error:', err);
    res.status(500).json({ error: 'Failed to update user info' });
  }
});

// Delete account with cascade cleanup
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Find projects where user is the only admin/owner
      const orphanedProjects = await db.all(
        `SELECT p.id, p.name
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = $1
           AND pm.role IN ('owner', 'admin')
           AND pm.status = 'active'
           AND (
             SELECT COUNT(*)
             FROM native_project_members pm2
             WHERE pm2.project_id = p.id
               AND pm2.role IN ('owner', 'admin')
               AND pm2.status = 'active'
           ) = 1`,
        [userId]
      );

      console.log(`[Auth] User ${userId} deletion: ${orphanedProjects.length} projects will be deleted (no other admins)`);

      // Delete orphaned projects (CASCADE will handle rehearsals, members, etc.)
      for (const project of orphanedProjects) {
        await db.run('DELETE FROM native_projects WHERE id = $1', [project.id]);
        console.log(`[Auth] Deleted orphaned project: ${project.name} (id: ${project.id})`);
      }

      // Delete user (CASCADE will handle remaining memberships, availability, calendar connections, etc.)
      await db.run('DELETE FROM native_users WHERE id = $1', [userId]);

      // Commit transaction
      await db.run('COMMIT');

      res.json({
        message: 'Account deleted successfully',
        deletedProjects: orphanedProjects.length
      });
    } catch (innerErr) {
      // Rollback on any error
      await db.run('ROLLBACK');
      throw innerErr;
    }
  } catch (err) {
    console.error('[Auth] Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Get linked auth providers for current user
router.get('/me/providers', requireAuth, async (req, res) => {
  try {
    const providers = await getUserAuthProviders(req.userId);

    // Don't expose sensitive provider_user_id, just show type and email
    const sanitizedProviders = providers.map(p => ({
      providerType: p.provider_type,
      providerEmail: p.provider_email,
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at,
    }));

    res.json({ providers: sanitizedProviders });
  } catch (err) {
    console.error('[Auth] Get providers error:', err);
    res.status(500).json({ error: 'Failed to get auth providers' });
  }
});

// Unlink auth provider (only if user has another auth method)
router.delete('/me/providers/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;

    // Validate provider type
    if (!['email', 'google', 'apple'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider type' });
    }

    await unlinkAuthProvider(req.userId, provider);

    res.json({
      message: `${provider} provider unlinked successfully`,
    });
  } catch (err) {
    console.error('[Auth] Unlink provider error:', err);

    if (err.message === 'Cannot unlink the last authentication method') {
      return res.status(400).json({ error: err.message });
    }

    if (err.message === 'Auth provider not found') {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to unlink provider' });
  }
});

export default router;
