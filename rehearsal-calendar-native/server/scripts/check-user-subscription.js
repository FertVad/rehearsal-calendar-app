/**
 * Check user subscription status
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { initDatabase } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkSubscription() {
  try {
    await initDatabase();

    const userId = 9;

    console.log(`\n=== Checking subscription for user ${userId} ===\n`);

    // Check subscription
    const subscription = await db.get(
      `SELECT s.*, p.name as plan_name, p.price_usd
       FROM native_user_subscriptions s
       JOIN native_subscription_plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscription) {
      console.log('✅ Subscription found:');
      console.table({
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan_name,
        price_usd: subscription.price_usd,
        allpay_token: subscription.allpay_token,
        next_billing: subscription.next_billing_date,
        created_at: subscription.created_at,
      });
    } else {
      console.log('❌ No subscription found');
    }

    // Check recent transactions
    const transactions = await db.all(
      `SELECT * FROM native_payment_transactions
       WHERE user_id = $1
       ORDER BY attempted_at DESC
       LIMIT 5`,
      [userId]
    );

    console.log(`\n=== Recent transactions (${transactions.length}) ===`);
    if (transactions.length > 0) {
      console.table(transactions.map(t => ({
        id: t.id,
        order_id: t.allpay_order_id,
        amount: t.amount,
        currency: t.currency,
        type: t.transaction_type,
        status: t.status,
        attempted_at: t.attempted_at,
      })));
    } else {
      console.log('No transactions found');
    }

    // Check webhook events
    const webhooks = await db.all(
      `SELECT * FROM native_allpay_webhook_events
       ORDER BY created_at DESC
       LIMIT 5`
    );

    console.log(`\n=== Recent webhook events (${webhooks.length}) ===`);
    if (webhooks.length > 0) {
      console.table(webhooks.map(w => ({
        id: w.id,
        event_type: w.event_type,
        order_id: w.allpay_order_id,
        status: w.processing_status,
        verified: w.is_verified,
        created_at: w.created_at,
      })));
    } else {
      console.log('No webhook events found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSubscription();
