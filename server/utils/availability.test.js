import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeBusyRanges, busyToFreeGaps } from '../shared/availability.js';

test('mergeBusyRanges merges overlaps', () => {
  const result = mergeBusyRanges([
    { start: '10:00', end: '12:00' },
    { start: '11:00', end: '13:00' },
  ]);
  assert.deepStrictEqual(result, [{ start: '10:00', end: '13:00' }]);
});

test('busyToFreeGaps returns complement intervals', () => {
  const result = busyToFreeGaps([{ start: '10:00', end: '12:00' }]);
  assert.deepStrictEqual(result, [
    { start: '00:00', end: '10:00' },
    { start: '12:00', end: '23:59' },
  ]);
});
