#!/usr/bin/env node
/**
 * Test subscription API for user 9
 */

import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';

dotenv.config();
const { Pool } = pg;

async function testSubscription() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const userId = 9;

  try {
    console.log('🔌 Connecting to database...');

    // Generate JWT token for user 9
    const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret-key', { expiresIn: '24h' });
    console.log('🔑 Generated token for user 9');

    // Test 1: Get current subscription
    console.log('\n📡 Test 1: GET /api/native/subscriptions/current');
    const subscriptionResponse = await fetch('http://localhost:3001/api/native/subscriptions/current', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (subscriptionResponse.ok) {
      const data = await subscriptionResponse.json();
      console.log('✅ Subscription data:', JSON.stringify(data, null, 2));
    } else {
      const error = await subscriptionResponse.text();
      console.error('❌ Error:', subscriptionResponse.status, error);
    }

    // Test 2: Get payment history
    console.log('\n📡 Test 2: GET /api/native/subscriptions/payments');
    const paymentsResponse = await fetch('http://localhost:3001/api/native/subscriptions/payments?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (paymentsResponse.ok) {
      const data = await paymentsResponse.json();
      console.log('✅ Payment history:');
      console.log(`   Found ${data.payments?.length || 0} payments`);
      data.payments?.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. ${payment.transaction_type} - ₪${payment.amount} - ${payment.status} - ${new Date(payment.attempted_at).toLocaleDateString()}`);
      });
    } else {
      const error = await paymentsResponse.text();
      console.error('❌ Error:', paymentsResponse.status, error);
    }

    // Test 3: Direct database query
    console.log('\n📊 Test 3: Direct database query');
    const dbResult = await pool.query(
      `SELECT
        s.id, s.status, s.next_billing_date,
        p.name as plan_name, p.display_name_en, p.display_name_ru
      FROM native_user_subscriptions s
      JOIN native_subscription_plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'`,
      [userId]
    );

    if (dbResult.rows.length > 0) {
      console.log('✅ Database subscription:', dbResult.rows[0]);
    } else {
      console.log('⚠️  No active subscription found in database');
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testSubscription();
