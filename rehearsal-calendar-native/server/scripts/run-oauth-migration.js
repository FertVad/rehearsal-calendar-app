/**
 * Run OAuth migration on Neon PostgreSQL
 * Adds native_auth_providers table and migrates existing users
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.error('Please set DATABASE_URL in server/.env file');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Connecting to Neon PostgreSQL database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    // Check if table already exists
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'native_auth_providers'
    `);

    if (checkTable.rows.length > 0) {
      console.log('⚠️  Table native_auth_providers already exists');
      console.log('Migration may have already been run. Exiting...');
      process.exit(0);
    }

    console.log('🔄 Running OAuth migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001-add-oauth-providers-postgres.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ OAuth migration completed successfully!');

    // Verify migration
    const userCount = await pool.query('SELECT COUNT(*) as count FROM native_users');
    const providerCount = await pool.query('SELECT COUNT(*) as count FROM native_auth_providers WHERE provider_type = $1', ['email']);

    console.log(`📊 Total users: ${userCount.rows[0].count}`);
    console.log(`📊 Migrated to auth_providers: ${providerCount.rows[0].count}`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
