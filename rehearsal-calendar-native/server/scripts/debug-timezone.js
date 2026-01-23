/**
 * Debug script to test localToTimestamp function
 */

import { localToTimestamp, timestampToLocal } from '../utils/timezone.js';

console.log('\n=== Testing localToTimestamp function ===\n');

const testCases = [
  { date: '2026-01-20', time: '09:00', timezone: 'Europe/Moscow' },
  { date: '2026-01-20', time: '12:00', timezone: 'Europe/Moscow' },
  { date: '2026-01-20', time: '18:00', timezone: 'Europe/Moscow' },
  { date: '2026-01-20', time: '21:00', timezone: 'Europe/Moscow' },
];

for (const test of testCases) {
  const result = localToTimestamp(test.date, test.time, test.timezone);
  const backToLocal = timestampToLocal(result, test.timezone);

  console.log(`Input:  ${test.date} ${test.time} (${test.timezone})`);
  console.log(`Output: ${result}`);
  console.log(`Check:  ${backToLocal.date} ${backToLocal.time}`);

  const match = backToLocal.date === test.date && backToLocal.time === test.time;
  console.log(`Result: ${match ? '✓ PASS' : '❌ FAIL'}\n`);
}
