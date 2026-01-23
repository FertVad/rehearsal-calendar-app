/**
 * Tests for timezone conversion functions
 *
 * These tests verify that timezone conversion works correctly for:
 * - Regular times
 * - Midnight crossings (events that span across midnight in user's timezone)
 * - All-day events
 * - Different timezones
 */

import {
  isoToDateStringInTimezone,
  isoToTimeStringInTimezone,
  dateTimeToISOInTimezone,
  isStartOfDayInTimezone,
  isEndOfDayInTimezone,
} from '../time';

describe('Timezone Conversion Functions', () => {
  describe('isoToTimeStringInTimezone', () => {
    it('should convert UTC to Moscow time correctly', () => {
      // 15:00 UTC = 18:00 Moscow (UTC+3)
      expect(isoToTimeStringInTimezone('2026-01-20T15:00:00.000Z', 'Europe/Moscow')).toBe('18:00');

      // 18:00 UTC = 21:00 Moscow
      expect(isoToTimeStringInTimezone('2026-01-20T18:00:00.000Z', 'Europe/Moscow')).toBe('21:00');

      // 21:00 UTC = 00:00 next day Moscow (crosses midnight!)
      expect(isoToTimeStringInTimezone('2026-01-20T21:00:00.000Z', 'Europe/Moscow')).toBe('00:00');

      // 06:00 UTC = 09:00 Moscow
      expect(isoToTimeStringInTimezone('2026-01-20T06:00:00.000Z', 'Europe/Moscow')).toBe('09:00');
    });

    it('should convert UTC to New York time correctly', () => {
      // 15:00 UTC = 10:00 New York (UTC-5)
      expect(isoToTimeStringInTimezone('2026-01-20T15:00:00.000Z', 'America/New_York')).toBe('10:00');

      // 03:00 UTC = 22:00 previous day New York (crosses midnight backward!)
      expect(isoToTimeStringInTimezone('2026-01-20T03:00:00.000Z', 'America/New_York')).toBe('22:00');
    });

    it('should handle UTC timezone', () => {
      expect(isoToTimeStringInTimezone('2026-01-20T15:00:00.000Z', 'UTC')).toBe('15:00');
      expect(isoToTimeStringInTimezone('2026-01-20T00:00:00.000Z', 'UTC')).toBe('00:00');
      expect(isoToTimeStringInTimezone('2026-01-20T23:59:00.000Z', 'UTC')).toBe('23:59');
    });
  });

  describe('isoToDateStringInTimezone', () => {
    it('should return correct date when time crosses midnight', () => {
      // 21:00 UTC on Jan 20 = 00:00 on Jan 21 in Moscow
      expect(isoToDateStringInTimezone('2026-01-20T21:00:00.000Z', 'Europe/Moscow')).toBe('2026-01-21');

      // 20:59 UTC on Jan 20 = 23:59 on Jan 20 in Moscow (same day)
      expect(isoToDateStringInTimezone('2026-01-20T20:59:00.000Z', 'Europe/Moscow')).toBe('2026-01-20');
    });

    it('should return correct date when time crosses midnight backward', () => {
      // 03:00 UTC on Jan 20 = 22:00 on Jan 19 in New York
      expect(isoToDateStringInTimezone('2026-01-20T03:00:00.000Z', 'America/New_York')).toBe('2026-01-19');

      // 05:00 UTC on Jan 20 = 00:00 on Jan 20 in New York
      expect(isoToDateStringInTimezone('2026-01-20T05:00:00.000Z', 'America/New_York')).toBe('2026-01-20');
    });

    it('should return correct date in same timezone', () => {
      expect(isoToDateStringInTimezone('2026-01-20T15:00:00.000Z', 'Europe/Moscow')).toBe('2026-01-20');
      expect(isoToDateStringInTimezone('2026-01-20T00:00:00.000Z', 'UTC')).toBe('2026-01-20');
    });
  });

  describe('dateTimeToISOInTimezone', () => {
    it('should convert Moscow time to UTC correctly', () => {
      // 18:00 Moscow = 15:00 UTC (Moscow is UTC+3)
      expect(dateTimeToISOInTimezone('2026-01-20', '18:00', 'Europe/Moscow')).toBe('2026-01-20T15:00:00.000Z');

      // 21:00 Moscow = 18:00 UTC
      expect(dateTimeToISOInTimezone('2026-01-20', '21:00', 'Europe/Moscow')).toBe('2026-01-20T18:00:00.000Z');

      // 00:00 Moscow = 21:00 previous day UTC
      expect(dateTimeToISOInTimezone('2026-01-20', '00:00', 'Europe/Moscow')).toBe('2026-01-19T21:00:00.000Z');

      // 09:00 Moscow = 06:00 UTC
      expect(dateTimeToISOInTimezone('2026-01-20', '09:00', 'Europe/Moscow')).toBe('2026-01-20T06:00:00.000Z');
    });

    it('should convert New York time to UTC correctly', () => {
      // 10:00 New York = 15:00 UTC (New York is UTC-5)
      expect(dateTimeToISOInTimezone('2026-01-20', '10:00', 'America/New_York')).toBe('2026-01-20T15:00:00.000Z');

      // 00:00 New York = 05:00 UTC same day
      expect(dateTimeToISOInTimezone('2026-01-20', '00:00', 'America/New_York')).toBe('2026-01-20T05:00:00.000Z');
    });

    it('should handle UTC timezone', () => {
      expect(dateTimeToISOInTimezone('2026-01-20', '15:00', 'UTC')).toBe('2026-01-20T15:00:00.000Z');
      expect(dateTimeToISOInTimezone('2026-01-20', '00:00', 'UTC')).toBe('2026-01-20T00:00:00.000Z');
    });
  });

  describe('All-day event helpers', () => {
    it('should detect start of day correctly', () => {
      // Moscow timezone
      expect(isStartOfDayInTimezone('2026-01-19T21:00:00.000Z', 'Europe/Moscow')).toBe(true); // 00:00 MSK
      expect(isStartOfDayInTimezone('2026-01-20T15:00:00.000Z', 'Europe/Moscow')).toBe(false); // 18:00 MSK

      // UTC timezone
      expect(isStartOfDayInTimezone('2026-01-20T00:00:00.000Z', 'UTC')).toBe(true);
      expect(isStartOfDayInTimezone('2026-01-20T00:01:00.000Z', 'UTC')).toBe(false);
    });

    it('should detect end of day correctly', () => {
      // Moscow timezone
      expect(isEndOfDayInTimezone('2026-01-20T20:59:00.000Z', 'Europe/Moscow')).toBe(true); // 23:59 MSK
      expect(isEndOfDayInTimezone('2026-01-20T15:00:00.000Z', 'Europe/Moscow')).toBe(false); // 18:00 MSK

      // UTC timezone
      expect(isEndOfDayInTimezone('2026-01-20T23:59:00.000Z', 'UTC')).toBe(true);
      expect(isEndOfDayInTimezone('2026-01-20T23:58:00.000Z', 'UTC')).toBe(false);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve time after round-trip conversion', () => {
      const originalDate = '2026-01-20';
      const originalTime = '18:00';
      const timezone = 'Europe/Moscow';

      // Local -> UTC -> Local
      const utcISO = dateTimeToISOInTimezone(originalDate, originalTime, timezone);
      const backToDate = isoToDateStringInTimezone(utcISO, timezone);
      const backToTime = isoToTimeStringInTimezone(utcISO, timezone);

      expect(backToDate).toBe(originalDate);
      expect(backToTime).toBe(originalTime);
    });

    it('should handle midnight crossing in round-trip', () => {
      const originalDate = '2026-01-20';
      const originalTime = '00:00';
      const timezone = 'Europe/Moscow';

      // Local -> UTC -> Local
      const utcISO = dateTimeToISOInTimezone(originalDate, originalTime, timezone);
      const backToDate = isoToDateStringInTimezone(utcISO, timezone);
      const backToTime = isoToTimeStringInTimezone(utcISO, timezone);

      expect(backToDate).toBe(originalDate);
      expect(backToTime).toBe(originalTime);
    });

    it('should handle end of day in round-trip', () => {
      const originalDate = '2026-01-20';
      const originalTime = '23:59';
      const timezone = 'Europe/Moscow';

      // Local -> UTC -> Local
      const utcISO = dateTimeToISOInTimezone(originalDate, originalTime, timezone);
      const backToDate = isoToDateStringInTimezone(utcISO, timezone);
      const backToTime = isoToTimeStringInTimezone(utcISO, timezone);

      expect(backToDate).toBe(originalDate);
      expect(backToTime).toBe(originalTime);
    });
  });

  describe('Edge cases', () => {
    it('should handle DST transitions correctly', () => {
      // Note: These tests might need adjustment based on actual DST rules
      // Just verifying that function doesn't throw
      expect(() => {
        dateTimeToISOInTimezone('2026-03-29', '02:30', 'Europe/Moscow');
      }).not.toThrow();
    });

    it('should handle different timezones consistently', () => {
      const utcTime = '2026-01-20T12:00:00.000Z';

      // Same UTC time should give different local times in different timezones
      const moscowTime = isoToTimeStringInTimezone(utcTime, 'Europe/Moscow');
      const nyTime = isoToTimeStringInTimezone(utcTime, 'America/New_York');
      const tokyoTime = isoToTimeStringInTimezone(utcTime, 'Asia/Tokyo');

      expect(moscowTime).not.toBe(nyTime);
      expect(moscowTime).not.toBe(tokyoTime);
      expect(nyTime).not.toBe(tokyoTime);
    });
  });
});
