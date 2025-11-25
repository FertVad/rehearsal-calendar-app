import 'dotenv/config';
import { initDatabase } from '../database/db.js';

async function addAuthColumns() {
  try {
    console.log('Adding email and password_hash columns to accounts table...');

    // Initialize database connection
    const db = await initDatabase();

    // Check if columns exist first
    const columns = await db.all(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'accounts'
    `);

    const columnNames = columns.map(c => c.column_name);

    if (!columnNames.includes('email')) {
      await db.run('ALTER TABLE accounts ADD COLUMN email text UNIQUE');
      console.log('✅ Added email column');
    } else {
      console.log('⏭️ email column already exists');
    }

    if (!columnNames.includes('password_hash')) {
      await db.run('ALTER TABLE accounts ADD COLUMN password_hash text');
      console.log('✅ Added password_hash column');
    } else {
      console.log('⏭️ password_hash column already exists');
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addAuthColumns();
