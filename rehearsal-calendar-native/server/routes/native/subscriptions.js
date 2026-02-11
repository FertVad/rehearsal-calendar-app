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
// Check BASE_URL first (allows overriding VERCEL_URL)
const getBaseUrl = () => {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://rehearsal-calendar-app.onrender.com';
  }
  // For local development
  return 'http://localhost:3001';
};

const BASE_URL = getBaseUrl();



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
    // Use custom URL scheme that WebView can intercept (no backend redirect needed)
    const successUrl = `rehearsalapp://subscription/success?order_id=${orderId}`;
    const cancelUrl = `rehearsalapp://subscription/cancel`;

    // Create initial payment WITHOUT AllPay subscriptions API
    // We manage subscription lifecycle ourselves using tokens
    const clientName = `${user.first_name} ${user.last_name || ''}`.trim() || 'Customer';

    const paymentResult = await allpayAPI.createSubscriptionPayment({
      orderId,
      email: user.email,
      clientName, // REQUIRED by AllPay
      amount: plan.price_ils, // Use ILS for checkout (AllPay requirement)
      currency: 'ILS', // Bill in ILS for first payment
      description: `${plan.display_name_en} - Subscription`,
      successUrl,
      cancelUrl,
      webhookUrl,
      language: language, // User's preferred language
      displayCurrency: 'ILS', // Show price in ILS
      // NO subscriptionConfig - we manage subscriptions via tokens
      customData: {
        userId,
        planId,
        planName: plan.name,
        userName: clientName,
      },
    });

    logger.info(`[Subscriptions API] AllPay payment result:`, paymentResult);

    // Create pending transaction record
    await db.run(
      `INSERT INTO native_payment_transactions (
        user_id, allpay_order_id, amount, currency,
        transaction_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, orderId, plan.price_ils, 'ILS', 'initial', 'pending']
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
  logger.info('[Webhook] === START === Received webhook request');
  logger.info('[Webhook] Body:', JSON.stringify(req.body));
  logger.info('[Webhook] Headers:', JSON.stringify(req.headers));
  try {
    const payload = req.body;
    const signature = req.headers['x-allpay-signature'] || req.body.sign;

    // In test mode, AllPay might not send signature
    const isTestMode = process.env.ALLPAY_TEST_MODE === 'true';

    if (!signature && !isTestMode) {
      logger.warn('[Subscriptions Webhook] Missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    logger.info('[Subscriptions Webhook] Received webhook:', {
      orderId: payload.order_id,
      status: payload.status,
      hasSignature: !!signature,
      testMode: isTestMode,
    });

    // Process webhook (includes signature verification if signature present)
    const result = signature
      ? await processWebhookEvent(payload, signature)
      : await processWebhookEvent(payload, 'test-mode-skip-signature');

    // If payment successful and we have custom_data, create subscription
    if (payload.status === 1 && payload.custom_data) {
      try {
        const customData = JSON.parse(payload.custom_data);
        const { userId, planId } = customData;

        // Get AllPay token for recurring payments
        // In test mode, token might not be available - that's OK for testing
        let allpayToken = null;
        try {
          allpayToken = await allpayAPI.getToken(payload.order_id);
          logger.info(`[Subscriptions Webhook] Got AllPay token for order ${payload.order_id}`);
        } catch (tokenError) {
          logger.warn(`[Subscriptions Webhook] Could not get token (test mode?):`, tokenError.message);
          // Continue without token in test mode
          if (!isTestMode) {
            throw tokenError; // In production, token is required
          }
        }

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


/**
 * GET /api/native/subscriptions/check-pending/:orderId
 * Check if pending order has been completed (for polling)
 * Now also checks AllPay API status and creates subscription if payment successful
 * This allows payments to work even without webhooks
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

    // First check if subscription already exists (created by webhook)
    let subscription = await getUserActiveSubscription(userId);

    // If no subscription yet and transaction is pending, check AllPay API
    if (!subscription && transaction.status === 'pending') {
      try {
        logger.info(`[Polling] Checking AllPay API for order: ${orderId}`);
        const paymentStatus = await allpayAPI.getPaymentStatus(orderId);
        logger.info(`[Polling] AllPay status: ${paymentStatus.status} for order: ${orderId}`);

        // Status: 0=unpaid, 1=paid, 3=refunded, 4=partially_refunded
        if (paymentStatus.status === 1) {
          // Payment successful! Create subscription (fallback if webhook didn't arrive)
          logger.info(`[Polling] Payment successful, creating subscription for order: ${orderId}`);

          // Get plan from transaction
          const plan = await db.get(
            'SELECT p.* FROM native_subscription_plans p JOIN native_payment_transactions t ON p.id = t.plan_id WHERE t.allpay_order_id = $1',
            [orderId]
          );

          if (!plan) {
            throw new Error('Plan not found for transaction');
          }

          // Get AllPay token for recurring payments
          let allpayToken = null;
          try {
            allpayToken = await allpayAPI.getToken(orderId);
            logger.info(`[Polling] Token retrieved successfully`);
          } catch (tokenError) {
            logger.warn(`[Polling] Could not get token:`, tokenError.message);
          }

          // Create subscription
          subscription = await createSubscription({
            userId,
            planId: plan.id,
            allpayOrderId: orderId,
            allpayToken,
            amount: plan.price_usd,
            currency: 'USD',
          });

          logger.info(`[Polling] Subscription created: ${subscription.id}`);
        }
      } catch (apiError) {
        logger.error('[Polling] Error checking AllPay API:', apiError);
        // Continue with local check if API fails
      }
    }

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



export default router;
