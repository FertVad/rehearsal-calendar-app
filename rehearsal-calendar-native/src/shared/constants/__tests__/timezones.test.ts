/**
 * The timezone picker's offsets (T-011). Honolulu, the simulator's zone and so
 * the picker's first row, read "Honolulu (UTC)": the offset came from Intl's
 * timeZoneName 'shortOffset', which Hermes answers with a bare "GMT". And the
 * curated rows had their offsets written out, standard time all year: New York
 * read UTC-5 through the summer it is UTC-4. Every offset is now worked out for
 * the moment it is shown.
 */
import { getTimezoneLabel, getTimezonesWithDevice } from '../timezones';

// Intl as Hermes has it: no offset in a 'shortOffset' zone name.
const RealDateTimeFormat = Intl.DateTimeFormat;
beforeAll(() => {
  (Intl as any).DateTimeFormat = function (locale?: any, options?: Intl.DateTimeFormatOptions) {
    const real = new RealDateTimeFormat(locale, options);
    if ((options as any)?.timeZoneName !== 'shortOffset') return real;
    return Object.assign(Object.create(real), {
      formatToParts: (date?: Date) => real.formatToParts(date)
        .map((part) => (part.type === 'timeZoneName' ? { ...part, value: 'GMT' } : part)),
    });
  };
  (Intl.DateTimeFormat as any).supportedLocalesOf = RealDateTimeFormat.supportedLocalesOf;
});
afterAll(() => { (Intl as any).DateTimeFormat = RealDateTimeFormat; });

const JULY = new Date('2026-07-15T12:00:00Z');
const JANUARY = new Date('2026-01-15T12:00:00Z');

it('names Honolulu ten hours behind UTC, not UTC', () => {
  expect(getTimezoneLabel('Pacific/Honolulu', 'en', JULY)).toBe('Honolulu (UTC-10)');
});

it('gives a zone with summer time the offset it has on the day', () => {
  expect(getTimezoneLabel('America/New_York', 'en', JANUARY)).toBe('New York (UTC-5)');
  expect(getTimezoneLabel('America/New_York', 'en', JULY)).toBe('New York (UTC-4)');
  expect(getTimezoneLabel('Europe/Berlin', 'ru', JULY)).toBe('Берлин (UTC+2)');
  expect(getTimezoneLabel('Australia/Sydney', 'en', JULY)).toBe('Sydney (UTC+10)');
  expect(getTimezoneLabel('Australia/Sydney', 'en', JANUARY)).toBe('Sydney (UTC+11)');
});

it('writes half hours and zero as offsets too', () => {
  expect(getTimezoneLabel('Asia/Kolkata', 'en', JULY)).toBe('Mumbai (UTC+5:30)');
  expect(getTimezoneLabel('Europe/London', 'en', JANUARY)).toBe('London (UTC+0)');
});

// `at` is a moment, not a wall clock (T-011 review). getTimezoneOffset read
// the moment's fields in the device's zone (New York here, jest.config.js) as
// the wall clock of the zone asked about, so an hour either side of a change
// the label was the other side's.
it('gives the offset in force at the moment, either side of a change of clocks', () => {
  // Berlin goes back at 01:00 UTC on 25 October 2026.
  expect(getTimezoneLabel('Europe/Berlin', 'en', new Date('2026-10-25T00:30:00Z'))).toBe('Berlin (UTC+2)');
  expect(getTimezoneLabel('Europe/Berlin', 'en', new Date('2026-10-25T01:30:00Z'))).toBe('Berlin (UTC+1)');
  // Sydney goes forward at 16:00 UTC on 3 October 2026.
  expect(getTimezoneLabel('Australia/Sydney', 'en', new Date('2026-10-03T15:30:00Z'))).toBe('Sydney (UTC+10)');
  expect(getTimezoneLabel('Australia/Sydney', 'en', new Date('2026-10-03T16:30:00Z'))).toBe('Sydney (UTC+11)');
  // New York goes back at 06:00 UTC on 1 November 2026: 01:30 comes twice.
  expect(getTimezoneLabel('America/New_York', 'en', new Date('2026-11-01T03:00:00Z'))).toBe('New York (UTC-4)');
  expect(getTimezoneLabel('America/New_York', 'en', new Date('2026-11-01T05:30:00Z'))).toBe('New York (UTC-4)');
  expect(getTimezoneLabel('America/New_York', 'en', new Date('2026-11-01T06:30:00Z'))).toBe('New York (UTC-5)');
});

it('lists every zone with the offset of the moment it is asked', () => {
  const july = getTimezonesWithDevice(JULY);
  expect(july.find((z) => z.value === 'America/New_York')?.labelEn).toBe('New York (UTC-4)');
  expect(july.find((z) => z.value === 'Asia/Jerusalem')?.labelRu).toBe('Тель-Авив (UTC+3)');
  const january = getTimezonesWithDevice(JANUARY);
  expect(january.find((z) => z.value === 'Asia/Jerusalem')?.labelEn).toBe('Tel Aviv (UTC+2)');
});
