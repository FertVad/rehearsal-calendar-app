/**
 * Subscription Checkout Routes
 * Handles checkout creation, hosted fields page, and payment polling
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/jwtMiddleware.js';
import {
  getSubscriptionPlans,
  getUserActiveSubscription,
  createSubscription,
} from '../../../services/subscriptionService.js';
import { allpayAPI } from '../../../utils/allpayClient.js';
import { logger } from '../../../utils/logger.js';
import { generateCheckoutPageHTML } from './checkoutPageTemplate.js';

const router = Router();

const getBaseUrl = () => {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === 'production') return 'https://rehearsal-calendar-app.onrender.com';
  return 'http://localhost:3001';
};

const BASE_URL = getBaseUrl();

/**
 * POST /api/native/subscriptions/checkout
 * Create checkout session for AllPay payment
 */
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { planId, language = 'en' } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const existingSubscription = await getUserActiveSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        error: 'You already have an active subscription. Please cancel it before subscribing to a new plan.',
      });
    }

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === planId);

    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const dbModule = await import('../../../database/db.js');
    const db = dbModule.default;
    const user = await db.get(
      'SELECT email, first_name, last_name FROM native_users WHERE id = $1',
      [userId]
    );

    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const orderId = `ORDER-${userId}-${Date.now()}`;
    const webhookUrl = `${BASE_URL}/api/native/subscriptions/webhook`;
    const successUrl = `rehearsalapp://subscription/success?order_id=${orderId}`;
    const cancelUrl = `rehearsalapp://subscription/cancel`;
    const clientName = `${user.first_name} ${user.last_name || ''}`.trim() || 'Customer';

    const paymentResult = await allpayAPI.createSubscriptionPayment({
      orderId,
      email: user.email,
      clientName,
      amount: plan.price_usd,
      currency: 'USD',
      description: `${plan.display_name_en} - Subscription`,
      successUrl,
      cancelUrl,
      webhookUrl,
      language: language,
      displayCurrency: 'USD',
      customData: {
        userId,
        planId,
        planName: plan.name,
        userName: clientName,
      },
    });

    logger.info(`[Subscriptions API] AllPay payment result:`, paymentResult);

    await db.run(
      `INSERT INTO native_payment_transactions (
        user_id, allpay_order_id, amount, currency,
        transaction_type, status, allpay_response_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, orderId, plan.price_usd, 'USD', 'initial', 'pending', JSON.stringify({ planId })]
    );

    logger.info(`[Subscriptions API] Created checkout for user ${userId}, plan ${plan.name}`, {
      paymentUrl: paymentResult.paymentUrl,
      orderId: paymentResult.orderId,
    });

    const hostedFieldsUrl = `${BASE_URL}/api/native/subscriptions/checkout-page`
      + `?paymentUrl=${encodeURIComponent(paymentResult.paymentUrl)}`
      + `&orderId=${encodeURIComponent(paymentResult.orderId)}`
      + `&planName=${encodeURIComponent(plan.display_name_en)}`
      + `&amount=${plan.price_usd}`
      + `&currency=USD`
      + `&lang=${language}`;

    res.json({
      checkoutUrl: hostedFieldsUrl,
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
 * GET /api/native/subscriptions/checkout-page
 * Serves HTML page with AllPay Hosted Fields
 */
router.get('/checkout-page', (req, res) => {
  const { paymentUrl, orderId, planName, amount, currency, lang } = req.query;

  if (!paymentUrl) {
    return res.status(400).send('Missing paymentUrl parameter');
  }

  const html = generateCheckoutPageHTML({ paymentUrl, orderId, planName, amount, currency, lang });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * GET /api/native/subscriptions/check-pending/:orderId
 * Check if pending order has been completed (for polling)
 */
router.get('/check-pending/:orderId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    const dbModule = await import('../../../database/db.js');
    const db = dbModule.default;
    const transaction = await db.get(
      'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    let subscription = await getUserActiveSubscription(userId);

    // If no subscription yet, try to create one
    if (!subscription) {
      try {
        let paymentSuccessful = transaction.status === 'completed';

        if (!paymentSuccessful) {
          logger.info(`[Polling] Checking AllPay API for order: ${orderId}`);
          const paymentStatusResp = await allpayAPI.getPaymentStatus(orderId);
          const apiStatus = Number(paymentStatusResp.status);
          logger.info(`[Polling] AllPay status: ${apiStatus} for order: ${orderId}`);
          paymentSuccessful = apiStatus === 1;
        }

        if (paymentSuccessful) {
          logger.info(`[Polling] Payment successful, creating subscription for order: ${orderId}`);

          let planId = null;
          if (transaction.allpay_response_json) {
            try {
              const meta = JSON.parse(transaction.allpay_response_json);
              planId = meta.planId;
            } catch (e) {
              logger.warn(`[Polling] Could not parse allpay_response_json for planId`);
            }
          }

          if (!planId) {
            logger.error(`[Polling] No planId found for order ${orderId}`);
            throw new Error('Plan ID not found for transaction');
          }

          const plan = await db.get(
            'SELECT * FROM native_subscription_plans WHERE id = $1',
            [planId]
          );

          if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
          }

          let allpayToken = null;
          try {
            allpayToken = await allpayAPI.getToken(orderId);
            logger.info(`[Polling] Token retrieved successfully`);
          } catch (tokenError) {
            logger.warn(`[Polling] Could not get token:`, tokenError.message);
          }

          subscription = await createSubscription({
            userId,
            planId: plan.id,
            allpayOrderId: orderId,
            allpayToken,
            allpaySubscriptionId: null,
            allpayCustomerId: null,
          });

          logger.info(`[Polling] Subscription created: ${subscription.id}`);
        }
      } catch (apiError) {
        logger.error('[Polling] Error creating subscription:', apiError);
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
