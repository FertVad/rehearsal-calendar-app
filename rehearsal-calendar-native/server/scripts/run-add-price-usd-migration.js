/**
 * Run migration: Add price_usd to subscription plans
 * This script adds price_usd column and updates all plans to use USD pricing
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('Running migration: add-price-usd-to-plans.sql');

    // Read migration file
    const migrationPath = join(__dirname, '../migrations/add-price-usd-to-plans.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT'));

    for (const statement of statements) {
      await db.run(statement);
      console.log('✓ Executed statement');
    }

    // Check results
    const plans = await db.all('SELECT name, price_ils, price_usd, price_currency FROM native_subscription_plans');
    console.log('\n=== Updated Plans ===');
    console.table(plans);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
