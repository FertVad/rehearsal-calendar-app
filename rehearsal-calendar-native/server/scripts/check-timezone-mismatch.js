/**
 * Check for timezone mismatches between client and server
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
  console.log('\n🔍 Checking for timezone mismatches...\n');
  console.log('='.repeat(70));

  // Get user
  const user = await pool.query(
    "SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'"
  );

  if (user.rows.length === 0) {
    console.log('❌ User not found');
    await pool.end();
    return;
  }

  const userId = user.rows[0].id;
  const dbTimezone = user.rows[0].timezone;

  console.log(`\n📊 User: ${user.rows[0].email}`);
  console.log(`📊 Timezone in DATABASE: ${dbTimezone}\n`);

  // Get rehearsal
  const rehearsal = await pool.query(
    `SELECT r.id, r.title, r.starts_at, r.ends_at, p.name as project_name
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     JOIN native_project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = $1
     ORDER BY r.starts_at DESC
     LIMIT 1`,
    [userId]
  );

  if (rehearsal.rows.length === 0) {
    console.log('⚠️  No rehearsals found');
  } else {
    const reh = rehearsal.rows[0];
    const startISO = reh.starts_at.toISOString();
    const endISO = reh.ends_at.toISOString();

    console.log('='.repeat(70));
    console.log(`\n📅 Latest Rehearsal: ${reh.title || '(no title)'}`);
    console.log(`Project: ${reh.project_name}`);
    console.log(`\nUTC timestamps:`);
    console.log(`  ${startISO} - ${endISO}`);

    // Show in different timezones
    console.log(`\n🌍 How this appears in different timezones:\n`);

    const timezones = [
      { name: 'Asia/Jerusalem', tz: 'Asia/Jerusalem' },
      { name: 'Europe/Moscow', tz: 'Europe/Moscow' },
      { name: 'UTC', tz: 'UTC' },
    ];

    for (const { name, tz } of timezones) {
      const start = timestampToLocal(startISO, tz);
      const end = timestampToLocal(endISO, tz);
      const isCurrent = tz === dbTimezone ? ' ✅ (current user timezone)' : '';
      console.log(`  ${name}:${' '.repeat(20 - name.length)}${start.date} ${start.time} - ${end.time}${isCurrent}`);
    }
  }

  // Check availability records
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Availability records for this user:\n`);

  const avail = await pool.query(
    `SELECT id, source, title, starts_at, ends_at, type, is_all_day
     FROM native_user_availability
     WHERE user_id = $1
     ORDER BY starts_at`,
    [userId]
  );

  if (avail.rows.length === 0) {
    console.log('  (no records)');
  } else {
    for (const record of avail.rows) {
      const startISO = timestampToISO(record.starts_at);
      const endISO = timestampToISO(record.ends_at);

      const startDB = timestampToLocal(startISO, dbTimezone);
      const endDB = timestampToLocal(endISO, dbTimezone);

      console.log(`  Source: ${record.source}`);
      console.log(`  Title: ${record.title || '(no title)'}`);
      console.log(`  In user's timezone (${dbTimezone}):`);
      console.log(`    ${startDB.date} ${startDB.time} - ${endDB.time}`);
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('\n💡 IMPORTANT:\n');
  console.log('  If client shows different times, it means:');
  console.log('  1. Client is using CACHED timezone (old value)');
  console.log('  2. Database has UPDATED timezone (new value)\n');
  console.log('  Solution: LOGOUT and LOGIN again to refresh cache\n');
  console.log('='.repeat(70) + '\n');

  await pool.end();
}

main().catch(console.error);
