import { Router } from 'express';
import * as NativeUser from '../database/models/NativeUser.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireAuth,
} from '../middleware/jwtMiddleware.js';
import { verifyTelegramLoginWidget } from '../utils/telegramAuth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validation
    if (!email || !password || !firstName) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, firstName',
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await NativeUser.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create user
    const user = await NativeUser.create({ email, password, firstName, lastName, phone });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Return user data (without password)
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: email, password',
      });
    }

    // Find user
    const user = await NativeUser.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await NativeUser.verifyPassword(
      password,
      user.password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await NativeUser.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Return user data (without password)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        telegramId: user.telegram_id,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/telegram
 * Login/Register with Telegram
 */
router.post('/telegram', async (req, res) => {
  try {
    const telegramData = req.body;

    // Validate required fields
    if (!telegramData.id || !telegramData.hash || !telegramData.auth_date) {
      return res.status(400).json({
        error: 'Missing required Telegram data',
      });
    }

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || botToken === 'your-telegram-bot-token') {
      return res.status(500).json({
        error: 'Telegram bot token not configured',
      });
    }

    // Verify Telegram data
    const verification = verifyTelegramLoginWidget(telegramData, botToken);
    if (!verification.ok) {
      return res.status(401).json({
        error: 'Invalid Telegram authentication',
        details: verification.error,
      });
    }

    const telegramId = verification.user.id;
    const { first_name, last_name, username, photo_url } = verification.user;

    // Check if user exists
    let user = await NativeUser.findByTelegramId(telegramId);

    if (!user) {
      // Create new user
      user = await NativeUser.createWithTelegram({
        telegramId,
        firstName: first_name,
        lastName: last_name,
        username,
        photoUrl: photo_url,
      });
    }

    // Update last login
    await NativeUser.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Return user data
    res.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        telegramId: user.telegram_id,
        email: user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if user still exists
    const user = await NativeUser.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await NativeUser.findById(req.userId);

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
        telegramId: user.telegram_id,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user
 */
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, timezone, locale, notificationsEnabled, emailNotifications } = req.body;
    const updates = {};

    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (password) updates.password = password;
    if (timezone !== undefined) updates.timezone = timezone;
    if (locale !== undefined) updates.locale = locale;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;
    if (emailNotifications !== undefined) updates.emailNotifications = emailNotifications;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const user = await NativeUser.update(req.userId, updates);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        telegramId: user.telegram_id,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        locale: user.locale,
        notificationsEnabled: user.notifications_enabled,
        emailNotifications: user.email_notifications,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/auth/me
 * Delete current user
 */
router.delete('/me', requireAuth, async (req, res) => {
  try {
    await NativeUser.deleteUser(req.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
