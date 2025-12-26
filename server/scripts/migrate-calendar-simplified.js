/**
 * Simplified calendar migration - run each command separately
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const migrations = [
    // 1. Make OAuth fields nullable
    `ALTER TABLE native_calendar_connections ALTER COLUMN access_token DROP NOT NULL`,
    `ALTER TABLE native_calendar_connections ALTER COLUMN calendar_id DROP NOT NULL`,

    // 2. Add device calendar fields
    `ALTER TABLE native_calendar_connections ADD COLUMN IF NOT EXISTS device_calendar_id VARCHAR`,
    `ALTER TABLE native_calendar_connections ADD COLUMN IF NOT EXISTS device_calendar_name VARCHAR`,

    // 3. Add check constraint
    `ALTER TABLE native_calendar_connections DROP CONSTRAINT IF EXISTS check_calendar_id`,
    `ALTER TABLE native_calendar_connections ADD CONSTRAINT check_calendar_id
     CHECK (calendar_id IS NOT NULL OR device_calendar_id IS NOT NULL)`,

    // 4. Add indexes
    `CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON native_calendar_connections(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_connections_device_calendar_id ON native_calendar_connections(device_calendar_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_connection_id ON native_calendar_event_mappings(connection_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_internal_event ON native_calendar_event_mappings(event_type, internal_event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_external_event ON native_calendar_event_mappings(external_event_id)`,
  ];

  try {
    console.log(`Running ${migrations.length} migration statements...\n`);

    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      console.log(`[${i + 1}/${migrations.length}] ${sql.substring(0, 80)}...`);

      try {
        await pool.query(sql);
        console.log('✓ Success\n');
      } catch (error) {
        console.error(`✗ Failed: ${error.message}\n`);
        // Continue with other migrations
      }
    }

    console.log('✓ Migration completed successfully');

    // Verify the schema
    console.log('\n=== Verifying schema ===');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'native_calendar_connections'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', result.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`).join('\n  '));

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

migrate();
