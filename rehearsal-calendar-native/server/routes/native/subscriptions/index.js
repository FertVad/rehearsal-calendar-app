/**
 * Subscription API Routes
 * Handles subscription management, checkout, webhooks, and payment history
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/jwtMiddleware.js';
import {
  getSubscriptionPlans,
  getUserActiveSubscription,
  cancelSubscription,
  getPaymentHistory,
} from '../../../services/subscriptionService.js';
import { logger } from '../../../utils/logger.js';
import checkoutRouter from './checkout.js';
import webhookRouter from './webhook.js';

const router = Router();

// Mount sub-routers (paths defined inside each router)
router.use('/', checkoutRouter);
router.use('/', webhookRouter);

/**
 * GET /api/native/subscriptions/plans
 * Get all available subscription plans (public endpoint)
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await getSubscriptionPlans();
    res.json({ plans });
  } catch (error) {
    logger.error('[Subscriptions API] Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * GET /api/native/subscriptions/current
 * Get user's current active subscription
 */
router.get('/current', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const subscription = await getUserActiveSubscription(userId);

    if (!subscription) {
      return res.json({ subscription: null });
    }

    res.json({ subscription });
  } catch (error) {
    logger.error('[Subscriptions API] Error fetching current subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/native/subscriptions/cancel
 * Cancel user's active subscription
 */
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { reason } = req.body;

    const result = await cancelSubscription(
      userId,
      reason || 'User requested cancellation'
    );

    res.json({
      success: true,
      subscription: result,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    logger.error('[Subscriptions API] Error cancelling subscription:', error);

    if (error.message === 'No active subscription found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to cancel subscription',
      details: error.message,
    });
  }
});

/**
 * GET /api/native/subscriptions/payments
 * Get user's payment history
 */
router.get('/payments', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const payments = await getPaymentHistory(userId, limit);
    res.json({ payments });
  } catch (error) {
    logger.error('[Subscriptions API] Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;
