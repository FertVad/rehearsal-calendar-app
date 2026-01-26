#!/usr/bin/env node
/**
 * Script: Add test subscription to user ID 9
 * Usage: node scripts/add-subscription-user-9.js
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function addTestSubscription() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const userId = 9;

  try {
    console.log('🔌 Connecting to database...');

    // Check if user exists
    const userCheck = await pool.query('SELECT id, email, first_name FROM native_users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      console.error(`❌ User with ID ${userId} not found!`);
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`✅ Found user: ${user.first_name} (${user.email})`);

    // Get monthly plan
    const planCheck = await pool.query("SELECT * FROM native_subscription_plans WHERE name = 'monthly' AND is_active = TRUE");
    if (planCheck.rows.length === 0) {
      console.error('❌ Monthly plan not found!');
      process.exit(1);
    }

    const plan = planCheck.rows[0];
    console.log(`✅ Found plan: ${plan.display_name_en} (₪${plan.price_ils})`);

    // Check if user already has active subscription
    const existingCheck = await pool.query(
      "SELECT * FROM native_user_subscriptions WHERE user_id = $1 AND status = 'active'",
      [userId]
    );

    let subscriptionId;

    if (existingCheck.rows.length > 0) {
      console.log('⚠️  User already has an active subscription!');
      console.log('Current subscription:', existingCheck.rows[0]);

      // Update existing subscription to monthly
      const updateResult = await pool.query(
        `UPDATE native_user_subscriptions
         SET plan_id = $1,
             status = 'active',
             current_period_start = CURRENT_TIMESTAMP,
             current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 month',
             next_billing_date = CURRENT_TIMESTAMP + INTERVAL '1 month',
             started_at = CURRENT_TIMESTAMP - INTERVAL '3 months',
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND status = 'active'
         RETURNING id`,
        [plan.id, userId]
      );
      subscriptionId = updateResult.rows[0].id;
      console.log('✅ Updated existing subscription to Monthly Premium');
    } else {
      // Create new subscription
      const result = await pool.query(
        `INSERT INTO native_user_subscriptions (
          user_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          next_billing_date,
          started_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month', CURRENT_TIMESTAMP + INTERVAL '1 month', CURRENT_TIMESTAMP - INTERVAL '3 months', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [userId, plan.id]
      );

      subscriptionId = result.rows[0].id;
      console.log('✅ Created new Monthly Premium subscription!');
      console.log('Subscription details:', result.rows[0]);
    }

    // Delete existing payment transactions for this user to start fresh
    await pool.query('DELETE FROM native_payment_transactions WHERE user_id = $1', [userId]);
    console.log('🗑️  Cleared existing payment transactions');

    // Create payment transaction history (4 months of payments)
    const transactions = [
      {
        daysAgo: 90,
        type: 'initial',
        status: 'completed',
        amount: plan.price_ils,
      },
      {
        daysAgo: 60,
        type: 'recurring',
        status: 'completed',
        amount: plan.price_ils,
      },
      {
        daysAgo: 30,
        type: 'recurring',
        status: 'completed',
        amount: plan.price_ils,
      },
      {
        daysAgo: 5,
        type: 'recurring',
        status: 'completed',
        amount: plan.price_ils,
      },
    ];

    console.log('\n📊 Creating payment history...');
    for (const tx of transactions) {
      await pool.query(
        `INSERT INTO native_payment_transactions (
          user_id,
          subscription_id,
          allpay_order_id,
          allpay_payment_status,
          amount,
          currency,
          payment_method,
          transaction_type,
          status,
          attempted_at,
          completed_at,
          allpay_response_json
        ) VALUES (
          $1, $2, $3, $4, $5, 'ILS', 'credit_card', $6, $7,
          CURRENT_TIMESTAMP - INTERVAL '${tx.daysAgo} days',
          CURRENT_TIMESTAMP - INTERVAL '${tx.daysAgo} days',
          '{"test": true, "note": "Test transaction for development"}'
        )`,
        [
          userId,
          subscriptionId,
          `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          1, // paid status
          tx.amount,
          tx.type,
          tx.status,
        ]
      );
      console.log(`  ✓ ${tx.type} payment from ${tx.daysAgo} days ago (${tx.status})`);
    }

    console.log('\n✅ Created payment transaction history');
    console.log(`\n🎉 User ID ${userId} now has Premium access with payment history!`);
    console.log(`\n📱 You can now test the subscription management screen on your device.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

addTestSubscription();
