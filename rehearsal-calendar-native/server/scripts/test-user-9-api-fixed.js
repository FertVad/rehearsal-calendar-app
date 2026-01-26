#!/usr/bin/env node
/**
 * Test subscription API for user 9 with correct JWT token
 */

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

async function testSubscription() {
  const userId = 9;

  try {
    // Generate JWT token with correct format (including type: 'access')
    const token = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('🔑 Generated access token for user 9');
    console.log('Token:', token.substring(0, 50) + '...\n');

    // Test 1: Get current subscription
    console.log('📡 Test 1: GET /api/native/subscriptions/current');
    const subscriptionResponse = await fetch('http://localhost:3001/api/native/subscriptions/current', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (subscriptionResponse.ok) {
      const data = await subscriptionResponse.json();
      console.log('✅ Success!');
      console.log('Subscription:', JSON.stringify(data, null, 2));
    } else {
      const error = await subscriptionResponse.text();
      console.error('❌ Error:', subscriptionResponse.status, error);
      return;
    }

    // Test 2: Get payment history
    console.log('\n📡 Test 2: GET /api/native/subscriptions/payments');
    const paymentsResponse = await fetch('http://localhost:3001/api/native/subscriptions/payments?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (paymentsResponse.ok) {
      const data = await paymentsResponse.json();
      console.log(`✅ Found ${data.payments?.length || 0} payments:`);
      if (data.payments && data.payments.length > 0) {
        data.payments.forEach((payment, idx) => {
          console.log(`   ${idx + 1}. ${payment.transaction_type} - ₪${payment.amount} - ${payment.status} - ${new Date(payment.attempted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
        });
      } else {
        console.log('   (No payments found)');
      }
    } else {
      const error = await paymentsResponse.text();
      console.error('❌ Error:', paymentsResponse.status, error);
      return;
    }

    console.log('\n✅ All API tests passed!');
    console.log('\n📱 You can now test on your device with user ID 9 (Vadim)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testSubscription();
