// Apply analytics tables migration
// Usage: node server/analytics/scripts/migrate.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase, isPostgres } from '../../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting analytics migration...\n');

  await initDatabase();

  const migrationPath = path.join(__dirname, '../migrations/add_analytics_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📂 Database type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

  if (!isPostgres) {
    console.warn('⚠️  SQLite detected - converting PostgreSQL syntax...\n');

    // Convert PostgreSQL syntax to SQLite
    const sqliteSql = sql
      .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/JSONB/g, 'TEXT')
      .replace(/TIMESTAMP/g, 'DATETIME')
      .replace(/NOW\(\)/g, "CURRENT_TIMESTAMP")
      .replace(/IF NOT EXISTS/g, '')
      .replace(/COMMENT ON .*/g, ''); // Remove comments (not supported in SQLite)

    const statements = sqliteSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.run(stmt);
        console.log('✅ Executed:', stmt.split('\n')[0].substring(0, 60) + '...');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('⏭️  Skipped (already exists):', stmt.split('\n')[0].substring(0, 60) + '...');
        } else {
          console.error('❌ Error:', err.message);
          throw err;
        }
      }
    }
  } else {
    // PostgreSQL - split by semicolon and execute separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await db.run(stmt);
        const preview = stmt.split('\n')[0].substring(0, 60);
        console.log('✅ Executed:', preview + '...');
      } catch (err) {
        if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42710') {
          const preview = stmt.split('\n')[0].substring(0, 60);
          console.log('⏭️  Skipped (already exists):', preview + '...');
        } else {
          console.error('❌ Error:', err.message);
          throw err;
        }
      }
    }
    console.log('');
  }

  // Verify table creation
  const verifyQuery = isPostgres
    ? `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'analytics_events'
      )`
    : `SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_events'`;

  const result = await db.get(verifyQuery);

  if ((isPostgres && result.exists) || (!isPostgres && result)) {
    console.log('✅ Verification: analytics_events table exists\n');
  } else {
    console.error('❌ Verification failed: table not found\n');
    process.exit(1);
  }

  // Check indexes
  const indexQuery = isPostgres
    ? `SELECT indexname FROM pg_indexes WHERE tablename = 'analytics_events'`
    : `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='analytics_events'`;

  const indexes = await db.all(indexQuery);
  console.log(`📊 Indexes created: ${indexes.length}`);
  indexes.forEach(idx => {
    console.log(`   - ${idx.indexname || idx.name}`);
  });

  console.log('\n🎉 Analytics migration completed successfully!');
}

// Run migration
runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
  });
