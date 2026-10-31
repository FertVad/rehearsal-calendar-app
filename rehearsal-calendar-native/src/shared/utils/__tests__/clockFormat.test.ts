/**
 * T-017: times on the screens follow the phone's 12/24-hour setting, and an
 * interval is written one way — "18:00–21:00", "29 Oct – 4 Nov".
 *
 * Every time was "HH:MM" whatever the phone said, and the screens joined two
 * ends with "-", " — " or " - ". 12-hour times carry the narrow space ICU puts
 * before AM/PM, hence the \s.
 */
import { getCalendars } from 'expo-localization';
import {
  formatClock,
  formatDateRange,
  formatTimeRange,
  phoneUses24HourClock,
  timePickerLocale,
} from '../clockFormat';
import { rehearsalInZone, rehearsalTimeLabel } from '../rehearsalDays';

const phoneOn = (uses24hourClock: boolean) =>
  (getCalendars as jest.Mock).mockReturnValue([{ uses24hourClock }]);

const night = rehearsalInZone(
  { id: 'n', startsAt: '2026-09-10T23:00:00Z', endsAt: '2026-09-11T01:00:00Z' },
  'UTC'
);
const evening = rehearsalInZone(
  { id: 'e', startsAt: '2026-09-10T18:00:00Z', endsAt: '2026-09-10T21:00:00Z' },
  'UTC'
);

afterEach(() => phoneOn(true));

describe('a phone on the 24-hour clock', () => {
  beforeEach(() => phoneOn(true));

  it('reads the setting from the phone', () => {
    expect(phoneUses24HourClock()).toBe(true);
  });

  it('shows a stored time as it is, seconds dropped, in any language', () => {
    expect(formatClock('18:00', 'en-US')).toBe('18:00');
    expect(formatClock('09:05:00', 'ru-RU')).toBe('09:05');
    expect(formatClock('10:07', 'en-US')).toBe('10:07');
  });

  it('writes a time interval with an en dash and no spaces, past midnight too', () => {
    expect(formatTimeRange('18:00', '21:00', 'en-US')).toBe('18:00–21:00');
    expect(formatTimeRange('23:00', '01:00', 'ru-RU')).toBe('23:00–01:00');
  });

  it('gives a rehearsal its interval, and the end its date when it is another day', () => {
    expect(rehearsalTimeLabel(evening, 'en-US')).toBe('18:00–21:00');
    expect(rehearsalTimeLabel(night, 'en-US')).toBe('23:00 – Sep 11, 01:00');
  });

  it('gives the wheel the app\'s language with a 24-hour cycle', () => {
    expect(timePickerLocale('en')).toBe('en@hours=h23');
    expect(timePickerLocale('ru')).toBe('ru@hours=h23');
  });
});

describe('a phone on the 12-hour clock', () => {
  beforeEach(() => phoneOn(false));

  it('reads the setting from the phone', () => {
    expect(phoneUses24HourClock()).toBe(false);
  });

  it('shows hours with AM and PM, midnight and noon as 12', () => {
    expect(formatClock('18:00', 'en-US')).toMatch(/^6:00\sPM$/);
    expect(formatClock('00:30', 'en-US')).toMatch(/^12:30\sAM$/);
    expect(formatClock('12:00', 'en-US')).toMatch(/^12:00\sPM$/);
    expect(formatClock('10:07', 'en-US')).toMatch(/^10:07\sAM$/);
  });

  it('writes an interval past midnight the same way', () => {
    expect(formatTimeRange('23:00', '01:00', 'en-US')).toMatch(/^11:00\sPM–1:00\sAM$/);
    expect(rehearsalTimeLabel(night, 'en-US')).toMatch(/^11:00\sPM – Sep 11, 1:00\sAM$/);
    expect(rehearsalTimeLabel(evening, 'en-US')).toMatch(/^6:00\sPM–9:00\sPM$/);
  });

  it('gives the wheel the app\'s language with a 12-hour cycle', () => {
    expect(timePickerLocale('ru')).toBe('ru@hours=h12');
  });
});

describe('a date interval', () => {
  it('is an en dash with spaces, each end in the language\'s own order', () => {
    expect(formatDateRange('2026-10-29', '2026-11-04', 'en-US')).toBe('Oct 29 – Nov 4');
    expect(formatDateRange('2026-10-29', '2026-11-04', 'ru-RU')).toBe('29 окт. – 4 нояб.');
  });
});
