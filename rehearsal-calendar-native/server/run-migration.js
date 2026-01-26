/**
 * Run a specific SQL migration
 * Usage: node run-migration.js <migration-file.sql>
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { default as db } from './database/db.js';

config();

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

try {
  const sql = readFileSync(`./migrations/${migrationFile}`, 'utf8');

  console.log(`Running migration: ${migrationFile}`);
  console.log('SQL:', sql);

  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement) {
      console.log('\nExecuting:', statement.substring(0, 100) + '...');
      await db.run(statement);
    }
  }

  console.log('\n✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
