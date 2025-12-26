/**
 * Run calendar tables migration
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

const { Pool } = pkg;
dotenv.config();

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Running migration: adapt-calendar-tables-for-expo.sql');

    // Read migration file
    const sql = fs.readFileSync('migrations/adapt-calendar-tables-for-expo.sql', 'utf8');

    // Split by semicolons and filter out comments and empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`Found ${statements.length} SQL statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        console.log(`\n[${i + 1}/${statements.length}] Executing...`);
        console.log(statement.substring(0, 100) + '...');
        await pool.query(statement);
        console.log('✓ Success');
      } catch (error) {
        console.error('✗ Failed:', error.message);
        // Continue with other statements
      }
    }

    console.log('\n✓ Migration completed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
