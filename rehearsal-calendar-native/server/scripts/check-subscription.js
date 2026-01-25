#!/usr/bin/env node
/**
 * Script: Check subscription status for user
 * Usage: node scripts/check-subscription.js [userId]
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function checkSubscription() {
  const userId = process.argv[2] || 3;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT
        u.id as user_id,
        u.first_name,
        u.email,
        s.id as subscription_id,
        s.status,
        p.display_name_ru,
        p.display_name_en,
        p.price_ils,
        s.started_at,
        s.next_billing_date,
        s.current_period_end
      FROM native_users u
      LEFT JOIN native_user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
      LEFT JOIN native_subscription_plans p ON s.plan_id = p.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      console.log(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const userData = result.rows[0];

    console.log('\n📊 User Subscription Status:');
    console.log('================================');
    console.log(`👤 User: ${userData.first_name} (${userData.email})`);
    console.log(`🆔 User ID: ${userData.user_id}`);

    if (userData.subscription_id) {
      console.log(`✅ Status: ${userData.status}`);
      console.log(`💎 Plan: ${userData.display_name_en} (${userData.display_name_ru})`);
      console.log(`💰 Price: ${userData.price_ils} ILS`);
      console.log(`📅 Started: ${userData.started_at}`);
      console.log(`📅 Next Billing: ${userData.next_billing_date || 'N/A (Lifetime)'}`);
      console.log('\n🎉 User has PREMIUM access!');
    } else {
      console.log('❌ No active subscription');
      console.log('\n⚠️  User does NOT have premium access');
    }

    console.log('================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSubscription();
