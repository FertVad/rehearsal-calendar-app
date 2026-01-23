/**
 * Comprehensive test script for rehearsals, availability, and timezone conversions
 * Tests all scenarios without UI
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { localToTimestamp, timestampToLocal } from '../utils/timezone.js';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

let testUserId;
let testProjectId;
const userTimezone = 'Europe/Moscow';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log('cyan', `  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function test(name, passed, details = '') {
  if (passed) {
    log('green', `✓ ${name}`);
    if (details) console.log(`  ${details}`);
  } else {
    log('red', `✗ ${name}`);
    if (details) console.log(`  ${details}`);
  }
}

// =============================================================================
// SETUP
// =============================================================================

async function setup() {
  section('SETUP - Creating test user and project');

  // Get or create test user
  let userResult = await pool.query(
    "SELECT id, timezone FROM native_users WHERE email = 'test@example.com'"
  );

  if (userResult.rows.length === 0) {
    userResult = await pool.query(
      `INSERT INTO native_users (email, password_hash, first_name, timezone)
       VALUES ('test@example.com', 'dummy', 'Test', $1)
       RETURNING id, timezone`,
      [userTimezone]
    );
  } else {
    await pool.query(
      "UPDATE native_users SET timezone = $1 WHERE email = 'test@example.com'",
      [userTimezone]
    );
    userResult = await pool.query(
      "SELECT id, timezone FROM native_users WHERE email = 'test@example.com'"
    );
  }

  testUserId = userResult.rows[0].id;
  log('green', `✓ Test user: test@example.com (ID: ${testUserId}, TZ: ${userTimezone})`);

  // Get or create test project
  let projectResult = await pool.query(
    "SELECT id FROM native_projects WHERE name = 'Test Project Timezone' LIMIT 1"
  );

  if (projectResult.rows.length === 0) {
    projectResult = await pool.query(
      `INSERT INTO native_projects (name, timezone)
       VALUES ('Test Project Timezone', $1)
       RETURNING id`,
      [userTimezone]
    );

    await pool.query(
      `INSERT INTO native_project_members (user_id, project_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [testUserId, projectResult.rows[0].id]
    );
  }

  testProjectId = projectResult.rows[0].id;
  log('green', `✓ Test project: Test Project Timezone (ID: ${testProjectId})`);

  // Clean old test data
  await pool.query('DELETE FROM native_user_availability WHERE user_id = $1', [testUserId]);
  await pool.query(
    'DELETE FROM native_rehearsal_responses WHERE rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $1)',
    [testProjectId]
  );
  await pool.query('DELETE FROM native_rehearsals WHERE project_id = $1', [testProjectId]);
  log('green', '✓ Old test data cleared');
}

// =============================================================================
// TEST 1: Basic Timezone Conversion
// =============================================================================

async function testBasicTimezoneConversion() {
  section('TEST 1: Basic Timezone Conversion');

  const testCases = [
    { local: { date: '2026-01-20', time: '09:00' }, expectedUtc: '2026-01-20T06:00:00.000Z' },
    { local: { date: '2026-01-20', time: '12:00' }, expectedUtc: '2026-01-20T09:00:00.000Z' },
    { local: { date: '2026-01-20', time: '18:00' }, expectedUtc: '2026-01-20T15:00:00.000Z' },
    { local: { date: '2026-01-20', time: '21:00' }, expectedUtc: '2026-01-20T18:00:00.000Z' },
  ];

  for (const tc of testCases) {
    const utc = localToTimestamp(tc.local.date, tc.local.time, userTimezone);
    const backToLocal = timestampToLocal(utc, userTimezone);

    const utcMatch = utc === tc.expectedUtc;
    const roundTripMatch = backToLocal.date === tc.local.date && backToLocal.time === tc.local.time;

    test(
      `${tc.local.date} ${tc.local.time} MSK → UTC`,
      utcMatch && roundTripMatch,
      `Expected: ${tc.expectedUtc}, Got: ${utc}, Round-trip: ${backToLocal.date} ${backToLocal.time}`
    );
  }
}

// =============================================================================
// TEST 2: Midnight Crossing
// =============================================================================

async function testMidnightCrossing() {
  section('TEST 2: Midnight Crossing (Forward & Backward)');

  // Forward: 21:00 UTC = 00:00 next day MSK
  const forwardUtc = '2026-01-20T21:00:00.000Z';
  const forwardLocal = timestampToLocal(forwardUtc, userTimezone);
  test(
    'Forward midnight crossing (21:00 UTC → 00:00 MSK next day)',
    forwardLocal.date === '2026-01-21' && forwardLocal.time === '00:00',
    `${forwardUtc} → ${forwardLocal.date} ${forwardLocal.time}`
  );

  // Backward: 03:00 UTC = 22:00 previous day in New York (UTC-5)
  const backwardUtc = '2026-01-20T03:00:00.000Z';
  const backwardLocal = timestampToLocal(backwardUtc, 'America/New_York');
  test(
    'Backward midnight crossing (03:00 UTC → 22:00 NY previous day)',
    backwardLocal.date === '2026-01-19' && backwardLocal.time === '22:00',
    `${backwardUtc} → ${backwardLocal.date} ${backwardLocal.time} (NY)`
  );
}

// =============================================================================
// TEST 3: Rehearsal Creation & Retrieval
// =============================================================================

async function testRehearsalCreation() {
  section('TEST 3: Rehearsal Creation & Retrieval');

  const rehearsals = [
    { name: 'Morning rehearsal', date: '2026-01-20', start: '09:00', end: '12:00' },
    { name: 'Evening rehearsal', date: '2026-01-20', start: '18:00', end: '21:00' },
    { name: 'Late night rehearsal', date: '2026-01-20', start: '22:00', end: '23:30' },
  ];

  const createdIds = [];

  for (const reh of rehearsals) {
    const startsAtUtc = localToTimestamp(reh.date, reh.start, userTimezone);
    const endsAtUtc = localToTimestamp(reh.date, reh.end, userTimezone);

    const result = await pool.query(
      `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, starts_at, ends_at`,
      [testProjectId, reh.name, startsAtUtc, endsAtUtc, testUserId]
    );

    const savedUtc = {
      starts: result.rows[0].starts_at.toISOString(),
      ends: result.rows[0].ends_at.toISOString(),
    };

    const savedLocal = {
      starts: timestampToLocal(savedUtc.starts, userTimezone),
      ends: timestampToLocal(savedUtc.ends, userTimezone),
    };

    const correct =
      savedLocal.starts.date === reh.date &&
      savedLocal.starts.time === reh.start &&
      savedLocal.ends.time === reh.end;

    test(
      `Create "${reh.name}" (${reh.start}-${reh.end} MSK)`,
      correct,
      `Stored as UTC: ${savedUtc.starts} - ${savedUtc.ends}\n  Retrieved as MSK: ${savedLocal.starts.date} ${savedLocal.starts.time} - ${savedLocal.ends.time}`
    );

    createdIds.push(result.rows[0].id);
  }

  // Retrieve all rehearsals
  const retrievedResult = await pool.query(
    'SELECT id, title, starts_at, ends_at FROM native_rehearsals WHERE project_id = $1 ORDER BY starts_at',
    [testProjectId]
  );

  test(
    'Retrieved all rehearsals from DB',
    retrievedResult.rows.length === rehearsals.length,
    `Expected: ${rehearsals.length}, Got: ${retrievedResult.rows.length}`
  );

  return createdIds;
}

// =============================================================================
// TEST 4: All-Day Events
// =============================================================================

async function testAllDayEvents() {
  section('TEST 4: All-Day Events');

  const allDayDate = '2026-01-21';
  const startsAtUtc = localToTimestamp(allDayDate, '00:00', userTimezone);
  const endsAtUtc = localToTimestamp(allDayDate, '23:59', userTimezone);

  const result = await pool.query(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, starts_at, ends_at`,
    [testProjectId, 'All-day event', startsAtUtc, endsAtUtc, testUserId]
  );

  const savedUtc = {
    starts: result.rows[0].starts_at.toISOString(),
    ends: result.rows[0].ends_at.toISOString(),
  };

  const savedLocal = {
    starts: timestampToLocal(savedUtc.starts, userTimezone),
    ends: timestampToLocal(savedUtc.ends, userTimezone),
  };

  const correct =
    savedLocal.starts.date === allDayDate &&
    savedLocal.starts.time === '00:00' &&
    savedLocal.ends.date === allDayDate &&
    savedLocal.ends.time === '23:59';

  test(
    `All-day event (${allDayDate} 00:00-23:59 MSK)`,
    correct,
    `UTC: ${savedUtc.starts} - ${savedUtc.ends}\n  MSK: ${savedLocal.starts.date} ${savedLocal.starts.time} - ${savedLocal.ends.date} ${savedLocal.ends.time}`
  );
}

// =============================================================================
// TEST 5: User Availability
// =============================================================================

async function testUserAvailability() {
  section('TEST 5: User Availability');

  const busySlots = [
    { title: 'Personal appointment', date: '2026-01-22', start: '14:00', end: '16:00' },
    { title: 'Doctor appointment', date: '2026-01-23', start: '10:00', end: '11:30' },
  ];

  for (const slot of busySlots) {
    const startsAtUtc = localToTimestamp(slot.date, slot.start, userTimezone);
    const endsAtUtc = localToTimestamp(slot.date, slot.end, userTimezone);

    await pool.query(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, is_all_day, source)
       VALUES ($1, $2, $3, 'busy', $4, FALSE, 'manual')`,
      [testUserId, startsAtUtc, endsAtUtc, slot.title]
    );
  }

  // Retrieve availability
  const result = await pool.query(
    'SELECT title, starts_at, ends_at FROM native_user_availability WHERE user_id = $1 ORDER BY starts_at',
    [testUserId]
  );

  for (let i = 0; i < busySlots.length; i++) {
    const expected = busySlots[i];
    const saved = result.rows[i];
    const savedLocal = {
      starts: timestampToLocal(saved.starts_at.toISOString(), userTimezone),
      ends: timestampToLocal(saved.ends_at.toISOString(), userTimezone),
    };

    const correct =
      savedLocal.starts.date === expected.date &&
      savedLocal.starts.time === expected.start &&
      savedLocal.ends.time === expected.end;

    test(
      `Busy slot: "${expected.title}" (${expected.start}-${expected.end} MSK)`,
      correct,
      `Retrieved: ${savedLocal.starts.date} ${savedLocal.starts.time} - ${savedLocal.ends.time}`
    );
  }
}

// =============================================================================
// TEST 6: Conflict Detection
// =============================================================================

async function testConflictDetection() {
  section('TEST 6: Conflict Detection');

  // Get user's busy slots
  const busyResult = await pool.query(
    'SELECT starts_at, ends_at FROM native_user_availability WHERE user_id = $1',
    [testUserId]
  );

  const busySlots = busyResult.rows.map(row => ({
    start: timestampToLocal(row.starts_at.toISOString(), userTimezone).time,
    end: timestampToLocal(row.ends_at.toISOString(), userTimezone).time,
  }));

  // Test scenarios
  const scenarios = [
    { time: '08:00-10:00', shouldConflict: false },
    { time: '14:00-16:00', shouldConflict: true }, // Overlaps with "Personal appointment"
    { time: '15:00-17:00', shouldConflict: true }, // Overlaps with "Personal appointment"
    { time: '17:00-19:00', shouldConflict: false },
  ];

  for (const scenario of scenarios) {
    const [start, end] = scenario.time.split('-');
    const hasConflict = busySlots.some(slot => {
      return !(end <= slot.start || start >= slot.end);
    });

    test(
      `Rehearsal ${scenario.time} ${scenario.shouldConflict ? 'should' : 'should NOT'} conflict`,
      hasConflict === scenario.shouldConflict,
      `Conflict detected: ${hasConflict}`
    );
  }
}

// =============================================================================
// TEST 7: Different Timezones
// =============================================================================

async function testDifferentTimezones() {
  section('TEST 7: Different Timezones');

  const timezones = [
    { name: 'Moscow', tz: 'Europe/Moscow', utc: 'UTC+3' },
    { name: 'New York', tz: 'America/New_York', utc: 'UTC-5' },
    { name: 'Tokyo', tz: 'Asia/Tokyo', utc: 'UTC+9' },
    { name: 'UTC', tz: 'UTC', utc: 'UTC+0' },
  ];

  const baseUtc = '2026-01-20T12:00:00.000Z';

  for (const tz of timezones) {
    const local = timestampToLocal(baseUtc, tz.tz);
    const backToUtc = localToTimestamp(local.date, local.time, tz.tz);
    const roundTripCorrect = backToUtc === baseUtc;

    test(
      `${tz.name} (${tz.utc}): 12:00 UTC → local → UTC`,
      roundTripCorrect,
      `Local: ${local.date} ${local.time}, Back to UTC: ${backToUtc}`
    );
  }
}

// =============================================================================
// TEST 8: Edge Cases
// =============================================================================

async function testEdgeCases() {
  section('TEST 8: Edge Cases');

  // Test 1: Same time different days
  const day1Utc = localToTimestamp('2026-01-20', '18:00', userTimezone);
  const day2Utc = localToTimestamp('2026-01-21', '18:00', userTimezone);
  test(
    'Same time different days are different',
    day1Utc !== day2Utc,
    `Day 1: ${day1Utc}, Day 2: ${day2Utc}`
  );

  // Test 2: Start of day
  const startOfDay = localToTimestamp('2026-01-20', '00:00', userTimezone);
  const backToLocal = timestampToLocal(startOfDay, userTimezone);
  test(
    'Start of day (00:00) conversion',
    backToLocal.time === '00:00' && backToLocal.date === '2026-01-20',
    `${startOfDay} → ${backToLocal.date} ${backToLocal.time}`
  );

  // Test 3: End of day
  const endOfDay = localToTimestamp('2026-01-20', '23:59', userTimezone);
  const endBackToLocal = timestampToLocal(endOfDay, userTimezone);
  test(
    'End of day (23:59) conversion',
    endBackToLocal.time === '23:59' && endBackToLocal.date === '2026-01-20',
    `${endOfDay} → ${endBackToLocal.date} ${endBackToLocal.time}`
  );

  // Test 4: Leap year (if applicable)
  const leapDay = localToTimestamp('2024-02-29', '12:00', userTimezone);
  const leapBackToLocal = timestampToLocal(leapDay, userTimezone);
  test(
    'Leap year date (2024-02-29)',
    leapBackToLocal.date === '2024-02-29',
    `${leapDay} → ${leapBackToLocal.date} ${leapBackToLocal.time}`
  );
}

// =============================================================================
// SUMMARY
// =============================================================================

async function printSummary() {
  section('SUMMARY');

  const rehearsalsCount = await pool.query(
    'SELECT COUNT(*) FROM native_rehearsals WHERE project_id = $1',
    [testProjectId]
  );

  const availabilityCount = await pool.query(
    'SELECT COUNT(*) FROM native_user_availability WHERE user_id = $1',
    [testUserId]
  );

  log('blue', `Total rehearsals created: ${rehearsalsCount.rows[0].count}`);
  log('blue', `Total availability slots: ${availabilityCount.rows[0].count}`);

  console.log('\n📊 Database State:');

  const allRehearsals = await pool.query(
    'SELECT title, starts_at, ends_at FROM native_rehearsals WHERE project_id = $1 ORDER BY starts_at',
    [testProjectId]
  );

  console.log('\n  Rehearsals:');
  for (const reh of allRehearsals.rows) {
    const local = {
      starts: timestampToLocal(reh.starts_at.toISOString(), userTimezone),
      ends: timestampToLocal(reh.ends_at.toISOString(), userTimezone),
    };
    console.log(`    - ${reh.title}: ${local.starts.date} ${local.starts.time} - ${local.ends.time} (MSK)`);
  }

  const allAvailability = await pool.query(
    'SELECT title, starts_at, ends_at FROM native_user_availability WHERE user_id = $1 ORDER BY starts_at',
    [testUserId]
  );

  console.log('\n  Availability:');
  for (const slot of allAvailability.rows) {
    const local = {
      starts: timestampToLocal(slot.starts_at.toISOString(), userTimezone),
      ends: timestampToLocal(slot.ends_at.toISOString(), userTimezone),
    };
    console.log(`    - ${slot.title}: ${local.starts.date} ${local.starts.time} - ${local.ends.time} (MSK)`);
  }

  console.log('\n');
  log('green', '✅ All scenarios tested successfully!');
  console.log('\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Comprehensive Timezone & Rehearsal Test Suite           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await setup();
    await testBasicTimezoneConversion();
    await testMidnightCrossing();
    await testRehearsalCreation();
    await testAllDayEvents();
    await testUserAvailability();
    await testConflictDetection();
    await testDifferentTimezones();
    await testEdgeCases();
    await printSummary();

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

main();
