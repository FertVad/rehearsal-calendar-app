/**
 * Subscription Service
 * Business logic for managing user subscriptions, payments, and recurring billing
 *
 * Pattern: Service layer for complex business logic
 * - Separates business logic from HTTP routes
 * - Handles database transactions
 * - Coordinates with AllPay API client
 */

import db from '../database/db.js';
import { allpayAPI } from '../utils/allpayClient.js';
import { logger } from '../utils/logger.js';

/**
 * Get user's active subscription with plan details
 *
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Subscription with plan info or null
 */
export async function getUserActiveSubscription(userId) {
  const subscription = await db.get(
    `SELECT
      s.*,
      p.name as plan_name,
      p.display_name_en,
      p.display_name_ru,
      p.price_ils,
      p.max_projects,
      p.max_members_per_project,
      p.features_json
    FROM native_user_subscriptions s
    JOIN native_subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = $1 AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1`,
    [userId]
  );

  if (subscription && subscription.features_json) {
    subscription.features = JSON.parse(subscription.features_json);
    delete subscription.features_json;
  }

  if (subscription && subscription.metadata_json) {
    subscription.metadata = JSON.parse(subscription.metadata_json);
    delete subscription.metadata_json;
  }

  return subscription || null;
}

/**
 * Get all subscription plans
 *
 * @returns {Promise<Array>} - List of available plans
 */
export async function getSubscriptionPlans() {
  const plans = await db.all(
    `SELECT * FROM native_subscription_plans
     WHERE is_active = TRUE
     ORDER BY price_ils ASC`
  );

  return plans.map(plan => {
    if (plan.features_json) {
      plan.features = JSON.parse(plan.features_json);
      delete plan.features_json;
    }
    return plan;
  });
}

/**
 * Create subscription after successful payment
 * Called from webhook handler after payment confirmation
 *
 * @param {Object} options - Subscription details
 * @returns {Promise<Object>} - Created subscription
 */
export async function createSubscription({
  userId,
  planId,
  allpayToken,
  allpaySubscriptionId,
  allpayCustomerId,
  allpayOrderId,
  metadata = {},
}) {
  // Check if user already has active subscription
  const existingSubscription = await getUserActiveSubscription(userId);
  if (existingSubscription) {
    throw new Error('User already has an active subscription. Cancel existing subscription first.');
  }

  // Get plan details
  const plan = await db.get(
    'SELECT * FROM native_subscription_plans WHERE id = $1',
    [planId]
  );

  if (!plan) {
    throw new Error(`Subscription plan not found: ${planId}`);
  }

  // Calculate billing dates based on plan period
  const now = new Date();
  const currentPeriodStart = now;
  const currentPeriodEnd = new Date(now);
  let nextBillingDate = null;

  if (plan.billing_period === 'monthly') {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    nextBillingDate = new Date(currentPeriodEnd);
  } else if (plan.billing_period === 'quarterly') {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
    nextBillingDate = new Date(currentPeriodEnd);
  } else if (plan.billing_period === 'lifetime') {
    // Lifetime: set far future date (100 years)
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 100);
    nextBillingDate = null; // No recurring billing for lifetime
  }

  // Create subscription
  const result = await db.run(
    `INSERT INTO native_user_subscriptions (
      user_id, plan_id, status,
      allpay_token, allpay_subscription_id, allpay_customer_id,
      current_period_start, current_period_end, next_billing_date,
      started_at, metadata_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      userId,
      planId,
      'active',
      allpayToken,
      allpaySubscriptionId,
      allpayCustomerId,
      currentPeriodStart.toISOString(),
      currentPeriodEnd.toISOString(),
      nextBillingDate ? nextBillingDate.toISOString() : null,
      now.toISOString(),
      JSON.stringify(metadata),
    ]
  );

  // Record initial payment transaction
  await db.run(
    `INSERT INTO native_payment_transactions (
      user_id, subscription_id, allpay_order_id,
      amount, currency, transaction_type, status, completed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      result.lastID,
      allpayOrderId,
      plan.price_ils,
      'ILS',
      'initial',
      'completed',
      now.toISOString(),
    ]
  );

  logger.info(`[Subscriptions] Created subscription for user ${userId}, plan ${plan.name}`);

  return {
    id: result.lastID,
    userId,
    planId,
    status: 'active',
    currentPeriodStart,
    currentPeriodEnd,
    nextBillingDate,
  };
}

/**
 * Cancel user subscription
 *
 * @param {number} userId - User ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} - Updated subscription
 */
