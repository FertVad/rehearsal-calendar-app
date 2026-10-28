import { asyncHandler } from '../middleware/asyncHandler.js';
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
router.get('/reminders', asyncHandler(async (req, res) => {
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

    // The counts go in the response on purpose: whatever calls this endpoint is
    // the only place a human sees it working. And a run that failed answers
    // 500, not 200 with zeros (R8: GR03) — the schedulers alarm on the status,
    // and a broken query used to look exactly like a quiet night.
    const { ok, ...report } = result;
    if (!ok) {
      logger.error('[Cron API] Reminder check failed:', report.errors);
      return res.status(500).json({ success: false, error: 'Reminder check failed', ...report });
    }

    logger.info('[Cron API] Reminder check completed');
    res.json({
      success: true,
      message: 'Reminder check completed',
      ...report
    });
  } catch (error) {
    logger.error('[Cron API] Reminder check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Reminder check failed'
    });
  }
}));

export default router;
