/**
 * Check availability records and their sources
 */

import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('\n📊 Checking availability records...\n');

  // Get user
  const userResult = await pool.query(
    "SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'"
  );

  if (userResult.rows.length === 0) {
    console.log('❌ Test user not found');
    await pool.end();
    return;
  }

  const user = userResult.rows[0];
  console.log(`User: ${user.email} (ID: ${user.id}, TZ: ${user.timezone})\n`);

  // Get availability records
  const availResult = await pool.query(
    `SELECT id, source, title, starts_at, ends_at, type, is_all_day, external_event_id
     FROM native_user_availability
     WHERE user_id = $1
     ORDER BY starts_at`,
    [user.id]
  );

  console.log(`Found ${availResult.rows.length} availability records:\n`);

  for (const record of availResult.rows) {
    console.log(`  ID: ${record.id}`);
    console.log(`  Source: ${record.source}`);
    console.log(`  Title: ${record.title || '(no title)'}`);
    console.log(`  Time: ${record.starts_at} - ${record.ends_at}`);
    console.log(`  Type: ${record.type}, All-day: ${record.is_all_day}`);
    console.log(`  External ID: ${record.external_event_id || '(none)'}`);
    console.log('');
  }

  // Get rehearsals
  const rehResult = await pool.query(
    `SELECT r.id, r.title, r.starts_at, r.ends_at, p.name as project_name
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     JOIN native_project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = $1
     ORDER BY r.starts_at`,
    [user.id]
  );

  console.log(`Found ${rehResult.rows.length} rehearsals:\n`);

  for (const record of rehResult.rows) {
    console.log(`  ID: ${record.id}`);
    console.log(`  Project: ${record.project_name}`);
    console.log(`  Title: ${record.title || '(no title)'}`);
    console.log(`  Time: ${record.starts_at} - ${record.ends_at}`);
    console.log('');
  }

  // Check if there are rehearsal records in availability table
  const rehInAvail = await pool.query(
    `SELECT COUNT(*) as count FROM native_user_availability WHERE source = 'rehearsal' AND user_id = $1`,
    [user.id]
  );

  console.log(`\n📊 Availability records with source='rehearsal': ${rehInAvail.rows[0].count}`);

  const manualInAvail = await pool.query(
    `SELECT COUNT(*) as count FROM native_user_availability WHERE source = 'manual' AND user_id = $1`,
    [user.id]
  );

  console.log(`📊 Availability records with source='manual': ${manualInAvail.rows[0].count}`);

  const calendarInAvail = await pool.query(
    `SELECT COUNT(*) as count FROM native_user_availability WHERE source LIKE '%calendar%' AND user_id = $1`,
    [user.id]
  );

  console.log(`📊 Availability records with source='*calendar*': ${calendarInAvail.rows[0].count}\n`);

  await pool.end();
}

main().catch(console.error);
