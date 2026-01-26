#!/usr/bin/env node
/**
 * Check user 9 credentials and test login
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function checkUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Checking user 9 in database...\n');

    const result = await pool.query(
      'SELECT id, email, first_name, password_hash FROM native_users WHERE id = 9'
    );

    if (result.rows.length === 0) {
      console.log('❌ User 9 not found!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.first_name}`);
    console.log(`   Has password: ${user.password_hash ? 'Yes' : 'No'}`);

    // Test login via API
    console.log('\n📡 Testing login API...');
    console.log(`   POST http://localhost:3001/api/auth/login`);
    console.log(`   Body: { email: "${user.email}", password: "..." }`);

    console.log('\n💡 To test the subscription screen:');
    console.log('   1. Login on your device with:');
    console.log(`      Email: ${user.email}`);
    console.log('   2. Go to Profile → Subscription');
    console.log('   3. You should see the subscription management screen');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();
