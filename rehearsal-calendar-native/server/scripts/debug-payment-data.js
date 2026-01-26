#!/usr/bin/env node
/**
 * Debug payment history data structure
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function debugPaymentData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const userId = 9;

  try {
    console.log('🔍 Debugging payment data for user 9...\n');

    const result = await pool.query(
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
      LIMIT 5`,
      [userId]
    );

    console.log(`Found ${result.rows.length} payments\n`);

    if (result.rows.length > 0) {
      const firstPayment = result.rows[0];

      console.log('First payment data:');
      console.log('==================');
      console.log('Raw data:', JSON.stringify(firstPayment, null, 2));

      console.log('\n\nType analysis:');
      console.log('==================');
      console.log('amount type:', typeof firstPayment.amount);
      console.log('amount value:', firstPayment.amount);
      console.log('amount is number?', typeof firstPayment.amount === 'number');
      console.log('amount is string?', typeof firstPayment.amount === 'string');

      if (typeof firstPayment.amount === 'string') {
        console.log('\n⚠️  PROBLEM: amount is a STRING, not a number!');
        console.log('   This is why toFixed() fails.');
        console.log('   Need to convert with parseFloat()');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugPaymentData();
