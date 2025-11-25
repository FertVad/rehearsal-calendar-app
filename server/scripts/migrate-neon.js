import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateNeon() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in .env');
    console.log('\n📝 Add your Neon database URL to .env:');
    console.log('DATABASE_URL=postgresql://user:password@host/database?sslmode=require\n');
    process.exit(1);
  }

  console.log('🔌 Connecting to Neon PostgreSQL...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to Neon database\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/002-add-native-auth-to-actors.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Running migration: 002-add-native-auth-to-actors.sql');

    // Execute migration
    await pool.query(migration);

    console.log('✅ Migration completed successfully\n');

    // Verify columns
    console.log('🔍 Verifying columns...');
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'actors'
      AND column_name IN ('email', 'password_hash')
      ORDER BY column_name
    `);

    if (result.rows.length === 2) {
      console.log('✅ Columns added to actors table:');
      result.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    } else {
      console.log('⚠️  Expected 2 columns, found:', result.rows.length);
    }

    console.log('\n🎉 Neon database is ready for native app!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the server: npm start');
    console.log('2. The app will now use Neon PostgreSQL instead of SQLite');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateNeon();
