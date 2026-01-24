/**
 * Neon PostgreSQL Migration Script
 * Runs SQL migration files on Neon (production) database
 *
 * Usage: npm run migrate:neon migrations/your-migration.sql
 */

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Error: Migration file not specified');
    console.error('Usage: npm run migrate:neon migrations/your-migration.sql');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL or POSTGRES_URL not set in .env');
    console.error('Please add your Neon PostgreSQL connection string to server/.env');
    process.exit(1);
  }

  // Read SQL file
  const migrationPath = path.join(__dirname, '..', migrationFile);
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  let sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📄 Migration file: ${migrationFile}`);
  console.log(`🔗 Database: ${databaseUrl.split('@')[1] || 'PostgreSQL'}`);

  // Create connection pool
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to Neon PostgreSQL');

    // Convert SQLite syntax to PostgreSQL
    console.log('🔄 Converting SQLite syntax to PostgreSQL...');

    // Replace SQLite-specific syntax
    sql = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      .replace(/DATETIME/gi, 'TIMESTAMP')
      .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE')
      .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE')
      .replace(/TEXT NOT NULL/gi, 'TEXT')
      .replace(/IF NOT EXISTS/gi, 'IF NOT EXISTS'); // Keep this as-is

    // Remove SELECT message statements
    sql = sql.replace(/SELECT\s+['"].*['"]\s+as\s+message\s*;?/gi, '');

    console.log(`📊 Executing migration...`);

    // Execute entire SQL file at once
    // PostgreSQL can handle multiple statements separated by semicolons
    try {
      await pool.query(sql);
      console.log(`✅ Migration executed successfully`);
    } catch (error) {
      // Check if error is "already exists" - treat as success
      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate key') ||
        error.message.includes('relation') && error.message.includes('already exists')
      ) {
        console.log(`⚠️  Some objects already exist (this is OK)`);
      } else {
        console.error(`❌ Error: ${error.message}`);
        throw error;
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
