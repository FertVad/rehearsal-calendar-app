import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const res = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'native_%'
    ORDER BY table_name
  `);

  console.log('📊 Native tables in Neon PostgreSQL:\n');
  if (res.rows.length === 0) {
    console.log('  ⚠️  No native_* tables found!');
  } else {
    res.rows.forEach(row => console.log('  ✓', row.table_name));
  }

  console.log('\n📊 Checking native_users table schema:');
  const schema = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'native_users'
    ORDER BY ordinal_position
  `);

  if (schema.rows.length === 0) {
    console.log('  ⚠️  native_users table does not exist!');
  } else {
    schema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  }

  await pool.end();
} catch (err) {
  console.error('❌ Error:', err.message);
  await pool.end();
  process.exit(1);
}
