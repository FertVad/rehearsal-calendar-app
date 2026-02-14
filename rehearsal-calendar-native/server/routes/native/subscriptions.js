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
      amount: plan.price_usd,
      currency: 'USD',
      description: `${plan.display_name_en} - Subscription`,
      successUrl,
      cancelUrl,
      webhookUrl,
      language: language,
      displayCurrency: 'USD',
      // NO subscriptionConfig - we manage subscriptions via tokens
      customData: {
        userId,
        planId,
        planName: plan.name,
        userName: clientName,
      },
    });

    logger.info(`[Subscriptions API] AllPay payment result:`, paymentResult);

    // Create pending transaction record (store planId in metadata for polling fallback)
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

    // Return hosted fields page URL (our wrapper with dark theme + pay button)
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
 * Serves HTML page with AllPay Hosted Fields (embedded card input)
 * This page is loaded in a WebView and communicates via postMessage
 */
router.get('/checkout-page', (req, res) => {
  const { paymentUrl, orderId, planName, amount, currency, lang } = req.query;

  if (!paymentUrl) {
    return res.status(400).send('Missing paymentUrl parameter');
  }

  const isRu = lang === 'ru';
  const payBtnText = isRu ? `Оплатить $${amount}` : `Pay $${amount}`;
  const processingText = isRu ? 'Обработка платежа...' : 'Processing payment...';
  const secureText = isRu ? 'Безопасная оплата через AllPay' : 'Secure payment via AllPay';
  const title = isRu ? 'Оплата' : 'Payment';

  const html = `<!DOCTYPE html>
<html lang="${lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 16px 20px;
      text-align: center;
      border-bottom: 1px solid rgba(139, 148, 158, 0.2);
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #e6edf3;
    }
    .plan-info {
      padding: 16px 20px;
      text-align: center;
      background: #161b22;
      border-bottom: 1px solid rgba(139, 148, 158, 0.2);
    }
    .plan-name {
      font-size: 16px;
      font-weight: 500;
      color: #A855F7;
    }
    .plan-price {
      font-size: 24px;
      font-weight: 700;
      margin-top: 4px;
    }
    .iframe-container {
      flex: 1;
      padding: 0;
      background: #0d1117;
    }
    .iframe-container iframe {
      width: 100%;
      height: 350px;
      border: none;
      background: #0d1117;
    }
    .footer {
      padding: 16px 20px;
      background: #0d1117;
      border-top: 1px solid rgba(139, 148, 158, 0.2);
    }
    .pay-btn {
      width: 100%;
      padding: 16px;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #A855F7, #9333EA);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .pay-btn:active { opacity: 0.8; }
    .pay-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .secure-badge {
      text-align: center;
      margin-top: 12px;
      font-size: 12px;
      color: #8b949e;
    }
    .processing {
      display: none;
      text-align: center;
      padding: 12px;
      color: #A855F7;
      font-size: 14px;
    }
    .error-msg {
      display: none;
      text-align: center;
      padding: 12px;
      color: #ef4444;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
  </div>
  <div class="plan-info">
    <div class="plan-name">${planName || 'Subscription'}</div>
    <div class="plan-price">$${amount || '0'} ${currency || 'USD'}</div>
  </div>
  <div class="iframe-container">
    <iframe id="allpay-iframe" src="${paymentUrl}" allow="payment *"></iframe>
  </div>
  <div class="footer">
    <div class="processing" id="processing">${processingText}</div>
    <div class="error-msg" id="error-msg"></div>
    <button class="pay-btn" id="pay-btn" onclick="handlePay()">${payBtnText}</button>
    <div class="secure-badge">${secureText}</div>
  </div>

  <script src="https://allpay.to/js/allpay-hf.js"></script>
  <script>
    var payBtn = document.getElementById('pay-btn');
    var processingEl = document.getElementById('processing');
    var errorEl = document.getElementById('error-msg');

    var Allpay = new AllpayPayment({
      iframeId: 'allpay-iframe',
      onSuccess: function() {
        payBtn.style.display = 'none';
        processingEl.style.display = 'none';
        errorEl.style.display = 'none';
        // Notify React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_success',
            orderId: '${orderId || ''}'
          }));
        }
      },
      onError: function(errorNum, errorMsg) {
        payBtn.disabled = false;
        payBtn.textContent = '${payBtnText}';
        processingEl.style.display = 'none';
        errorEl.textContent = errorMsg || 'Payment failed. Please try again.';
        errorEl.style.display = 'block';
        // Notify React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_error',
            error: errorNum,
            message: errorMsg
          }));
        }
      }
    });

    function handlePay() {
      payBtn.disabled = true;
      payBtn.textContent = '${processingText}';
      processingEl.style.display = 'block';
      errorEl.style.display = 'none';
      Allpay.pay();
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * POST /api/native/subscriptions/webhook
 * AllPay webhook callback (NO authentication - signature verified instead)
 *
 * This endpoint is called by AllPay after payment completion
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
    // In test mode, always skip signature verification (AllPay test mode may sign differently)
    const result = (signature && !isTestMode)
      ? await processWebhookEvent(payload, signature)
      : await processWebhookEvent(payload, 'test-mode-skip-signature');

    // If payment successful, create subscription
    if (paymentStatus === 1) {
      try {
        // Get userId and planId from custom_data or from stored transaction
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
          const dbModule = await import('../../database/db.js');
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
 * Also checks AllPay API status and creates subscription if payment successful
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

    // Check if subscription already exists (created by webhook)
    let subscription = await getUserActiveSubscription(userId);

    // If no subscription yet, try to create one (handles both cases:
    // 1. Transaction still pending - check AllPay API
    // 2. Transaction completed by webhook but subscription creation failed)
    if (!subscription) {
      try {
        let paymentSuccessful = transaction.status === 'completed';

        // If not yet confirmed locally, check AllPay API
        if (!paymentSuccessful) {
          logger.info(`[Polling] Checking AllPay API for order: ${orderId}`);
          const paymentStatusResp = await allpayAPI.getPaymentStatus(orderId);
          // Normalize to number (AllPay may return string "1")
          const apiStatus = Number(paymentStatusResp.status);
          logger.info(`[Polling] AllPay status: ${apiStatus} for order: ${orderId}`);
          paymentSuccessful = apiStatus === 1;
        }

        if (paymentSuccessful) {
          logger.info(`[Polling] Payment successful, creating subscription for order: ${orderId}`);

          // Get planId from stored metadata in transaction
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
