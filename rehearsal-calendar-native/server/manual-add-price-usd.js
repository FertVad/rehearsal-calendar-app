import { config } from 'dotenv';
config();

import { initDatabase } from './database/db.js';

const db = await initDatabase();

console.log('Adding price_usd column...');

try {
  // Add column
  await db.run('ALTER TABLE native_subscription_plans ADD COLUMN price_usd DECIMAL(10,2)');
  console.log('✅ Column added');
} catch (error) {
  if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
    console.log('⚠️  Column already exists, skipping ADD COLUMN');
  } else {
    console.error('Error adding column:', error.message);
    throw error;
  }
}

console.log('Updating prices...');

// Update prices
await db.run(`UPDATE native_subscription_plans SET price_usd = 9.00 WHERE name = 'monthly'`);
await db.run(`UPDATE native_subscription_plans SET price_usd = 15.00 WHERE name = 'quarterly'`);
await db.run(`UPDATE native_subscription_plans SET price_usd = 49.00 WHERE name = 'lifetime'`);

console.log('✅ Prices updated');

// Verify
const plans = await db.all('SELECT id, name, price_ils, price_usd FROM native_subscription_plans ORDER BY id');
console.log('\nUpdated plans:');
console.table(plans);

process.exit(0);