export async function cancelSubscription(userId, reason = 'User requested cancellation') {
  const subscription = await getUserActiveSubscription(userId);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  // Cancel with AllPay if subscription ID exists
  if (subscription.allpay_subscription_id) {
    try {
      await allpayAPI.cancelSubscription(subscription.allpay_subscription_id);
      logger.info(`[Subscriptions] Cancelled AllPay subscription: ${subscription.allpay_subscription_id}`);
    } catch (error) {
      logger.error('[Subscriptions] Failed to cancel AllPay subscription:', error);
      // Continue with local cancellation even if AllPay fails
    }
  }

  // Update subscription status
  const now = new Date();
  await db.run(
    `UPDATE native_user_subscriptions
     SET status = 'cancelled',
         cancelled_at = $1,
         cancellation_reason = $2,
         updated_at = $3
     WHERE id = $4`,
    [now.toISOString(), reason, now.toISOString(), subscription.id]
  );

  logger.info(`[Subscriptions] Cancelled subscription ${subscription.id} for user ${userId}`);

  return {
    id: subscription.id,
    status: 'cancelled',
    cancelledAt: now,
    reason,
  };
}

/**
 * Process recurring billing for all active subscriptions
 * Called by cron job daily
 *
 * @returns {Promise<Object>} - Processing results
 */
