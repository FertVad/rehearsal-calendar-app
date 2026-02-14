/**
 * Subscription Webhook Route
 * Handles AllPay payment webhook callbacks
 */

import { Router } from 'express';
import {
  createSubscription,
  processWebhookEvent,
} from '../../../services/subscriptionService.js';
import { allpayAPI } from '../../../utils/allpayClient.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

/**
 * POST /api/native/subscriptions/webhook
 * AllPay webhook callback (NO authentication - signature verified instead)
 */
router.post('/webhook', async (req, res) => {
  logger.info('[Webhook] === START === Received webhook request');
  logger.info('[Webhook] Content-Type:', req.headers['content-type']);
  logger.info('[Webhook] Body:', JSON.stringify(req.body));
  try {
    const payload = req.body;

    // Validate webhook has actual data (AllPay sometimes sends empty bodies)
    if (!payload || !payload.order_id) {
      logger.warn('[Webhook] Empty or invalid webhook body, ignoring');
      return res.json({ success: true, message: 'Empty payload ignored' });
    }

    const signature = req.headers['x-allpay-signature'] || req.body.sign;
    const isTestMode = process.env.ALLPAY_TEST_MODE === 'true';

    if (!signature && !isTestMode) {
      logger.warn('[Subscriptions Webhook] Missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Normalize status to number (AllPay sends as string "1", not number 1)
    const paymentStatus = Number(payload.status);

    logger.info('[Subscriptions Webhook] Received webhook:', {
      orderId: payload.order_id,
      status: paymentStatus,
      hasSignature: !!signature,
      hasCustomData: !!payload.custom_data,
    });

    // Process webhook (includes signature verification if signature present)
    // In test mode, always skip signature verification
    const result = (signature && !isTestMode)
      ? await processWebhookEvent(payload, signature)
      : await processWebhookEvent(payload, 'test-mode-skip-signature');

    // If payment successful, create subscription
    if (paymentStatus === 1) {
      try {
        let userId, planId;

        if (payload.custom_data) {
          const customData = typeof payload.custom_data === 'string'
            ? JSON.parse(payload.custom_data)
            : payload.custom_data;
          userId = customData.userId;
          planId = customData.planId;
        }

        // Fallback: look up from stored transaction if custom_data is missing
        if (!userId || !planId) {
          const dbModule = await import('../../../database/db.js');
          const db = dbModule.default;
          const transaction = await db.get(
            'SELECT user_id, allpay_response_json FROM native_payment_transactions WHERE allpay_order_id = $1',
            [payload.order_id]
          );
          if (transaction) {
            userId = transaction.user_id;
            if (transaction.allpay_response_json) {
              const meta = JSON.parse(transaction.allpay_response_json);
              planId = meta.planId || planId;
            }
          }
        }

        if (!userId || !planId) {
          logger.error(`[Webhook] Cannot determine userId/planId for order ${payload.order_id}`);
          return res.json({ success: true, message: 'Webhook logged but subscription not created (missing data)' });
        }

        // Get AllPay token for recurring payments
        let allpayToken = null;
        try {
          allpayToken = await allpayAPI.getToken(payload.order_id);
          logger.info(`[Webhook] Got AllPay token for order ${payload.order_id}`);
        } catch (tokenError) {
          logger.warn(`[Webhook] Could not get token:`, tokenError.message);
          if (!isTestMode) {
            throw tokenError;
          }
        }

        await createSubscription({
          userId,
          planId,
          allpayToken,
          allpaySubscriptionId: null,
          allpayCustomerId: payload.customer_id || null,
          allpayOrderId: payload.order_id,
          metadata: { userId, planId },
        });

        logger.info(`[Webhook] Created subscription for user ${userId}, plan ${planId}`);
      } catch (subError) {
        logger.error('[Webhook] Failed to create subscription:', subError);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Subscriptions Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
