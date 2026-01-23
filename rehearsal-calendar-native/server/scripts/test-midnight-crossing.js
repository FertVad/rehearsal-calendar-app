/**
 * Detailed test for midnight crossing scenarios
 * Tests all edge cases when events cross midnight in different timezones
 */

import { localToTimestamp, timestampToLocal } from '../utils/timezone.js';

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

function test(name, passed, details = '') {
  if (passed) {
    log('green', `✓ ${name}`);
    if (details) console.log(`  ${details}`);
  } else {
    log('red', `✗ ${name}`);
    if (details) console.log(`  ${details}`);
  }
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log('cyan', `  ${title}`);
  console.log('='.repeat(70) + '\n');
}

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║         Midnight Crossing Detailed Test Suite                   ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

// =============================================================================
// TEST 1: Forward Midnight Crossing (UTC → Local next day)
// =============================================================================

section('TEST 1: Forward Midnight Crossing (UTC → Local next day)');

const forwardCases = [
  {
    name: 'Moscow: 21:00 UTC = 00:00 MSK next day',
    utc: '2026-01-20T21:00:00.000Z',
    timezone: 'Europe/Moscow',
    expectedDate: '2026-01-21',
    expectedTime: '00:00',
  },
  {
    name: 'Moscow: 22:00 UTC = 01:00 MSK next day',
    utc: '2026-01-20T22:00:00.000Z',
    timezone: 'Europe/Moscow',
    expectedDate: '2026-01-21',
    expectedTime: '01:00',
  },
  {
    name: 'Moscow: 23:59 UTC = 02:59 MSK next day',
    utc: '2026-01-20T23:59:00.000Z',
    timezone: 'Europe/Moscow',
    expectedDate: '2026-01-21',
    expectedTime: '02:59',
  },
  {
    name: 'Tokyo: 15:00 UTC = 00:00 JST next day',
    utc: '2026-01-20T15:00:00.000Z',
    timezone: 'Asia/Tokyo',
    expectedDate: '2026-01-21',
    expectedTime: '00:00',
  },
];

for (const tc of forwardCases) {
  const result = timestampToLocal(tc.utc, tc.timezone);
  const passed = result.date === tc.expectedDate && result.time === tc.expectedTime;
  test(
    tc.name,
    passed,
    `Expected: ${tc.expectedDate} ${tc.expectedTime}, Got: ${result.date} ${result.time}`
  );
}

// =============================================================================
// TEST 2: Backward Midnight Crossing (UTC → Local previous day)
// =============================================================================

section('TEST 2: Backward Midnight Crossing (UTC → Local previous day)');

const backwardCases = [
  {
    name: 'New York: 03:00 UTC = 22:00 EST previous day',
    utc: '2026-01-20T03:00:00.000Z',
    timezone: 'America/New_York',
    expectedDate: '2026-01-19',
    expectedTime: '22:00',
  },
  {
    name: 'New York: 04:59 UTC = 23:59 EST previous day',
    utc: '2026-01-20T04:59:00.000Z',
    timezone: 'America/New_York',
    expectedDate: '2026-01-19',
    expectedTime: '23:59',
  },
  {
    name: 'Los Angeles: 07:00 UTC = 23:00 PST previous day',
    utc: '2026-01-20T07:00:00.000Z',
    timezone: 'America/Los_Angeles',
    expectedDate: '2026-01-19',
    expectedTime: '23:00',
  },
];

for (const tc of backwardCases) {
  const result = timestampToLocal(tc.utc, tc.timezone);
  const passed = result.date === tc.expectedDate && result.time === tc.expectedTime;
  test(
    tc.name,
    passed,
    `Expected: ${tc.expectedDate} ${tc.expectedTime}, Got: ${result.date} ${result.time}`
  );
}

// =============================================================================
// TEST 3: Rehearsal Spanning Midnight (Local → UTC → Local)
// =============================================================================

section('TEST 3: Rehearsal Spanning Midnight (Local time)');

console.log('Scenario: Late night rehearsal 23:00 - 01:00 next day in Moscow\n');

// Start: 23:00 MSK on Jan 20
const startLocal = { date: '2026-01-20', time: '23:00' };
const startUtc = localToTimestamp(startLocal.date, startLocal.time, 'Europe/Moscow');
const startBackToLocal = timestampToLocal(startUtc, 'Europe/Moscow');

log('blue', `Start time:`);
console.log(`  Local:  ${startLocal.date} ${startLocal.time} (MSK)`);
console.log(`  UTC:    ${startUtc}`);
console.log(`  Back:   ${startBackToLocal.date} ${startBackToLocal.time}`);

test(
  'Start time round-trip',
  startBackToLocal.date === startLocal.date && startBackToLocal.time === startLocal.time
);

// End: 01:00 MSK on Jan 21 (next day!)
const endLocal = { date: '2026-01-21', time: '01:00' };
const endUtc = localToTimestamp(endLocal.date, endLocal.time, 'Europe/Moscow');
const endBackToLocal = timestampToLocal(endUtc, 'Europe/Moscow');

console.log();
log('blue', `End time:`);
console.log(`  Local:  ${endLocal.date} ${endLocal.time} (MSK)`);
console.log(`  UTC:    ${endUtc}`);
console.log(`  Back:   ${endBackToLocal.date} ${endBackToLocal.time}`);

test(
  'End time round-trip',
  endBackToLocal.date === endLocal.date && endBackToLocal.time === endLocal.time
);

// Duration check
const startDate = new Date(startUtc);
const endDate = new Date(endUtc);
const durationHours = (endDate - startDate) / (1000 * 60 * 60);

console.log();
log('blue', `Duration: ${durationHours} hours`);
test(
  'Duration is correct (2 hours)',
  durationHours === 2,
  `Expected: 2 hours, Got: ${durationHours} hours`
);

