#!/usr/bin/env node
/**
 * Script: Add test subscription to user ID 3
 * Usage: node scripts/add-test-subscription.js
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function addTestSubscription() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');

    // Check if user exists
    const userCheck = await pool.query('SELECT id, email, first_name FROM native_users WHERE id = $1', [3]);
    if (userCheck.rows.length === 0) {
      console.error('❌ User with ID 3 not found!');
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`✅ Found user: ${user.first_name} (${user.email})`);

    // Get lifetime plan
    const planCheck = await pool.query("SELECT * FROM native_subscription_plans WHERE name = 'lifetime' AND is_active = TRUE");
    if (planCheck.rows.length === 0) {
      console.error('❌ Lifetime plan not found!');
      process.exit(1);
    }

    const plan = planCheck.rows[0];
    console.log(`✅ Found plan: ${plan.display_name_en} (${plan.price_ils} ILS)`);

    // Check if user already has active subscription
    const existingCheck = await pool.query(
      "SELECT * FROM native_user_subscriptions WHERE user_id = $1 AND status = 'active'",
      [3]
    );

    if (existingCheck.rows.length > 0) {
      console.log('⚠️  User already has an active subscription!');
      console.log('Current subscription:', existingCheck.rows[0]);

      // Update existing subscription to lifetime
      await pool.query(
        `UPDATE native_user_subscriptions
         SET plan_id = $1,
             status = 'active',
             next_billing_date = NULL,
             started_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND status = 'active'`,
        [plan.id, 3]
      );
      console.log('✅ Updated existing subscription to Lifetime Premium');
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
        ) VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [3, plan.id]
      );

      console.log('✅ Created new Lifetime Premium subscription!');
      console.log('Subscription details:', result.rows[0]);
    }

    // Create a payment transaction record
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
        completed_at,
        allpay_response_json
      ) VALUES (
        $1,
        (SELECT id FROM native_user_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1),
        'TEST-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT,
        1,
        $2,
        'ILS',
        'test_payment',
        'initial',
        'completed',
        CURRENT_TIMESTAMP,
        '{"test": true, "note": "Test subscription for development"}'
      )`,
      [3, plan.price_ils]
    );

    console.log('✅ Created payment transaction record');
    console.log('\n🎉 User ID 3 now has Premium access!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

addTestSubscription();
