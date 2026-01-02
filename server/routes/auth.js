import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { generateTokens, verifyToken, requireAuth } from '../middleware/jwtMiddleware.js';

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
              notifications_enabled, email_notifications, week_start_day
       FROM native_users WHERE id = $1`,
      [userId]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        weekStartDay: user.week_start_day,
      },
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
              notifications_enabled, email_notifications, week_start_day
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
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        weekStartDay: user.week_start_day,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
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
              notifications_enabled, email_notifications, week_start_day, created_at
       FROM native_users WHERE id = $1`,
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        weekStartDay: user.week_start_day,
        createdAt: user.created_at,
      }
    });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update current user info
router.put('/me', requireAuth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      timezone,
      locale,
      notificationsEnabled,
      emailNotifications,
      password,
      weekStartDay,
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }
    if (locale !== undefined) {
      updates.push(`locale = $${paramIndex++}`);
      values.push(locale);
    }
    if (notificationsEnabled !== undefined) {
      updates.push(`notifications_enabled = $${paramIndex++}`);
      values.push(notificationsEnabled);
    }
    if (emailNotifications !== undefined) {
      updates.push(`email_notifications = $${paramIndex++}`);
      values.push(emailNotifications);
    }
    if (weekStartDay !== undefined) {
      // Validate weekStartDay
      if (weekStartDay !== 'monday' && weekStartDay !== 'sunday') {
        return res.status(400).json({ error: 'weekStartDay must be either "monday" or "sunday"' });
      }
      updates.push(`week_start_day = $${paramIndex++}`);
      values.push(weekStartDay);
    }
    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
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
              notifications_enabled, email_notifications, week_start_day
       FROM native_users WHERE id = $1`,
      [req.userId]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        weekStartDay: user.week_start_day,
      }
    });
  } catch (err) {
    console.error('[Auth] Update me error:', err);
    res.status(500).json({ error: 'Failed to update user info' });
  }
});

// Delete account
router.delete('/me', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM native_users WHERE id = $1', [req.userId]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[Auth] Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
