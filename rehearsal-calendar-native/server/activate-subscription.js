/**
 * Manually activate subscription for testing (simulates successful webhook)
 */

import { config } from 'dotenv';
config();

import { initDatabase } from './database/db.js';

const db = await initDatabase();

const orderId = process.argv[2] || 'ORDER-3-1769416585322';

console.log(`\nActivating subscription for order: ${orderId}\n`);

try {
  // Get transaction
  const transaction = await db.get(
    'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1',
    [orderId]
  );

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  console.log('Found transaction:', orderId);

  // Get plan details
  const plan = await db.get('SELECT * FROM native_subscription_plans WHERE id = $1', [4]); // monthly plan

  if (!plan) {
    throw new Error('Plan not found');
  }

  console.log(`Plan: ${plan.name} ($${plan.price_usd})`);

  const userId = 3; // From custom_data

  // Check for existing active subscription
  const existingSubscription = await db.get(
    'SELECT * FROM native_user_subscriptions WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );

  if (existingSubscription) {
    console.log('\n⚠️  User already has active subscription, cancelling it first...');
    await db.run(
      `UPDATE native_user_subscriptions
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           cancellation_reason = 'Replaced by new subscription'
       WHERE id = $1`,
      [existingSubscription.id]
    );
  }

  // Calculate billing dates
  const now = new Date();
  const nextBillingDate = new Date(now);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); // Monthly plan

  const periodEnd = new Date(nextBillingDate);

  // Create subscription
  const result = await db.run(
    `INSERT INTO native_user_subscriptions (
      user_id, plan_id, status,
      allpay_token,
      current_period_start, current_period_end, next_billing_date,
      started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      plan.id,
      'active',
      'TEST_TOKEN_' + Date.now(), // Test token
      now.toISOString(),
      periodEnd.toISOString(),
      nextBillingDate.toISOString(),
      now.toISOString()
    ]
  );

  console.log(`\n✅ Subscription created with ID: ${result.lastInsertId}`);

  // Update transaction
  await db.run(
    `UPDATE native_payment_transactions
     SET status = 'completed',
         subscription_id = $1,
         allpay_transaction_id = $2,
         allpay_payment_status = 1,
         payment_method = 'credit_card',
         completed_at = CURRENT_TIMESTAMP
     WHERE allpay_order_id = $3`,
    [result.lastInsertId, 'TEST_TX_' + Date.now(), orderId]
  );

  console.log('✅ Transaction marked as completed');

  // Verify
  const subscription = await db.get(
    'SELECT * FROM native_user_subscriptions WHERE id = $1',
    [result.lastInsertId]
  );

  console.log('\n✅ Active subscription:');
  console.log(JSON.stringify(subscription, null, 2));

  console.log('\n🎉 Subscription activated successfully!');
  console.log('\nNow refresh the app - polling should detect the subscription.');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}

process.exit(0);
