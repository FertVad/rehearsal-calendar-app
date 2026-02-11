/**
 * Add price_usd column to subscription plans
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { initDatabase } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function addPriceUSD() {
  try {
    console.log('Initializing database...');
    await initDatabase();

    console.log('Adding price_usd column...');

    // Add column (IF NOT EXISTS only works in PostgreSQL 9.6+)
    try {
      await db.run(`ALTER TABLE native_subscription_plans ADD COLUMN price_usd DECIMAL(10,2)`);
      console.log('✓ Column added');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
        console.log('✓ Column already exists');
      } else {
        throw error;
      }
    }

    console.log('\nUpdating plans with USD prices...');

    await db.run(`UPDATE native_subscription_plans SET price_usd = 9.00 WHERE name = 'monthly'`);
    console.log('✓ Updated monthly plan');

    await db.run(`UPDATE native_subscription_plans SET price_usd = 15.00 WHERE name = 'quarterly'`);
    console.log('✓ Updated quarterly plan');

    await db.run(`UPDATE native_subscription_plans SET price_usd = 49.00 WHERE name = 'lifetime'`);
    console.log('✓ Updated lifetime plan');

    await db.run(`UPDATE native_subscription_plans SET price_usd = 13.00 WHERE name = 'test_1min'`);
    console.log('✓ Updated test_1min plan');

    await db.run(`UPDATE native_subscription_plans SET price_currency = 'USD'`);
    console.log('✓ Updated price_currency to USD');

    // Check results
    const plans = await db.all('SELECT name, price_ils, price_usd, price_currency FROM native_subscription_plans ORDER BY price_ils');
    console.log('\n=== Updated Plans ===');
    console.table(plans);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

addPriceUSD();
