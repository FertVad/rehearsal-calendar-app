/**
 * Cron endpoints for Vercel Cron Jobs
 * These endpoints are called by Vercel's cron scheduler
 */

import { Router } from 'express';
import { runRecurringBilling } from '../jobs/recurringBilling.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/cron/recurring-billing
 * Run recurring billing job
 *
 * This endpoint is called by Vercel Cron (configured in vercel.json)
 * Protected by CRON_SECRET environment variable
 */
router.get('/recurring-billing', async (req, res) => {
  try {
    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    logger.info('[Cron API] Auth check:', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
    });

    // Verify CRON_SECRET for security
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Cron API] Unauthorized cron request');
      return res.status(401).json({
        error: 'Unauthorized',
        debug: {
          hasSecret: !!cronSecret,
          hasAuth: !!authHeader
        }
      });
    }

    logger.info('[Cron API] Running recurring billing...');

    const result = await runRecurringBilling();

    logger.info('[Cron API] Recurring billing completed:', result);

    res.json({
      success: true,
      message: 'Recurring billing completed',
      result
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
