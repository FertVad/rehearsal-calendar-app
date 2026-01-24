/**
 * Recurring Billing Cron Job
 * Processes monthly subscription renewals automatically
 *
 * This job runs daily at 2 AM UTC to check for subscriptions due for renewal
 * and charges the saved payment tokens via AllPay API.
 *
 * Schedule: Daily at 2:00 AM (cron: '0 2 * * *')
 * Called from: server/server.js via node-cron
 */

import { processRecurringBilling } from '../services/subscriptionService.js';
import { logger } from '../utils/logger.js';

/**
 * Main cron job function
 * Processes all subscriptions due for renewal
 */
export async function runRecurringBilling() {
  const startTime = Date.now();
  logger.info('[Cron] Starting recurring billing job...');

  try {
    const results = await processRecurringBilling();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(
      `[Cron] Recurring billing completed in ${duration}s. ` +
      `Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`
    );

    if (results.failed > 0) {
      logger.warn('[Cron] Failed transactions:', results.errors);
    }

    return results;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`[Cron] Recurring billing failed after ${duration}s:`, error);
    throw error;
  }
}

// Allow manual execution for testing: node server/jobs/recurringBilling.js
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('[Manual] Running recurring billing manually...');

  runRecurringBilling()
    .then(results => {
      logger.info('[Manual] Results:', results);
      process.exit(0);
    })
    .catch(error => {
      logger.error('[Manual] Error:', error);
      process.exit(1);
    });
}
