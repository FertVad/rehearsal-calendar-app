import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSchema() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to Neon PostgreSQL...\n');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // List all tables
    console.log('📋 Tables in database:\n');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('\n📊 Detailed schema:\n');

    // For each table, show columns
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`\n🔹 Table: ${tableName}`);

      const columns = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      columns.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkSchema();
