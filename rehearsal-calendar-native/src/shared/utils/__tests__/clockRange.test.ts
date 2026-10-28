/**
 * Cause fix 15: a date with two clock times is an interval, by one rule, and
 * every form and check reads it by that rule.
 */
import {
  addDays,
  clockRangeEndDate,
  clockRangeMinutes,
  clockRangeToISO,
  endsNextDay,
  intervalDates,
  isEmptyClockRange,
  minuteRangesOverlap,
} from '../time';
import { checkSchedulingConflicts } from '../conflictDetection';
import { rehearsalDates, rehearsalInZone, rehearsalOnDate, rehearsalTimeLabel } from '../rehearsalDays';

describe('the clock range rule', () => {
  it('an end after the start is the same day, before it the next, equal is no range', () => {
    expect(endsNextDay('10:00', '18:00')).toBe(false);
    expect(endsNextDay('23:00', '01:00')).toBe(true);
    expect(endsNextDay('22:00', '00:00')).toBe(true);
    expect(isEmptyClockRange('10:00', '10:00')).toBe(true);
    expect(isEmptyClockRange('23:00', '01:00')).toBe(false);
  });

  it('puts the end on the next date, across a month and a year', () => {
    expect(clockRangeEndDate('2026-09-10', '10:00', '18:00')).toBe('2026-09-10');
    expect(clockRangeEndDate('2026-09-30', '23:00', '01:00')).toBe('2026-10-01');
    expect(clockRangeEndDate('2025-12-31', '23:00', '01:00')).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is an interval in the timezone it is read in (DF04)', () => {
    expect(clockRangeToISO('2026-01-20', '23:00', '01:00', 'Europe/Moscow')).toEqual({
      startsAt: '2026-01-20T20:00:00.000Z',
      endsAt: '2026-01-20T22:00:00.000Z',
    });
    expect(clockRangeToISO('2026-01-20', '18:00', '21:00', 'UTC')).toEqual({
      startsAt: '2026-01-20T18:00:00.000Z',
      endsAt: '2026-01-20T21:00:00.000Z',
    });
  });

  it('compares on the start day\'s axis, the next day shifted by a day', () => {
    expect(clockRangeMinutes('23:00', '01:00')).toEqual([1380, 1500]);
    expect(clockRangeMinutes('00:00', '00:30', 1)).toEqual([1440, 1470]);
    expect(minuteRangesOverlap([600, 840], [840, 960])).toBe(false);
    expect(minuteRangesOverlap([1380, 1500], [1440, 1470])).toBe(true);
  });

  it('an interval covers its dates; an end at midnight closes the day before', () => {
    expect(intervalDates('2026-09-10T23:00:00Z', '2026-09-11T01:00:00Z', 'UTC'))
      .toEqual({ first: '2026-09-10', last: '2026-09-11' });
    expect(intervalDates('2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z', 'UTC'))
      .toEqual({ first: '2026-09-10', last: '2026-09-10' });
    // Read in New York, the same instants are one evening.
    expect(intervalDates('2026-09-11T01:00:00Z', '2026-09-11T03:00:00Z', 'America/New_York'))
      .toEqual({ first: '2026-09-10', last: '2026-09-10' });
  });
});

describe('a rehearsal past midnight on the screens (DD02)', () => {
  const night = rehearsalInZone(
    { id: 'n', startsAt: '2026-09-10T23:00:00Z', endsAt: '2026-09-11T01:00:00Z' },
    'UTC'
  );

  it('is on both days, and on no other', () => {
    expect(rehearsalOnDate(night, '2026-09-10')).toBe(true);
    expect(rehearsalOnDate(night, '2026-09-11')).toBe(true);
    expect(rehearsalOnDate(night, '2026-09-12')).toBe(false);
    expect(rehearsalDates(night)).toEqual(['2026-09-10', '2026-09-11']);
  });

  it('says which day it ends on, and only when that is another day', () => {
    expect(rehearsalTimeLabel(night, 'en-US')).toBe('23:00 — Sep 11, 01:00');
    const evening = rehearsalInZone(
      { id: 'e', startsAt: '2026-09-10T18:00:00Z', endsAt: '2026-09-10T21:00:00Z' },
      'UTC'
    );
    expect(rehearsalTimeLabel(evening, 'en-US')).toBe('18:00 — 21:00');
  });
});

describe('the conflict check of a rehearsal past midnight', () => {
  const member = { userId: 'u1', firstName: 'Nina' } as any;

  it('finds busy time on the evening and on the next morning', () => {
    const evening = checkSchedulingConflicts([member],
      { u1: { timeRanges: [{ start: '23:30', end: '23:59', type: 'busy' }] } }, '23:00', '01:00');
    expect(evening.hasConflicts).toBe(true);

    const morning = checkSchedulingConflicts([member],
      { u1: { timeRanges: [], nextDayRanges: [{ start: '00:00', end: '00:30', type: 'busy' }] } }, '23:00', '01:00');
    expect(morning.hasConflicts).toBe(true);
  });

  it('a morning busy after the end is no conflict, nor the next day for a same-day rehearsal', () => {
    const later = checkSchedulingConflicts([member],
      { u1: { timeRanges: [], nextDayRanges: [{ start: '01:00', end: '03:00', type: 'busy' }] } }, '23:00', '01:00');
    expect(later.hasConflicts).toBe(false);

    const sameDay = checkSchedulingConflicts([member],
      { u1: { timeRanges: [{ start: '10:00', end: '12:00', type: 'busy' }] } }, '12:00', '14:00');
    expect(sameDay.hasConflicts).toBe(false);
  });
});
