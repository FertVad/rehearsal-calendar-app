#!/usr/bin/env node
/**
 * Script: Test subscription API endpoint
 * Usage: node scripts/test-subscription-api.js [userId]
 */

import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

dotenv.config();
const { Pool } = pg;

async function testSubscriptionAPI() {
  const userId = parseInt(process.argv[2] || '3');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get user from database
    const userResult = await pool.query('SELECT * FROM native_users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      console.error(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.first_name} (${user.email})`);

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET not found in environment');
      process.exit(1);
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`🔑 Generated JWT token for user ${userId}`);

    // Test API endpoint
    const API_URL = 'http://localhost:3001';
    console.log(`\n📡 Testing API: GET ${API_URL}/api/native/subscriptions/current\n`);

    const response = await fetch(`${API_URL}/api/native/subscriptions/current`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ API Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.subscription) {
      console.log('\n🎉 SUCCESS: User has an active subscription!');
      console.log(`   Plan: ${data.subscription.display_name_en} (${data.subscription.display_name_ru})`);
      console.log(`   Status: ${data.subscription.status}`);
    } else {
      console.log('\n⚠️  No active subscription found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testSubscriptionAPI();
