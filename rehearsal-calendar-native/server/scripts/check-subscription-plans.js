/**
 * Check Subscription Plans in Neon Database
 * Verifies that subscription plans were created correctly
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkPlans() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔗 Connecting to Neon PostgreSQL...');

    const result = await pool.query(`
      SELECT
        id,
        name,
        display_name_en,
        display_name_ru,
        price_ils,
        billing_period,
        max_projects,
        max_members_per_project
      FROM native_subscription_plans
      ORDER BY price_ils ASC
    `);

    console.log(`\n✅ Found ${result.rows.length} subscription plans:\n`);

    result.rows.forEach((plan) => {
      const priceUSD = (plan.price_ils / 3.6).toFixed(2);
      console.log(`📋 ${plan.name.toUpperCase()} (${plan.display_name_en})`);
      console.log(`   Price: ₪${plan.price_ils} (~$${priceUSD})`);
      console.log(`   Period: ${plan.billing_period}`);
      console.log(`   Limits: ${plan.max_projects} projects, ${plan.max_members_per_project} members/project`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkPlans();
