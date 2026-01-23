/**
 * Script to test timezone conversion between UTC and user timezone
 * This script:
 * 1. Clears all rehearsals and availability
 * 2. Creates test data with various scenarios
 * 3. Verifies correct conversion
 */

import { initDatabase } from '../database/db.js';
import { localToTimestamp, timestampToLocal } from '../utils/timezone.js';

let db;

// Test scenarios (will use user's timezone)
const TEST_SCENARIOS = [
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

// Use server's timezone conversion functions (they are tested and reliable)

async function clearTestData() {
  console.log('\n=== Clearing all test data ===\n');

  // Delete all availability
  const availResult = await db.run('DELETE FROM native_user_availability');
  console.log(`✓ Deleted ${availResult.changes || 0} availability records`);

  // Delete all rehearsal responses first (foreign key)
  const respResult = await db.run('DELETE FROM native_rehearsal_responses');
  console.log(`✓ Deleted ${respResult.changes || 0} rehearsal responses`);

  // Delete all rehearsals
  const rehResult = await db.run('DELETE FROM native_rehearsals');
  console.log(`✓ Deleted ${rehResult.changes || 0} rehearsals`);

  console.log('\n✓ All test data cleared\n');
}

async function createTestData() {
  console.log('\n=== Creating test data ===\n');

  // Get first user and project
  const user = await db.get('SELECT id, email, timezone FROM native_users LIMIT 1');
  if (!user) {
    console.error('❌ No users found. Please create a user first.');
    process.exit(1);
  }

  console.log(`Using user: ${user.email} (ID: ${user.id})`);
  console.log(`User timezone: ${user.timezone || 'UTC'}\n`);

  const project = await db.get('SELECT id, name FROM native_projects LIMIT 1');
  if (!project) {
    console.error('❌ No projects found. Please create a project first.');
    process.exit(1);
  }

  console.log(`Using project: ${project.name} (ID: ${project.id})\n`);

  const userTimezone = user.timezone || 'UTC';

  // Create rehearsals
  console.log('Creating test rehearsals:\n');
  for (const scenario of TEST_SCENARIOS) {
    if (scenario.isAllDay) {
      // All-day event: store as full day in user's timezone
      const startsAtLocal = `${scenario.localDate}T00:00:00`;
      const endsAtLocal = `${scenario.localDate}T23:59:59`;

      const startsAtUTC = localToTimestamp(scenario.localDate, '00:00', userTimezone);
      const endsAtUTC = localToTimestamp(scenario.localDate, '23:59', userTimezone);

      console.log(`  ${scenario.name}`);
      console.log(`    Local: ${startsAtLocal} - ${endsAtLocal} (${userTimezone})`);
      console.log(`    UTC:   ${startsAtUTC} - ${endsAtUTC}`);

      const rehearsal = await db.get(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, NOW(), NOW())
         RETURNING id, starts_at, ends_at`,
        [project.id, scenario.name, startsAtUTC, endsAtUTC, user.id]
      );

      console.log(`    Stored: ${rehearsal.starts_at} - ${rehearsal.ends_at}`);

      // Verify conversion back
      const backToLocal = {
        start: timestampToLocal(rehearsal.starts_at, userTimezone),
        end: timestampToLocal(rehearsal.ends_at, userTimezone),
      };
      console.log(`    Check:  ${backToLocal.start.date} ${backToLocal.start.time} - ${backToLocal.end.date} ${backToLocal.end.time}`);

      // Create RSVP
      await db.run(
        'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, $3)',
        [rehearsal.id, user.id, 'yes']
      );

      // Create availability slot
      await db.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
         VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', TRUE, 'manual')`,
        [user.id, startsAtUTC, endsAtUTC]
      );

      console.log(`    ✓ Created all-day event\n`);
    } else {
      const startsAtUTC = localToTimestamp(scenario.localDate, scenario.localStartTime, userTimezone);
      const endsAtUTC = localToTimestamp(scenario.localDate, scenario.localEndTime, userTimezone);

      console.log(`  ${scenario.name}`);
      console.log(`    Local: ${scenario.localDate} ${scenario.localStartTime} - ${scenario.localEndTime} (${userTimezone})`);
      console.log(`    UTC:   ${startsAtUTC} - ${endsAtUTC}`);

      const rehearsal = await db.get(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, NOW(), NOW())
         RETURNING id, starts_at, ends_at`,
        [project.id, scenario.name, startsAtUTC, endsAtUTC, user.id]
      );

      console.log(`    Stored: ${rehearsal.starts_at} - ${rehearsal.ends_at}`);

      // Verify conversion back
      const backToLocal = {
        start: timestampToLocal(rehearsal.starts_at, userTimezone),
        end: timestampToLocal(rehearsal.ends_at, userTimezone),
      };
      console.log(`    Check:  ${backToLocal.start.date} ${backToLocal.start.time} - ${backToLocal.end.date} ${backToLocal.end.time}`);

      // Create RSVP
      await db.run(
        'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, $3)',
        [rehearsal.id, user.id, 'yes']
      );

      // Create availability slot
      await db.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
         VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual')`,
        [user.id, startsAtUTC, endsAtUTC]
      );

      console.log(`    ✓ Created rehearsal and availability slot\n`);
    }
  }

  // Create some additional busy slots
  console.log('Creating additional busy slots:\n');

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

    await db.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, is_all_day, source)
       VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', $4, FALSE, 'manual')`,
      [user.id, startsAtUTC, endsAtUTC, slot.title]
    );

    console.log(`    ✓ Created\n`);
  }
}

async function verifyData() {
  console.log('\n=== Verification ===\n');

  const user = await db.get('SELECT id, timezone FROM native_users LIMIT 1');
  const userTimezone = user.timezone || 'UTC';

  console.log(`Verifying data for timezone: ${userTimezone}\n`);

  // Check rehearsals
  const rehearsals = await db.all(
    'SELECT id, title, starts_at, ends_at FROM native_rehearsals ORDER BY starts_at'
  );

  console.log(`Found ${rehearsals.length} rehearsals:\n`);
  for (const reh of rehearsals) {
    const start = timestampToLocal(reh.starts_at, userTimezone);
    const end = timestampToLocal(reh.ends_at, userTimezone);

    console.log(`  ${reh.title}`);
    console.log(`    UTC:   ${reh.starts_at} - ${reh.ends_at}`);
    console.log(`    Local: ${start.date} ${start.time} - ${end.date} ${end.time}\n`);
  }

  // Check availability
  const availability = await db.all(
    'SELECT id, title, starts_at, ends_at, is_all_day FROM native_user_availability ORDER BY starts_at'
  );

  console.log(`Found ${availability.length} availability slots:\n`);
  for (const slot of availability) {
    const start = timestampToLocal(slot.starts_at, userTimezone);
    const end = timestampToLocal(slot.ends_at, userTimezone);

    const allDayLabel = slot.is_all_day ? ' (ALL DAY)' : '';
    console.log(`  ${slot.title || 'Busy slot'}${allDayLabel}`);
    console.log(`    UTC:   ${slot.starts_at} - ${slot.ends_at}`);
    console.log(`    Local: ${start.date} ${start.time} - ${end.date} ${end.time}\n`);
  }
}

async function main() {
  try {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   Timezone Conversion Test Script        ║');
    console.log('╚═══════════════════════════════════════════╝');

    // Initialize database
    console.log('\nInitializing database connection...');
    db = await initDatabase();
    console.log('✓ Database connected\n');

    await clearTestData();
    await createTestData();
    await verifyData();

    console.log('✓ Test completed successfully!\n');
    console.log('Now test in the mobile app to verify the client-side conversion.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
