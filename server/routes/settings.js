import { Router } from 'express';
import db, { isPostgres } from '../database/db.js';
import { requireTelegramAuth, requireProjectMember, requireProjectAdmin } from '../middleware/authMiddleware.js';
import { normalizeChatId } from '../utils/helpers.js';
import * as Project from '../database/models/Project.js';
import * as Actor from '../database/models/Actor.js';

const router = Router();

/**
 * GET /api/settings/user/:telegramId
 * Get user settings (ui_language, week_starts_on)
 */
router.get('/user/:telegramId', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const { telegramId } = req.params;

    const query = 'SELECT ui_language, week_starts_on FROM actors WHERE telegram_id = ? LIMIT 1';
    const actor = await db.get(query, [telegramId]);

    if (!actor) {
      return res.json({
        success: true,
        settings: {
          ui_language: 'en', // default
          week_starts_on: 1 // default: Monday
        }
      });
    }

    res.json({
      success: true,
      settings: {
        ui_language: actor.ui_language || 'en',
        week_starts_on: actor.week_starts_on !== null ? actor.week_starts_on : 1
      }
    });
  } catch (error) {
    console.error('[Settings] Get user settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user settings'
    });
  }
});

/**
 * PATCH /api/settings/user/:telegramId
 * Update user settings (ui_language, week_starts_on)
 */
router.patch('/user/:telegramId', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { ui_language, week_starts_on } = req.body;

    // Validate inputs
    if (ui_language && !['en', 'ru'].includes(ui_language)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language. Must be "en" or "ru"'
      });
    }

    if (week_starts_on !== undefined && ![0, 1].includes(week_starts_on)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid week_starts_on. Must be 0 (Sunday) or 1 (Monday)'
      });
    }

    // Build dynamic query
    const updates = [];
    const values = [];

    if (ui_language) {
      updates.push('ui_language = ?');
      values.push(ui_language);
    }

    if (week_starts_on !== undefined) {
      updates.push('week_starts_on = ?');
      values.push(week_starts_on);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No settings provided to update'
      });
    }

    values.push(telegramId);
    const query = `UPDATE actors SET ${updates.join(', ')} WHERE telegram_id = ?`;
    await db.run(query, values);

    res.json({
      success: true,
      message: 'User settings updated'
    });
  } catch (error) {
    console.error('[Settings] Update user settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user settings'
    });
  }
});

/**
 * GET /api/settings/project/:chatId
 * Get project settings (work_hours, notifications, notification_language)
 */
router.get('/project/:chatId',
  requireTelegramAuth({ allowDevParam: true }),
  requireProjectMember(Project, Actor),
  async (req, res) => {
  try {
    const chatId = normalizeChatId(req.params.chatId);

    const query = `
      SELECT
        work_hours_start,
        work_hours_end,
        notifications_enabled,
        notification_language
      FROM projects
      WHERE chat_id = ?
      LIMIT 1
    `;
    const project = await db.get(query, [chatId]);

    if (!project) {
      return res.json({
        success: true,
        settings: {
          work_hours_start: '09:00',
          work_hours_end: '22:00',
          notifications_enabled: false,
          notification_language: 'en'
        }
      });
    }

    res.json({
      success: true,
      settings: {
        work_hours_start: project.work_hours_start || '09:00',
        work_hours_end: project.work_hours_end || '22:00',
        notifications_enabled: isPostgres
          ? Boolean(project.notifications_enabled)
          : Boolean(project.notifications_enabled),
        notification_language: project.notification_language || 'en'
      }
    });
  } catch (error) {
    console.error('[Settings] Get project settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project settings'
    });
  }
});

/**
 * PATCH /api/settings/project/:chatId
 * Update project settings (admin only)
 */
router.patch('/project/:chatId',
  requireTelegramAuth({ allowDevParam: true }),
  requireProjectMember(Project, Actor),
  requireProjectAdmin(),
  async (req, res) => {
    try {
      const chatId = normalizeChatId(req.params.chatId);
      const { work_hours_start, work_hours_end, notifications_enabled, notification_language } = req.body;

      // Validate inputs
      const updates = [];
      const params = [];

      if (work_hours_start !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(work_hours_start)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid work_hours_start format. Must be HH:MM'
          });
        }
        updates.push('work_hours_start = ?');
        params.push(work_hours_start);
      }

      if (work_hours_end !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(work_hours_end)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid work_hours_end format. Must be HH:MM'
          });
        }
        updates.push('work_hours_end = ?');
        params.push(work_hours_end);
      }

      if (notifications_enabled !== undefined) {
        updates.push('notifications_enabled = ?');
        params.push(isPostgres ? notifications_enabled : (notifications_enabled ? 1 : 0));
      }

      if (notification_language !== undefined) {
        if (!['en', 'ru'].includes(notification_language)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid notification_language. Must be "en" or "ru"'
          });
        }
        updates.push('notification_language = ?');
        params.push(notification_language);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      params.push(chatId);
      const query = `UPDATE projects SET ${updates.join(', ')} WHERE chat_id = ?`;
      await db.run(query, params);

      res.json({
        success: true,
        message: 'Project settings updated'
      });
    } catch (error) {
      console.error('[Settings] Update project settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project settings'
      });
    }
  }
);

export default router;
