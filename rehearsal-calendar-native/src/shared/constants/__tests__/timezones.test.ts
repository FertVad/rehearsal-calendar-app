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

it('lists every zone with the offset of the moment it is asked', () => {
  const july = getTimezonesWithDevice(JULY);
  expect(july.find((z) => z.value === 'America/New_York')?.labelEn).toBe('New York (UTC-4)');
  expect(july.find((z) => z.value === 'Asia/Jerusalem')?.labelRu).toBe('Тель-Авив (UTC+3)');
  const january = getTimezonesWithDevice(JANUARY);
  expect(january.find((z) => z.value === 'Asia/Jerusalem')?.labelEn).toBe('Tel Aviv (UTC+2)');
});