export async function processRecurringBilling() {
  const now = new Date();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  // Find subscriptions due for renewal (next_billing_date <= now)
  // Excludes lifetime subscriptions (next_billing_date IS NULL)
  const dueSubscriptions = await db.all(
    `SELECT s.*, p.price_ils, p.name as plan_name, p.billing_period
     FROM native_user_subscriptions s
     JOIN native_subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'active'
       AND s.next_billing_date IS NOT NULL
       AND s.next_billing_date <= $1
       AND s.allpay_token IS NOT NULL`,
    [now.toISOString()]
  );

  logger.info(`[Recurring Billing] Found ${dueSubscriptions.length} subscriptions due for renewal`);

  for (const subscription of dueSubscriptions) {
    results.processed++;

    try {
      // Generate unique order ID for this billing cycle
      const orderId = `SUB-${subscription.id}-${Date.now()}`;

      // Charge the token
      const chargeResult = await allpayAPI.chargeToken({
        allpayToken: subscription.allpay_token,
        amount: subscription.price_ils,
        currency: 'ILS',
        description: `Recurring payment - ${subscription.plan_name}`,
        orderId,
      });

      // Check payment status
      const isSuccessful = chargeResult.status === 1 || chargeResult.allpay_payment_status === 1;

      if (isSuccessful) {
        // Update subscription billing dates based on plan period
        const newPeriodEnd = new Date(subscription.current_period_end);

        if (subscription.billing_period === 'monthly') {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        } else if (subscription.billing_period === 'quarterly') {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 3);
        }

        const newNextBillingDate = new Date(newPeriodEnd);

        await db.run(
          `UPDATE native_user_subscriptions
           SET current_period_start = current_period_end,
               current_period_end = $1,
               next_billing_date = $2,
               updated_at = $3
           WHERE id = $4`,
          [
            newPeriodEnd.toISOString(),
            newNextBillingDate.toISOString(),
            now.toISOString(),
            subscription.id,
          ]
        );

        // Record successful transaction
        await db.run(
          `INSERT INTO native_payment_transactions (
            user_id, subscription_id, allpay_order_id,
            allpay_transaction_id, allpay_payment_status,
            amount, currency, transaction_type, status,
            completed_at, allpay_response_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            subscription.user_id,
            subscription.id,
            orderId,
            chargeResult.transaction_id || null,
            chargeResult.allpay_payment_status || 1,
            subscription.price_ils,
            'ILS',
            'recurring',
            'completed',
            now.toISOString(),
            JSON.stringify(chargeResult),
          ]
        );

        results.successful++;
        logger.info(`[Recurring Billing] Successfully charged subscription ${subscription.id}`);
      } else {
        throw new Error(`Payment failed with status: ${chargeResult.status || 'unknown'}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        error: error.message,
      });

      logger.error(`[Recurring Billing] Failed to charge subscription ${subscription.id}:`, error);

      // Update subscription status to payment_failed
      await db.run(
        `UPDATE native_user_subscriptions
         SET status = 'payment_failed', updated_at = $1
         WHERE id = $2`,
        [now.toISOString(), subscription.id]
      );

      // Record failed transaction
      const orderId = `SUB-${subscription.id}-${Date.now()}`;
      await db.run(
        `INSERT INTO native_payment_transactions (
          user_id, subscription_id, allpay_order_id,
          amount, currency, transaction_type, status,
          attempted_at, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          subscription.user_id,
          subscription.id,
          orderId,
          subscription.price_ils,
          'ILS',
          'recurring',
          'failed',
          now.toISOString(),
          error.message,
        ]
      );

      // TODO: Send notification to user about payment failure
    }
  }

  logger.info(
    `[Recurring Billing] Completed. Processed: ${results.processed}, ` +
    `Successful: ${results.successful}, Failed: ${results.failed}`
  );

  return results;
}

/**
 * Get user's payment history
 *
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of transactions to return
 * @returns {Promise<Array>} - Payment transactions
 */
export async function getPaymentHistory(userId, limit = 50) {
  const transactions = await db.all(
    `SELECT
      t.*,
      s.plan_id,
      p.name as plan_name,
      p.display_name_en,
      p.display_name_ru
    FROM native_payment_transactions t
    LEFT JOIN native_user_subscriptions s ON t.subscription_id = s.id
    LEFT JOIN native_subscription_plans p ON s.plan_id = p.id
    WHERE t.user_id = $1
    ORDER BY t.attempted_at DESC
    LIMIT $2`,
    [userId, limit]
  );

  return transactions.map(transaction => {
    if (transaction.allpay_response_json) {
      transaction.allpay_response = JSON.parse(transaction.allpay_response_json);
      delete transaction.allpay_response_json;
    }
    return transaction;
  });
}

/**
 * Handle webhook event from AllPay
 * Processes payment confirmations and updates subscription status
 *
 * @param {Object} payload - Webhook payload from AllPay
 * @param {string} signature - Signature from AllPay header
 * @returns {Promise<Object>} - Processing result
 */
export async function processWebhookEvent(payload, signature) {
  const { verifyWebhookSignature } = await import('../utils/allpayClient.js');

  // Verify signature
  const isValid = verifyWebhookSignature(payload, signature);
  if (!isValid) {
    logger.warn('[Webhook] Invalid signature received');
    throw new Error('Invalid webhook signature');
  }

  // Create idempotency key to prevent duplicate processing
  const idempotencyKey = `${payload.order_id}-${payload.status}-${Date.now()}`;

  // Check if event already processed
  const existingEvent = await db.get(
    'SELECT id FROM native_allpay_webhook_events WHERE idempotency_key = $1',
    [idempotencyKey]
  );

  if (existingEvent) {
    logger.info(`[Webhook] Event already processed: ${idempotencyKey}`);
    return { success: true, message: 'Event already processed' };
  }

  // Store webhook event
  const eventType = payload.status === 1 ? 'payment_success' : 'payment_failed';
  const now = new Date();

  await db.run(
    `INSERT INTO native_allpay_webhook_events (
      event_type, allpay_order_id, signature, is_verified,
      processing_status, payload_json, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      eventType,
      payload.order_id,
      signature,
      1,
      'pending',
      JSON.stringify(payload),
      idempotencyKey,
    ]
  );

  try {
    // Process based on event type
    if (eventType === 'payment_success') {
      // Find transaction by order ID
      const transaction = await db.get(
        'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1',
        [payload.order_id]
      );

      if (transaction) {
        // Update existing transaction
        await db.run(
          `UPDATE native_payment_transactions
           SET status = 'completed',
               allpay_transaction_id = $1,
               allpay_payment_status = $2,
               completed_at = $3,
               allpay_response_json = $4
           WHERE allpay_order_id = $5`,
          [
            payload.transaction_id,
            payload.status,
            now.toISOString(),
            JSON.stringify(payload),
            payload.order_id,
          ]
        );

        logger.info(`[Webhook] Updated transaction for order ${payload.order_id}`);
      } else {
        logger.warn(`[Webhook] Transaction not found for order ${payload.order_id}`);
      }
    } else if (eventType === 'payment_failed') {
      // Update transaction and subscription status
      await db.run(
        `UPDATE native_payment_transactions
         SET status = 'failed',
             error_message = $1,
             allpay_response_json = $2
         WHERE allpay_order_id = $3`,
        [
          payload.error_message || 'Payment failed',
          JSON.stringify(payload),
          payload.order_id,
        ]
      );

      logger.warn(`[Webhook] Payment failed for order ${payload.order_id}`);
    }

    // Mark webhook as processed
    await db.run(
      `UPDATE native_allpay_webhook_events
       SET processing_status = 'processed', processed_at = $1
       WHERE idempotency_key = $2`,
      [now.toISOString(), idempotencyKey]
    );

    return { success: true, eventType };
  } catch (error) {
    logger.error('[Webhook] Processing error:', error);

    // Mark webhook as failed
    await db.run(
      `UPDATE native_allpay_webhook_events
       SET processing_status = 'failed', processing_error = $1
       WHERE idempotency_key = $2`,
      [error.message, idempotencyKey]
    );

    throw error;
  }
}
