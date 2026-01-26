/**
 * Simulate AllPay webhook for testing
 * Manually triggers subscription creation after successful payment
 */

import { config } from 'dotenv';
config();

import { initDatabase } from './database/db.js';
import { createSubscription } from './services/subscriptionService.js';
import { allpayAPI } from './utils/allpayClient.js';

const db = await initDatabase();

const orderId = process.argv[2] || 'ORDER-3-1769416585322';

console.log(`\nSimulating successful payment for: ${orderId}\n`);

try {
  // Get transaction details
  const transaction = await db.get(
    'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1',
    [orderId]
  );

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  console.log('Transaction found:', transaction.allpay_order_id);

  // Parse custom data to get userId and planId
  const customData = JSON.parse(transaction.allpay_response_json || '{"userId":3,"planId":4}');
  const { userId, planId } = customData;

  console.log(`Creating subscription for user ${userId}, plan ${planId}`);

  // Get AllPay token (simulated for testing)
  console.log('⚠️  Skipping token retrieval for testing');
  const allpayToken = 'TEST_TOKEN_' + Date.now();

  // Create subscription
  const subscription = await createSubscription({
    userId,
    planId,
    allpayToken,
    allpayTransactionId: 'TEST_TX_' + Date.now(),
  });

  console.log('\n✅ Subscription created successfully!');

  // Update transaction status
  await db.run(
    `UPDATE native_payment_transactions
     SET status = 'completed',
         allpay_transaction_id = $1,
         allpay_payment_status = 1,
         completed_at = CURRENT_TIMESTAMP
     WHERE allpay_order_id = $2`,
    ['TEST_TX_' + Date.now(), orderId]
  );

  console.log('✅ Transaction marked as completed');

  // Verify subscription
  const activeSubscription = await db.get(
    'SELECT * FROM native_user_subscriptions WHERE user_id = $1 AND status = $2 ORDER BY id DESC LIMIT 1',
    [userId, 'active']
  );

  if (activeSubscription) {
    console.log('\n✅ Active subscription confirmed:');
    console.log(JSON.stringify(activeSubscription, null, 2));
  } else {
    console.log('\n⚠️ No active subscription found');
  }

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}

process.exit(0);
