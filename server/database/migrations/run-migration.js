#!/usr/bin/env node

/**
 * Migration runner for settings columns
 * Run: node server/database/migrations/run-migration.js
 */

import pkg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Starting migration: Add settings columns...\n');

    // Read the PostgreSQL migration file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = join(__dirname, '001_add_settings_columns_pg.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');
    console.log('Added columns:');
    console.log('  - actors.ui_language (VARCHAR(2), default: en)');
    console.log('  - projects.work_hours_start (VARCHAR(5), default: 09:00)');
    console.log('  - projects.work_hours_end (VARCHAR(5), default: 22:00)');
    console.log('  - projects.notifications_enabled (BOOLEAN, default: false)');
    console.log('  - projects.notification_language (VARCHAR(2), default: en)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
