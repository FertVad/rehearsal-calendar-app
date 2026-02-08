/**
 * Subscription API Routes
 * Handles subscription management, checkout, webhooks, and payment history
 *
 * Pattern: Follows existing route patterns from invites.js
 * - Uses requireAuth middleware for protected routes
 * - Accesses userId via req.userId
 * - Delegates business logic to subscriptionService
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/jwtMiddleware.js';
import {
  getSubscriptionPlans,
  getUserActiveSubscription,
  createSubscription,
  cancelSubscription,
  getPaymentHistory,
  processWebhookEvent,
} from '../../services/subscriptionService.js';
import { allpayAPI } from '../../utils/allpayClient.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Base URL for redirects (configurable per environment)
// Use VERCEL_URL if available (Vercel deployment), otherwise fallback
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://rehearsal-calendar-app.onrender.com';
  }
  // For local development
  return 'http://localhost:3001';
};

const BASE_URL = getBaseUrl();

/**
 * GET /api/native/subscriptions/test-config
 * Test AllPay API configuration (development only)
 */
router.get('/test-config', async (req, res) => {
  try {
    // Only allow in development/test mode
    if (process.env.NODE_ENV === 'production' && process.env.ALLPAY_TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Endpoint only available in development mode' });
    }

    const isConfigured = !!(process.env.ALLPAY_API_LOGIN && process.env.ALLPAY_API_KEY);

    if (!isConfigured) {
      return res.json({
        configured: false,
        message: 'AllPay credentials not configured. Add ALLPAY_API_LOGIN and ALLPAY_API_KEY to server/.env'
      });
    }

    // Test API connection
    const result = await allpayAPI.checkKeys();

    res.json({
      configured: true,
      testMode: process.env.ALLPAY_TEST_MODE === 'true',
      login: process.env.ALLPAY_API_LOGIN,
      connectionTest: result,
      message: 'AllPay configuration is valid'
    });
  } catch (error) {
    logger.error('[Subscriptions API] Config test failed:', error);
    res.status(500).json({
      configured: true,
      error: 'AllPay API test failed',
      details: error.message,
      message: 'Check your ALLPAY_API_LOGIN and ALLPAY_API_KEY'
    });
  }
});

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
 * POST /api/native/subscriptions/checkout
 * Create checkout session for AllPay payment
 *
 * Body: { planId: number }
 * Returns: { checkoutUrl: string, orderId: string }
 */
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { planId, language = 'en' } = req.body; // Accept language from frontend

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Check if user already has active subscription
    const existingSubscription = await getUserActiveSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        error: 'You already have an active subscription. Please cancel it before subscribing to a new plan.',
      });
    }

    // Get plan details (will be done in service, but we need it for API call)
    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === planId);

    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    // Get user email from database
    const dbModule = await import('../../database/db.js');
    const db = dbModule.default;
    const user = await db.get(
      'SELECT email, first_name, last_name FROM native_users WHERE id = $1',
      [userId]
    );

    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Generate unique order ID
    const orderId = `ORDER-${userId}-${Date.now()}`;

    // Create AllPay payment with subscription
    const webhookUrl = `${BASE_URL}/api/native/subscriptions/webhook`;
    const successUrl = `${BASE_URL}/api/native/payment-success?order_id=${orderId}`;
    const cancelUrl = `${BASE_URL}/api/native/payment-cancel`;

    // Create initial payment WITHOUT AllPay subscriptions API
    // We manage subscription lifecycle ourselves using tokens
    const paymentResult = await allpayAPI.createSubscriptionPayment({
      orderId,
      email: user.email,
      amount: plan.price_usd, // Use USD price
      currency: 'USD', // Bill in USD
      description: `${plan.display_name_en} - Subscription`,
      successUrl,
      cancelUrl,
      webhookUrl,
      language: language, // User's preferred language
      displayCurrency: 'USD', // Show price in USD
      // NO subscriptionConfig - we manage subscriptions via tokens
      customData: {
        userId,
        planId,
        planName: plan.name,
        userName: `${user.first_name} ${user.last_name || ''}`.trim(),
      },
    });

    logger.info(`[Subscriptions API] AllPay payment result:`, paymentResult);

    // Create pending transaction record
    await db.run(
      `INSERT INTO native_payment_transactions (
        user_id, allpay_order_id, amount, currency,
        transaction_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, orderId, plan.price_usd, 'USD', 'initial', 'pending']
    );

    logger.info(`[Subscriptions API] Created checkout for user ${userId}, plan ${plan.name}`, {
      paymentUrl: paymentResult.paymentUrl,
      orderId: paymentResult.orderId,
    });

    res.json({
      checkoutUrl: paymentResult.paymentUrl,
      orderId: paymentResult.orderId,
    });
  } catch (error) {
    logger.error('[Subscriptions API] Error creating checkout:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
    });
  }
});

/**
 * POST /api/native/subscriptions/webhook
 * AllPay webhook callback (NO authentication - signature verified instead)
 *
 * This endpoint is called by AllPay after payment completion
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-allpay-signature'] || req.body.sign;

    if (!signature) {
      logger.warn('[Subscriptions Webhook] Missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    logger.info('[Subscriptions Webhook] Received webhook:', {
      orderId: payload.order_id,
      status: payload.status,
    });

    // Process webhook (includes signature verification)
    const result = await processWebhookEvent(payload, signature);

    // If payment successful and we have custom_data, create subscription
    if (payload.status === 1 && payload.custom_data) {
      try {
        const customData = JSON.parse(payload.custom_data);
        const { userId, planId } = customData;

        // Get AllPay token for recurring payments
        const allpayToken = await allpayAPI.getToken(payload.order_id);

        // Create subscription (token-based, no AllPay subscription ID)
        await createSubscription({
          userId,
          planId,
          allpayToken,
          allpaySubscriptionId: null, // Not using AllPay subscriptions API
          allpayCustomerId: payload.customer_id || null,
          allpayOrderId: payload.order_id,
          metadata: customData,
        });

        logger.info(`[Subscriptions Webhook] Created subscription for user ${userId}`);
      } catch (subError) {
        logger.error('[Subscriptions Webhook] Failed to create subscription:', subError);
        // Don't return error to AllPay - we logged the webhook
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Subscriptions Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/native/subscriptions/cancel
 * Cancel user's active subscription
 *
 * Body: { reason?: string }
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
 *
 * Query params: ?limit=50
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

/**
 * GET /api/native/subscriptions/check-pending/:orderId
 * Check if pending order has been completed (for polling)
 * Returns subscription status without calling AllPay API
 */
router.get('/check-pending/:orderId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    // Verify order belongs to user
    const dbModule = await import('../../database/db.js');
    const db = dbModule.default;
    const transaction = await db.get(
      'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if subscription was created (webhook processed successfully)
    const subscription = await getUserActiveSubscription(userId);

    res.json({
      orderId,
      transactionStatus: transaction.status,
      subscriptionCreated: !!subscription,
      subscription: subscription || null,
    });
  } catch (error) {
    logger.error('[Subscriptions API] Error checking pending order:', error);
    res.status(500).json({
      error: 'Failed to check order status',
      details: error.message,
    });
  }
});

/**
 * GET /api/native/subscriptions/status/:orderId
 * Check payment status for a specific order (calls AllPay API)
 */
router.get('/status/:orderId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    // Verify order belongs to user
    const dbModule = await import('../../database/db.js');
    const db = dbModule.default;
    const transaction = await db.get(
      'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get status from AllPay
    const paymentStatus = await allpayAPI.getPaymentStatus(orderId);

    res.json({
      orderId,
      status: paymentStatus.status,
      localStatus: transaction.status,
      allpayStatus: paymentStatus,
    });
  } catch (error) {
    logger.error('[Subscriptions API] Error checking payment status:', error);
    res.status(500).json({
      error: 'Failed to check payment status',
      details: error.message,
    });
  }
});

export default router;
