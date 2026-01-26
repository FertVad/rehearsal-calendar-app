#!/usr/bin/env node
/**
 * Create session for user 9 and test API
 */

import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();
const { Pool } = pg;

async function createSessionAndTest() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
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

    // Delete old sessions for this user
    await pool.query('DELETE FROM native_sessions WHERE user_id = $1', [userId]);
    console.log('🗑️  Cleared old sessions');

    // Generate new token
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Create session in database
    const sessionId = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `INSERT INTO native_sessions (id, user_id, token, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', NOW(), NOW())`,
      [sessionId, userId, token]
    );

    console.log('✅ Created new session');
    console.log('🔑 Token:', token);

    // Test API endpoints
    console.log('\n📡 Testing API endpoints...\n');

    // Test 1: Get current subscription
    console.log('Test 1: GET /api/native/subscriptions/current');
    const subscriptionResponse = await fetch('http://localhost:3001/api/native/subscriptions/current', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (subscriptionResponse.ok) {
      const data = await subscriptionResponse.json();
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } else {
      const error = await subscriptionResponse.text();
      console.error('❌ Error:', subscriptionResponse.status, error);
    }

    // Test 2: Get payment history
    console.log('\nTest 2: GET /api/native/subscriptions/payments');
    const paymentsResponse = await fetch('http://localhost:3001/api/native/subscriptions/payments?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (paymentsResponse.ok) {
      const data = await paymentsResponse.json();
      console.log(`✅ Found ${data.payments?.length || 0} payments:`);
      data.payments?.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. ${payment.transaction_type} - ₪${payment.amount} - ${payment.status} - ${new Date(payment.attempted_at).toLocaleDateString()}`);
      });
    } else {
      const error = await paymentsResponse.text();
      console.error('❌ Error:', paymentsResponse.status, error);
    }

    console.log('\n✅ Session created successfully! You can now login on your device.');
    console.log(`📱 Use this token to test API calls (valid for 30 days):`);
    console.log(token);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

createSessionAndTest();
