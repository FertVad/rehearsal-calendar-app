import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { initDatabase } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '../.env') });

async function runMigration() {
  console.log('Running migration: add is_all_day flag...');

  const db = await initDatabase();

  try {
    // Step 1: Add column
    console.log('Step 1: Adding is_all_day column...');
    try {
      await db.run(`
        ALTER TABLE native_user_availability
        ADD COLUMN is_all_day BOOLEAN DEFAULT FALSE
      `);
      console.log('  ✓ Column added');
    } catch (err) {
      if (err.code === '42701') {
        console.log('  ⚠️  Column already exists');
      } else {
        throw err;
      }
    }

    // Step 2: Update existing all-day records
    console.log('Step 2: Updating existing all-day records...');
    const updateResult = await db.run(`
      UPDATE native_user_availability
      SET is_all_day = TRUE
      WHERE (start_time = '00:00:00' OR start_time = '00:00')
        AND (end_time = '23:59:00' OR end_time = '23:59')
    `);
    console.log(`  ✓ Updated ${updateResult.changes || 0} records`);

    // Step 3: Create index
    console.log('Step 3: Creating index...');
    try {
      await db.run(`
        CREATE INDEX idx_availability_is_all_day
        ON native_user_availability(is_all_day)
      `);
      console.log('  ✓ Index created');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('  ⚠️  Index already exists');
      } else {
        throw err;
      }
    }

    // Verify the migration
    const count = await db.get(
      'SELECT COUNT(*) as count FROM native_user_availability WHERE is_all_day = TRUE'
    );

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Found ${count.count} all-day slots`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
