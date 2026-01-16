/**
 * Unit Tests for server/utils/timezone.js
 *
 * Deterministic tests for timezone conversion utilities.
 * Uses fixed dates and IANA timezone (Asia/Jerusalem) to ensure consistent behavior.
 */

import {
  timestampToLocal,
  localToTimestamp,
  timestampToISO,
} from '../utils/timezone.js';

describe('Timezone Utilities', () => {
  // Fixed timezone for deterministic tests
  const TIMEZONE = 'Asia/Jerusalem';

  describe('timestampToLocal', () => {
    it('should convert UTC timestamp to local date/time in Asia/Jerusalem', () => {
      // December 10, 2025, 17:00 UTC = 19:00 Jerusalem (UTC+2 in winter)
      const utcTimestamp = '2025-12-10T17:00:00.000Z';
      const result = timestampToLocal(utcTimestamp, TIMEZONE);

      expect(result).toEqual({
        date: '2025-12-10',
        time: '19:00',
      });
    });

    it('should handle midnight edge case (hour=24 converted to 00)', () => {
      // Test midnight conversion
      const utcTimestamp = '2025-12-10T22:00:00.000Z'; // 22:00 UTC = 00:00 next day Jerusalem
      const result = timestampToLocal(utcTimestamp, TIMEZONE);

      expect(result).toEqual({
        date: '2025-12-11',
        time: '00:00',
      });
    });

    it('should handle timestamps with timezone offset notation', () => {
      // ISO timestamp with +02:00 offset (already in Jerusalem time)
      const isoTimestamp = '2025-12-10T19:00:00+02:00';
      const result = timestampToLocal(isoTimestamp, TIMEZONE);

      expect(result).toEqual({
        date: '2025-12-10',
        time: '19:00',
      });
    });
  });

  describe('localToTimestamp', () => {
    it('should convert local date/time to UTC timestamp', () => {
      // December 10, 2025, 19:00 Jerusalem = 17:00 UTC (UTC+2 in winter)
      const date = '2025-12-10';
      const time = '19:00';
      const result = localToTimestamp(date, time, TIMEZONE);

      expect(result).toBe('2025-12-10T17:00:00.000Z');
    });

    it('should handle midnight local time', () => {
      // Midnight in Jerusalem
      const date = '2025-12-11';
      const time = '00:00';
      const result = localToTimestamp(date, time, TIMEZONE);

      // 00:00 Jerusalem = 22:00 UTC previous day
      expect(result).toBe('2025-12-10T22:00:00.000Z');
    });

    it('should handle summer time (DST) correctly', () => {
      // June 15, 2025, 19:00 Jerusalem = 16:00 UTC (UTC+3 in summer)
      const date = '2025-06-15';
      const time = '19:00';
      const result = localToTimestamp(date, time, TIMEZONE);

      expect(result).toBe('2025-06-15T16:00:00.000Z');
    });
  });

  describe('Round-trip conversion (A)', () => {
    it('should maintain time integrity: UTC -> local -> UTC', () => {
      // Start with a fixed UTC timestamp
      const originalUTC = '2025-12-10T17:00:00.000Z';

      // Convert to local
      const local = timestampToLocal(originalUTC, TIMEZONE);
      expect(local).toEqual({
        date: '2025-12-10',
        time: '19:00',
      });

      // Convert back to UTC
      const backToUTC = localToTimestamp(local.date, local.time, TIMEZONE);
      expect(backToUTC).toBe(originalUTC);
    });

    it('should maintain time integrity across DST boundary', () => {
      // Summer time test
      const originalUTC = '2025-06-15T16:00:00.000Z';

      const local = timestampToLocal(originalUTC, TIMEZONE);
      expect(local.date).toBe('2025-06-15');
      expect(local.time).toBe('19:00');

      const backToUTC = localToTimestamp(local.date, local.time, TIMEZONE);
      expect(backToUTC).toBe(originalUTC);
    });
  });

  describe('Date boundary changes (B)', () => {
    it('should handle date change when converting late UTC time to Jerusalem', () => {
      // 23:30 UTC = 01:30 next day in Jerusalem (winter, UTC+2)
      const utcTimestamp = '2025-12-10T23:30:00.000Z';
      const result = timestampToLocal(utcTimestamp, TIMEZONE);

      // Date should change to next day
      expect(result.date).toBe('2025-12-11');
      expect(result.time).toBe('01:30');
    });

    it('should handle date change when converting early Jerusalem time to UTC', () => {
      // 00:30 Jerusalem = 22:30 UTC previous day (winter, UTC+2)
      const date = '2025-12-11';
      const time = '00:30';
      const result = localToTimestamp(date, time, TIMEZONE);

      // UTC timestamp should be previous day
      const resultDate = new Date(result);
      expect(resultDate.getUTCDate()).toBe(10);
      expect(resultDate.getUTCHours()).toBe(22);
      expect(resultDate.getUTCMinutes()).toBe(30);
    });
  });

  describe('All-day event handling (C)', () => {
    it('should ensure all-day event spans full day in UTC', () => {
      // All-day event: Dec 25, 2025
      const startsAt = '2025-12-25T00:00:00.000Z';
      const endsAt = '2025-12-25T23:59:59.999Z';

      const startDate = new Date(startsAt);
      const endDate = new Date(endsAt);

      // Verify end > start
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());

      // Verify it's the same day in UTC
      expect(startDate.getUTCDate()).toBe(25);
      expect(endDate.getUTCDate()).toBe(25);

      // Verify start is at midnight
      expect(startDate.getUTCHours()).toBe(0);
      expect(startDate.getUTCMinutes()).toBe(0);
      expect(startDate.getUTCSeconds()).toBe(0);

      // Verify end is at last moment of day
      expect(endDate.getUTCHours()).toBe(23);
      expect(endDate.getUTCMinutes()).toBe(59);
      expect(endDate.getUTCSeconds()).toBe(59);
    });

    it('should not invert times when converting all-day event to local', () => {
      const startsAt = '2025-12-25T00:00:00.000Z';
      const endsAt = '2025-12-25T23:59:59.999Z';

      const startLocal = timestampToLocal(startsAt, TIMEZONE);
      const endLocal = timestampToLocal(endsAt, TIMEZONE);

      // Convert back to comparable timestamps
      const startTimestamp = localToTimestamp(startLocal.date, startLocal.time, TIMEZONE);
      const endTimestamp = localToTimestamp(endLocal.date, endLocal.time, TIMEZONE);

      // Ensure end is still after start
      expect(new Date(endTimestamp).getTime()).toBeGreaterThan(
        new Date(startTimestamp).getTime()
      );
    });
  });

  describe('Format validation (D)', () => {
    it('should return valid ISO 8601 strings from localToTimestamp', () => {
      const result = localToTimestamp('2025-12-10', '19:00', TIMEZONE);

      // Check format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should be parseable as a valid date
      const date = new Date(result);
      expect(date.toString()).not.toBe('Invalid Date');
      expect(date.toISOString()).toBe(result);
    });

    it('should return valid date/time objects from timestampToLocal', () => {
      const result = timestampToLocal('2025-12-10T17:00:00.000Z', TIMEZONE);

      // Check date format: YYYY-MM-DD
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check time format: HH:mm
      expect(result.time).toMatch(/^\d{2}:\d{2}$/);

      // Date components should be valid
      const [year, month, day] = result.date.split('-').map(Number);
      expect(year).toBeGreaterThan(2000);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);

      // Time components should be valid
      const [hours, minutes] = result.time.split(':').map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThanOrEqual(23);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(59);
    });

    it('should handle timestampToISO with Date objects', () => {
      const date = new Date('2025-12-10T17:00:00.000Z');
      const result = timestampToISO(date);

      expect(result).toBe('2025-12-10T17:00:00.000Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle timestampToISO with ISO strings', () => {
      const isoString = '2025-12-10T17:00:00.000Z';
      const result = timestampToISO(isoString);

      expect(result).toBe(isoString);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Edge cases', () => {
    it('should handle year boundary (New Year)', () => {
      // Dec 31, 2025, 23:00 Jerusalem = Dec 31, 2025, 21:00 UTC
      const result = localToTimestamp('2025-12-31', '23:00', TIMEZONE);
      expect(result).toBe('2025-12-31T21:00:00.000Z');

      // Jan 1, 2026, 01:00 Jerusalem = Dec 31, 2025, 23:00 UTC
      const newYearResult = localToTimestamp('2026-01-01', '01:00', TIMEZONE);
      expect(newYearResult).toBe('2025-12-31T23:00:00.000Z');
    });

    it('should handle single-digit hours and minutes', () => {
      // Test with 09:05 (leading zeros)
      const result = localToTimestamp('2025-12-10', '09:05', TIMEZONE);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const parsed = new Date(result);
      expect(parsed.toString()).not.toBe('Invalid Date');
    });
  });
});
