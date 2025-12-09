import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    console.log('\n=== CHECKING native_rehearsals SCHEMA ===\n');

    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'native_rehearsals'
      ORDER BY ordinal_position
    `);

    console.log('Columns:');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(25)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL    '} ${col.column_default || ''}`);
    });

    console.log('\n=== Sample records ===\n');
    const sample = await pool.query(`
      SELECT * FROM native_rehearsals ORDER BY created_at DESC LIMIT 3
    `);
    console.log(sample.rows);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
