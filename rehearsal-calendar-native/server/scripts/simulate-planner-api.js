/**
 * Simulate planner API request
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
  console.log('\n🔍 Simulating Planner API Request...\n');

  // Get user and project
  const user = await pool.query("SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'");
  const project = await pool.query("SELECT id, name, timezone FROM native_projects WHERE name = 'Cabaret'");

  if (user.rows.length === 0 || project.rows.length === 0) {
    console.log('❌ User or project not found');
    await pool.end();
    return;
  }

  const userId = user.rows[0].id;
  const userTimezone = user.rows[0].timezone;
  const projectId = project.rows[0].id;
  const projectTimezone = project.rows[0].timezone;

  console.log(`User: ${user.rows[0].email} (TZ: ${userTimezone})`);
  console.log(`Project: ${project.rows[0].name} (TZ: ${projectTimezone})\n`);

  // Simulate API request for 2026-01-20
  const date = '2026-01-20';
  const targetUserIds = [userId];

  console.log(`📅 Requesting availability for: ${date}\n`);
  console.log('='.repeat(70));

  // This is the SAME query from members.js endpoint
  const availabilityRecords = await pool.query(
    `SELECT user_id, starts_at, ends_at, type, is_all_day, title, source, external_event_id
     FROM native_user_availability
     WHERE user_id = $1
       AND starts_at >= $2::date - interval '1 day'
       AND starts_at < $3::date + interval '2 days'
     ORDER BY user_id, starts_at ASC`,
    [userId, date, date]
  );

  console.log(`\n📊 Found ${availabilityRecords.rows.length} availability records in DB:\n`);

  for (const record of availabilityRecords.rows) {
    const startsAtISO = timestampToISO(record.starts_at);
    const endsAtISO = timestampToISO(record.ends_at);

    const { date: startDate, time: startTime } = timestampToLocal(startsAtISO, userTimezone);
    const { time: endTime } = timestampToLocal(endsAtISO, userTimezone);

    console.log(`  Record ID: ${record.external_event_id || '(no external ID)'}`);
    console.log(`  Source: ${record.source}`);
    console.log(`  Title: ${record.title || '(no title)'}`);
    console.log(`  Type: ${record.type}, All-day: ${record.is_all_day}`);
    console.log(`  UTC: ${startsAtISO} - ${endsAtISO}`);
    console.log(`  ${userTimezone}: ${startDate} ${startTime} - ${endTime}`);
    console.log('');
  }

  // Now group by date (same logic as API endpoint)
  const recordsByDate = new Map();
  for (const record of availabilityRecords.rows) {
    const startsAtISO = timestampToISO(record.starts_at);
    const { date: localDate } = timestampToLocal(startsAtISO, userTimezone);

    if (!recordsByDate.has(localDate)) {
      recordsByDate.set(localDate, []);
    }
    recordsByDate.get(localDate).push(record);
  }

  console.log('='.repeat(70));
  console.log(`\n📋 Grouped by date (in user's timezone ${userTimezone}):\n`);

  for (const [dateKey, records] of recordsByDate.entries()) {
    console.log(`Date: ${dateKey} (${records.length} records)`);

    for (const record of records) {
      const startsAtISO = timestampToISO(record.starts_at);
      const endsAtISO = timestampToISO(record.ends_at);
      const { time: startTime } = timestampToLocal(startsAtISO, userTimezone);
      const { time: endTime } = timestampToLocal(endsAtISO, userTimezone);

      console.log(`  - ${startTime} - ${endTime} (${record.source})`);
    }
    console.log('');
  }

  // Check if this matches what planner shows
  const recordsFor20th = recordsByDate.get(date) || [];
  console.log('='.repeat(70));
  console.log(`\n🎯 What planner SHOULD show for ${date}:\n`);
  console.log(`${recordsFor20th.length} busy slot(s):\n`);

  for (const record of recordsFor20th) {
    const startsAtISO = timestampToISO(record.starts_at);
    const endsAtISO = timestampToISO(record.ends_at);
    const { time: startTime } = timestampToLocal(startsAtISO, userTimezone);
    const { time: endTime } = timestampToLocal(endsAtISO, userTimezone);

    console.log(`  ${startTime} - ${endTime} (Source: ${record.source}, Type: ${record.type})`);
  }

  console.log('\n');

  await pool.end();
}

main().catch(console.error);
