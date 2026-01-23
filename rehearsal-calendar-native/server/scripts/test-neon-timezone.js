/**
 * Test timezone conversion with Neon PostgreSQL
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { localToTimestamp, timestampToLocal } from '../utils/timezone.js';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

console.log('\n╔═══════════════════════════════════════════╗');
console.log('║   Timezone Test with Neon PostgreSQL     ║');
console.log('╚═══════════════════════════════════════════╝\n');

try {
  // Test connection
  console.log('Testing connection to Neon...');
  const connTest = await pool.query('SELECT NOW(), version()');
  console.log('✓ Connected to Neon PostgreSQL\n');

  // Get or create test user
  console.log('=== Setup test user ===\n');
  let user = await pool.query(
    "SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'"
  );

  if (user.rows.length === 0) {
    console.log('Creating test user...');
    user = await pool.query(
      `INSERT INTO native_users (email, password_hash, first_name, timezone)
       VALUES ('test@example.com', 'dummy_hash', 'Test', 'Europe/Moscow')
       RETURNING id, email, timezone`
    );
  } else {
    // Update timezone
    await pool.query(
      "UPDATE native_users SET timezone = 'Europe/Moscow' WHERE email = 'test@example.com'"
    );
    user = await pool.query(
      "SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'"
    );
  }

  const userId = user.rows[0].id;
  const userTimezone = user.rows[0].timezone;
  console.log(`Using user: ${user.rows[0].email} (ID: ${userId})`);
  console.log(`User timezone: ${userTimezone}\n`);

  // Get or create test project
  console.log('=== Setup test project ===\n');
  let project = await pool.query(
    "SELECT id, name FROM native_projects WHERE name = 'Test Project' LIMIT 1"
  );

  if (project.rows.length === 0) {
    console.log('Creating test project...');
    project = await pool.query(
      `INSERT INTO native_projects (name, description, timezone)
       VALUES ('Test Project', 'Test project for timezone testing', 'Europe/Moscow')
       RETURNING id, name`
    );

    // Add user to project
    await pool.query(
      `INSERT INTO native_project_members (user_id, project_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [userId, project.rows[0].id]
    );
  }

  const projectId = project.rows[0].id;
  console.log(`Using project: ${project.rows[0].name} (ID: ${projectId})\n`);

  // Clear old test data
  console.log('=== Clearing old test data ===\n');
  await pool.query('DELETE FROM native_user_availability WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM native_rehearsal_responses WHERE rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $1)', [projectId]);
  await pool.query('DELETE FROM native_rehearsals WHERE project_id = $1', [projectId]);
  console.log('✓ Old data cleared\n');

  // Create test rehearsals
  console.log('=== Creating test rehearsals ===\n');

  const scenarios = [
    {
      name: 'Morning rehearsal (9:00-12:00 local time)',
      localDate: '2026-01-20',
      localStartTime: '09:00',
      localEndTime: '12:00',
    },
    {
      name: 'Evening rehearsal (18:00-21:00 local time)',
      localDate: '2026-01-20',
      localStartTime: '18:00',
      localEndTime: '21:00',
    },
    {
      name: 'Late night rehearsal (22:00-23:30)',
      localDate: '2026-01-20',
      localStartTime: '22:00',
      localEndTime: '23:30',
    },
    {
      name: 'All-day event',
      localDate: '2026-01-21',
      isAllDay: true,
    },
  ];

  for (const scenario of scenarios) {
    if (scenario.isAllDay) {
      const startsAtUTC = localToTimestamp(scenario.localDate, '00:00', userTimezone);
      const endsAtUTC = localToTimestamp(scenario.localDate, '23:59', userTimezone);

      console.log(`  ${scenario.name}`);
      console.log(`    Local: ${scenario.localDate} 00:00 - 23:59 (${userTimezone})`);
      console.log(`    UTC:   ${startsAtUTC} - ${endsAtUTC}`);

      const result = await pool.query(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, starts_at, ends_at`,
        [projectId, scenario.name, startsAtUTC, endsAtUTC, userId]
      );

      console.log(`    Stored: ${result.rows[0].starts_at} - ${result.rows[0].ends_at}`);

      // Verify conversion back
      const backToLocal = {
        start: timestampToLocal(result.rows[0].starts_at, userTimezone),
        end: timestampToLocal(result.rows[0].ends_at, userTimezone),
      };
      console.log(`    Check:  ${backToLocal.start.date} ${backToLocal.start.time} - ${backToLocal.end.date} ${backToLocal.end.time}`);
      console.log(`    ✓ All-day event created\n`);
    } else {
      const startsAtUTC = localToTimestamp(scenario.localDate, scenario.localStartTime, userTimezone);
      const endsAtUTC = localToTimestamp(scenario.localDate, scenario.localEndTime, userTimezone);

      console.log(`  ${scenario.name}`);
      console.log(`    Local: ${scenario.localDate} ${scenario.localStartTime} - ${scenario.localEndTime} (${userTimezone})`);
      console.log(`    UTC:   ${startsAtUTC} - ${endsAtUTC}`);

      const result = await pool.query(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, starts_at, ends_at`,
        [projectId, scenario.name, startsAtUTC, endsAtUTC, userId]
      );

      console.log(`    Stored: ${result.rows[0].starts_at} - ${result.rows[0].ends_at}`);

      // Verify conversion back
      const backToLocal = {
        start: timestampToLocal(result.rows[0].starts_at, userTimezone),
        end: timestampToLocal(result.rows[0].ends_at, userTimezone),
      };
      console.log(`    Check:  ${backToLocal.start.date} ${backToLocal.start.time} - ${backToLocal.end.date} ${backToLocal.end.time}`);
      console.log(`    ✓ Rehearsal created\n`);
    }
  }

  // Create busy slots
  console.log('=== Creating busy slots ===\n');

  const busySlots = [
    { date: '2026-01-22', start: '14:00', end: '16:00', title: 'Personal appointment' },
    { date: '2026-01-23', start: '10:00', end: '11:30', title: 'Doctor appointment' },
  ];

  for (const slot of busySlots) {
    const startsAtUTC = localToTimestamp(slot.date, slot.start, userTimezone);
    const endsAtUTC = localToTimestamp(slot.date, slot.end, userTimezone);

    console.log(`  ${slot.title}`);
    console.log(`    Local: ${slot.date} ${slot.start} - ${slot.end} (${userTimezone})`);
    console.log(`    UTC:   ${startsAtUTC} - ${endsAtUTC}`);

    await pool.query(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, is_all_day, source)
       VALUES ($1, $2, $3, 'busy', $4, FALSE, 'manual')`,
      [userId, startsAtUTC, endsAtUTC, slot.title]
    );

    console.log(`    ✓ Busy slot created\n`);
  }

  // Verify all data
  console.log('=== Verification ===\n');

  const rehearsals = await pool.query(
    'SELECT id, title, starts_at, ends_at FROM native_rehearsals WHERE project_id = $1 ORDER BY starts_at',
    [projectId]
  );

  console.log(`Found ${rehearsals.rows.length} rehearsals:\n`);
  for (const reh of rehearsals.rows) {
    const start = timestampToLocal(reh.starts_at, userTimezone);
    const end = timestampToLocal(reh.ends_at, userTimezone);

    console.log(`  ${reh.title}`);
    console.log(`    UTC:   ${reh.starts_at} - ${reh.ends_at}`);
    console.log(`    Local: ${start.date} ${start.time} - ${end.date} ${end.time}\n`);
  }

  const availability = await pool.query(
    'SELECT id, title, starts_at, ends_at, is_all_day FROM native_user_availability WHERE user_id = $1 ORDER BY starts_at',
    [userId]
  );

  console.log(`Found ${availability.rows.length} availability slots:\n`);
  for (const slot of availability.rows) {
    const start = timestampToLocal(slot.starts_at, userTimezone);
    const end = timestampToLocal(slot.ends_at, userTimezone);

    const allDayLabel = slot.is_all_day ? ' (ALL DAY)' : '';
    console.log(`  ${slot.title || 'Busy slot'}${allDayLabel}`);
    console.log(`    UTC:   ${slot.starts_at} - ${slot.ends_at}`);
    console.log(`    Local: ${start.date} ${start.time} - ${end.date} ${end.time}\n`);
  }

  console.log('✅ Test completed successfully!\n');
  console.log('Now test in the mobile app to verify client-side conversion.\n');

  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error);
  console.error(error.stack);
  await pool.end();
  process.exit(1);
}
