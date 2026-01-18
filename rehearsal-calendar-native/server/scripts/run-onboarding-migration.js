/**
 * Run onboarding migration
 * Adds onboarding_completed field to native_users table
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Connecting to Neon database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    console.log('🔄 Running migration: add onboarding_completed to native_users...');

    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'native_users'
        AND column_name = 'onboarding_completed'
    `);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Column onboarding_completed already exists, skipping migration');
    } else {
      // Add the column
      await pool.query(`
        ALTER TABLE native_users
        ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Migration completed successfully!');
      console.log('   Added column: onboarding_completed BOOLEAN DEFAULT FALSE');
    }

    // Optional: Show table structure
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'native_users'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Current native_users table structure:');
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

runMigration();
