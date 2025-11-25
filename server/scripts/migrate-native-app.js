import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateNativeApp() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in .env');
    console.log('\n📝 Add your Neon database URL to .env:');
    console.log('DATABASE_URL=postgresql://user:password@host/database?sslmode=require\n');
    process.exit(1);
  }

  console.log('🔌 Connecting to PostgreSQL...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/003-native-app-schema.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Running migration: 003-native-app-schema.sql');
    console.log('   Creating native app tables...\n');

    // Execute migration
    await pool.query(migration);

    console.log('✅ Migration completed successfully\n');

    // Verify tables
    console.log('🔍 Verifying tables...');
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'native_%'
      ORDER BY table_name
    `);

    console.log(`✅ Created ${result.rows.length} native app tables:`);
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // Check indexes
    const indexResult = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_native_%'
      ORDER BY indexname
    `);

    console.log(`\n✅ Created ${indexResult.rows.length} indexes`);

    console.log('\n🎉 Native app database schema is ready!');
    console.log('\n📝 Tables created:');
    console.log('   - native_users');
    console.log('   - native_projects');
    console.log('   - native_project_members');
    console.log('   - native_rehearsals');
    console.log('   - native_rehearsal_participants');
    console.log('   - native_user_availability');
    console.log('   - native_calendar_connections');
    console.log('   - native_calendar_event_mappings');
    console.log('   - native_notifications');
    console.log('   - native_activity_log');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateNativeApp();
