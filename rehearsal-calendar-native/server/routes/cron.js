/**
 * Cron endpoints for Vercel Cron Jobs
 * These endpoints are called by Vercel's cron scheduler
 */

import { Router } from 'express';
import { checkUpcomingRehearsals } from '../services/notifications/reminderScheduler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/cron/reminders
 * Send the rehearsal reminders that are due.
 *
 * Called by Vercel Cron (see vercel.json). The in-process scheduler in
 * reminderScheduler.js only runs where the server is a long-lived process —
 * on Vercel it never fires, which meant reminders were not being sent at all.
 *
 * Protected by CRON_SECRET, fail-closed.
 */
router.get('/reminders', async (req, res) => {
  try {
    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    logger.info('[Cron API] Auth check:', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
    });

    // Verify CRON_SECRET for security (fail-closed: if secret not configured, deny all)
    if (!cronSecret) {
      logger.error('[Cron API] CRON_SECRET is not configured');
      return res.status(503).json({ error: 'Cron not configured' });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Cron API] Unauthorized cron request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('[Cron API] Checking upcoming rehearsals...');

    const result = await checkUpcomingRehearsals();

    logger.info('[Cron API] Reminder check completed');

    res.json({
      success: true,
      message: 'Reminder check completed',
      result: result ?? null
    });
  } catch (error) {
    logger.error('[Cron API] Recurring billing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
