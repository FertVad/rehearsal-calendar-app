/**
 * Check availability for ALL users in the project
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { timestampToLocal, timestampToISO } from '../utils/timezone.js';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('\n🔍 Checking availability for ALL project members...\n');
  console.log('='.repeat(70));

  // Get project
  const project = await pool.query(
    "SELECT id, name, timezone FROM native_projects WHERE name = 'Cabaret'"
  );

  if (project.rows.length === 0) {
    console.log('❌ Project not found');
    await pool.end();
    return;
  }

  const projectId = project.rows[0].id;
  const projectTimezone = project.rows[0].timezone;

  console.log(`\n📊 Project: ${project.rows[0].name}`);
  console.log(`📊 Project timezone: ${projectTimezone}\n`);

  // Get all project members with their timezones
  const members = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.timezone, pm.role
     FROM native_project_members pm
     JOIN native_users u ON pm.user_id = u.id
     WHERE pm.project_id = $1 AND pm.status = 'active'
     ORDER BY pm.role, u.email`,
    [projectId]
  );

  console.log(`Found ${members.rows.length} active members:\n`);

  // For each member, get their availability for 2026-01-20
  const date = '2026-01-20';

  for (const member of members.rows) {
    console.log('='.repeat(70));
    console.log(`\n👤 ${member.email} (${member.first_name || 'No name'}, Role: ${member.role})`);
    console.log(`   Timezone: ${member.timezone || 'UTC'}\n`);

    // Get availability records
    const avail = await pool.query(
      `SELECT id, source, title, starts_at, ends_at, type, is_all_day, external_event_id
       FROM native_user_availability
       WHERE user_id = $1
         AND starts_at >= $2::date - interval '1 day'
         AND starts_at < $3::date + interval '2 days'
       ORDER BY starts_at`,
      [member.id, date, date]
    );

    if (avail.rows.length === 0) {
      console.log('   No availability records for this date\n');
      continue;
    }

    console.log(`   Found ${avail.rows.length} availability record(s):\n`);

    for (const record of avail.rows) {
      const startISO = timestampToISO(record.starts_at);
      const endISO = timestampToISO(record.ends_at);

      const userTimezone = member.timezone || 'UTC';
      const start = timestampToLocal(startISO, userTimezone);
      const end = timestampToLocal(endISO, userTimezone);

      // Also show in project timezone for comparison
      const startProject = timestampToLocal(startISO, projectTimezone);
      const endProject = timestampToLocal(endISO, projectTimezone);

      console.log(`   📌 Record ID: ${record.id}`);
      console.log(`      Source: ${record.source}`);
      console.log(`      Title: ${record.title || '(no title)'}`);
      console.log(`      Type: ${record.type}, All-day: ${record.is_all_day}`);
      console.log(`      External ID: ${record.external_event_id || '(none)'}`);
      console.log(`      UTC: ${startISO} - ${endISO}`);
      console.log(`      In user's TZ (${userTimezone}): ${start.date} ${start.time} - ${end.time}`);
      if (userTimezone !== projectTimezone) {
        console.log(`      In project TZ (${projectTimezone}): ${startProject.date} ${startProject.time} - ${endProject.time}`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('\n💡 SUMMARY:\n');
  console.log('  Each user sees their availability in THEIR OWN timezone.');
  console.log('  But the rehearsal time is stored in UTC (same for everyone).');
  console.log('  So different users will see different local times!\n');
  console.log('='.repeat(70) + '\n');

  await pool.end();
}

main().catch(console.error);
