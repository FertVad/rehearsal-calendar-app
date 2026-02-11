/**
 * Manually create subscription from successful payment
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { initDatabase } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function createSubscription() {
  try {
    await initDatabase();

    const orderId = 'ORDER-9-1770825386367';
    const allpayToken = '698CA6BD077979-28092708';
    const userId = 9;

    console.log(`\n=== Creating subscription for user ${userId} ===`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Token: ${allpayToken}\n`);

    // Get transaction
    const transaction = await db.get(
      'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1',
      [orderId]
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    console.log('✓ Transaction found:', {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
    });

    // Get plan (test_1min)
    const plan = await db.get(
      'SELECT * FROM native_subscription_plans WHERE name = $1',
      ['test_1min']
    );

    if (!plan) {
      throw new Error('Plan not found');
    }

    console.log('✓ Plan found:', {
      id: plan.id,
      name: plan.name,
      price_ils: plan.price_ils,
      price_usd: plan.price_usd,
      billing_period: plan.billing_period,
    });

    // Check if subscription already exists
    const existing = await db.get(
      'SELECT * FROM native_user_subscriptions WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (existing) {
      console.log('\n⚠️  Active subscription already exists:', {
        id: existing.id,
        plan_id: existing.plan_id,
        status: existing.status,
        created_at: existing.created_at,
      });
      console.log('\nDo you want to cancel it and create a new one? (Ctrl+C to abort)');
      // For now, just update the existing one
      await db.run(
        `UPDATE native_user_subscriptions
         SET allpay_token = $1, status = 'active', updated_at = $2
         WHERE id = $3`,
        [allpayToken, new Date().toISOString(), existing.id]
      );
      console.log('\n✅ Updated existing subscription with new token');
    } else {
      // Create new subscription
      const now = new Date();

      // Calculate next billing date based on plan
      let nextBilling;
      if (plan.name === 'test_1min') {
        // Test plan: 1 minute from now
        nextBilling = new Date(now.getTime() + 1 * 60 * 1000);
      } else if (plan.name === 'lifetime') {
        // Lifetime: no next billing
        nextBilling = null;
      } else {
        // Regular plans: use billing_period in days
        const days = parseInt(plan.billing_period) || 30;
        nextBilling = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const result = await db.run(
        `INSERT INTO native_user_subscriptions (
          user_id, plan_id, status, allpay_token, next_billing_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, plan.id, 'active', allpayToken, nextBilling ? nextBilling.toISOString() : null, now.toISOString(), now.toISOString()]
      );

      console.log('\n✅ Subscription created successfully!', {
        id: result.lastID,
        next_billing: nextBilling ? nextBilling.toISOString() : 'never (lifetime)',
      });
    }

    // Update transaction status
    await db.run(
      `UPDATE native_payment_transactions
       SET status = $1, completed_at = $2
       WHERE allpay_order_id = $3`,
      ['completed', new Date().toISOString(), orderId]
    );

    console.log('✓ Transaction marked as completed');

    // Show final status
    const subscription = await db.get(
      `SELECT s.*, p.name as plan_name, p.price_usd
       FROM native_user_subscriptions s
       JOIN native_subscription_plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'`,
      [userId]
    );

    console.log('\n=== Final subscription status ===');
    console.table({
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plan_name,
      price_usd: subscription.price_usd,
      token: subscription.allpay_token,
      next_billing: subscription.next_billing_date,
    });

    console.log('\n✅ Done! User can now create projects.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createSubscription();