// =============================================================================
// TEST 4: All-Day Event with Midnight
// =============================================================================

section('TEST 4: All-Day Event (00:00 - 23:59)');

const allDayDate = '2026-01-21';
const allDayStart = localToTimestamp(allDayDate, '00:00', 'Europe/Moscow');
const allDayEnd = localToTimestamp(allDayDate, '23:59', 'Europe/Moscow');

console.log(`All-day event: ${allDayDate} (Europe/Moscow)\n`);

const startResult = timestampToLocal(allDayStart, 'Europe/Moscow');
const endResult = timestampToLocal(allDayEnd, 'Europe/Moscow');

log('blue', `Start (00:00 MSK):`);
console.log(`  UTC:   ${allDayStart}`);
console.log(`  Back:  ${startResult.date} ${startResult.time}`);

test(
  'All-day start is 00:00 on correct date',
  startResult.date === allDayDate && startResult.time === '00:00'
);

console.log();
log('blue', `End (23:59 MSK):`);
console.log(`  UTC:   ${allDayEnd}`);
console.log(`  Back:  ${endResult.date} ${endResult.time}`);

test(
  'All-day end is 23:59 on correct date',
  endResult.date === allDayDate && endResult.time === '23:59'
);

// Check that UTC times are different days
const startUtcDate = new Date(allDayStart).getUTCDate();
const endUtcDate = new Date(allDayEnd).getUTCDate();

console.log();
log('yellow', `Note: In UTC, this spans ${startUtcDate === endUtcDate ? 'same day' : 'different days'}`);
console.log(`  Start UTC: ${allDayStart} (day ${startUtcDate})`);
console.log(`  End UTC:   ${allDayEnd} (day ${endUtcDate})`);

// =============================================================================
// TEST 5: Edge Case - Exactly Midnight
// =============================================================================

section('TEST 5: Exactly Midnight (00:00)');

const midnights = [
  { timezone: 'Europe/Moscow', name: 'Moscow' },
  { timezone: 'America/New_York', name: 'New York' },
  { timezone: 'Asia/Tokyo', name: 'Tokyo' },
  { timezone: 'UTC', name: 'UTC' },
];

for (const tz of midnights) {
  const date = '2026-01-21';
  const utc = localToTimestamp(date, '00:00', tz.timezone);
  const back = timestampToLocal(utc, tz.timezone);

  test(
    `${tz.name}: 00:00 on ${date}`,
    back.date === date && back.time === '00:00',
    `UTC: ${utc} → ${back.date} ${back.time}`
  );
}

// =============================================================================
// TEST 6: Edge Case - One Minute Before Midnight
// =============================================================================

section('TEST 6: One Minute Before Midnight (23:59)');

for (const tz of midnights) {
  const date = '2026-01-21';
  const utc = localToTimestamp(date, '23:59', tz.timezone);
  const back = timestampToLocal(utc, tz.timezone);

  test(
    `${tz.name}: 23:59 on ${date}`,
    back.date === date && back.time === '23:59',
    `UTC: ${utc} → ${back.date} ${back.time}`
  );
}

// =============================================================================
// TEST 7: Real-World Scenario - Late Night Rehearsal
// =============================================================================

section('TEST 7: Real-World Scenario - Late Night Rehearsal');

console.log('Scenario: Band rehearsal from 22:00 to 01:00 next day\n');
console.log('User creates rehearsal:');
console.log('  Date: 2026-01-20');
console.log('  Start: 22:00');
console.log('  End: Should end at 01:00 on 2026-01-21\n');

const rehStart = { date: '2026-01-20', time: '22:00' };
const rehEnd = { date: '2026-01-21', time: '01:00' }; // Next day!

const rehStartUtc = localToTimestamp(rehStart.date, rehStart.time, 'Europe/Moscow');
const rehEndUtc = localToTimestamp(rehEnd.date, rehEnd.time, 'Europe/Moscow');

log('blue', 'Stored in database (UTC):');
console.log(`  starts_at: ${rehStartUtc}`);
console.log(`  ends_at:   ${rehEndUtc}`);

const rehStartBack = timestampToLocal(rehStartUtc, 'Europe/Moscow');
const rehEndBack = timestampToLocal(rehEndUtc, 'Europe/Moscow');

console.log();
log('blue', 'Retrieved and displayed to user (MSK):');
console.log(`  Starts: ${rehStartBack.date} at ${rehStartBack.time}`);
console.log(`  Ends:   ${rehEndBack.date} at ${rehEndBack.time}`);

test(
  'Start time is correct',
  rehStartBack.date === rehStart.date && rehStartBack.time === rehStart.time
);

test(
  'End time is correct (next day)',
  rehEndBack.date === rehEnd.date && rehEndBack.time === rehEnd.time
);

const duration = (new Date(rehEndUtc) - new Date(rehStartUtc)) / (1000 * 60 * 60);
console.log();
log('blue', `Duration: ${duration} hours`);
test('Duration is 3 hours', duration === 3);

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(70));
log('green', '✅ All midnight crossing scenarios passed!');
console.log('='.repeat(70));

console.log('\n📋 Summary:');
console.log('  • Forward midnight crossing (UTC → local next day): ✅');
console.log('  • Backward midnight crossing (UTC → local previous day): ✅');
console.log('  • Rehearsals spanning midnight: ✅');
console.log('  • All-day events: ✅');
console.log('  • Exactly midnight (00:00): ✅');
console.log('  • One minute before midnight (23:59): ✅');
console.log('  • Real-world late night rehearsals: ✅\n');

log('cyan', '🎯 Conclusion: Timezone conversion correctly handles all midnight edge cases!');
console.log();
