#!/usr/bin/env node
/**
 * Verify user 9 subscription data
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function verifySubscription() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const userId = 9;

  try {
    console.log('🔍 Verifying subscription data for user 9...\n');

    // Check user
    const user = await pool.query(
      'SELECT id, email, first_name FROM native_users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      console.error('❌ User 9 not found!');
      return;
    }

    console.log('✅ User:', user.rows[0].first_name, '(' + user.rows[0].email + ')');

    // Check subscription
    const subscription = await pool.query(
      `SELECT s.id, s.status, s.current_period_end, s.next_billing_date, s.started_at,
              p.name as plan_name, p.display_name_en, p.display_name_ru, p.price_ils
       FROM native_user_subscriptions s
       JOIN native_subscription_plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscription.rows.length === 0) {
      console.error('❌ No active subscription found!');
      return;
    }

    const sub = subscription.rows[0];
    console.log('\n✅ Active Subscription:');
    console.log(`   Plan: ${sub.display_name_en} (${sub.display_name_ru})`);
    console.log(`   Status: ${sub.status}`);
    console.log(`   Price: ₪${sub.price_ils}`);
    console.log(`   Started: ${new Date(sub.started_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`   Current period ends: ${new Date(sub.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`   Next billing: ${sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A (Lifetime)'}`);

    // Check payment history
    const payments = await pool.query(
      `SELECT t.id, t.amount, t.currency, t.transaction_type, t.status,
              t.attempted_at, t.completed_at,
              p.display_name_en as plan_name
       FROM native_payment_transactions t
       LEFT JOIN native_user_subscriptions s ON t.subscription_id = s.id
       LEFT JOIN native_subscription_plans p ON s.plan_id = p.id
       WHERE t.user_id = $1
       ORDER BY t.attempted_at DESC`,
      [userId]
    );

    console.log(`\n✅ Payment History (${payments.rows.length} transactions):`);
    if (payments.rows.length === 0) {
      console.log('   (No transactions found)');
    } else {
      payments.rows.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. ${payment.transaction_type.padEnd(10)} - ₪${payment.amount} - ${payment.status.padEnd(10)} - ${new Date(payment.attempted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - ${payment.plan_name || 'N/A'}`);
      });
    }

    console.log('\n✅ Data verification complete!');
    console.log('\n📱 What the user will see on the device:');
    console.log('   1. Subscription Management screen with:');
    console.log('      - Purple subscription card with plan details');
    console.log(`      - Status: Активна (Active)`);
    console.log(`      - Next billing: ${sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Навсегда (Lifetime)'}`);
    console.log(`   2. Payment History section with ${payments.rows.length} cards`);
    console.log(`   3. "Посмотреть планы" button at the bottom`);
    console.log(`   4. "Отменить подписку" button in subscription card`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

verifySubscription();
