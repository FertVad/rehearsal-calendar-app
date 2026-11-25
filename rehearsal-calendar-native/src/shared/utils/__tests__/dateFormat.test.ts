/**
 * One module of date formats (T-028, owner's decision 02.11.2026): the form
 * is Intl's for the app's language, the first letter is a capital and the
 * rest is as Intl writes it. Screens take their dates only from
 * shared/utils/dateFormat.ts.
 */
import fs from 'fs';
import path from 'path';
import { DateFormatName, formatDate, formatDateRange } from '../dateFormat';

// Thursday, 29 October 2026.
const DAY = '2026-10-29';

const EXPECTED: Record<DateFormatName, Record<'ru' | 'en' | 'es' | 'de', string>> = {
  monthYear: {
    ru: 'Октябрь 2026 г.', en: 'October 2026', es: 'Octubre de 2026', de: 'Oktober 2026',
  },
  dayMonth: {
    ru: '29 октября', en: 'October 29', es: '29 de octubre', de: '29. Oktober',
  },
  dayMonthShort: {
    ru: '29 окт.', en: 'Oct 29', es: '29 oct', de: '29. Okt.',
  },
  dayMonthYear: {
    ru: '29 октября 2026 г.', en: 'October 29, 2026', es: '29 de octubre de 2026', de: '29. Oktober 2026',
  },
  weekdayDayMonth: {
    ru: 'Четверг, 29 октября', en: 'Thursday, October 29', es: 'Jueves, 29 de octubre', de: 'Donnerstag, 29. Oktober',
  },
  weekdayDayMonthShort: {
    ru: 'Чт, 29 окт.', en: 'Thu, Oct 29', es: 'Jue, 29 oct', de: 'Do., 29. Okt.',
  },
  weekdayShort: {
    ru: 'Чт', en: 'Thu', es: 'Jue', de: 'Do',
  },
  fullDate: {
    ru: 'Четверг, 29 октября 2026 г.',
    en: 'Thursday, October 29, 2026',
    es: 'Jueves, 29 de octubre de 2026',
    de: 'Donnerstag, 29. Oktober 2026',
  },
};

// EXPECTED is a Record over DateFormatName: a format missing here does not compile.
describe.each(Object.keys(EXPECTED) as DateFormatName[])('%s', (format) => {
  it.each(['ru', 'en', 'es', 'de'] as const)('in %s', (language) => {
    expect(formatDate(DAY, format, language)).toBe(EXPECTED[format][language]);
  });
});

it('reads a Date by its local fields, as a string by its calendar date', () => {
  expect(formatDate(new Date(2026, 10, 1), 'monthYear', 'ru')).toBe('Ноябрь 2026 г.');
  // jest.config.js runs in New York: the string is not read as UTC midnight.
  expect(formatDate('2026-11-01', 'dayMonth', 'en')).toBe('November 1');
});

it('inside a sentence a date is written by the language\'s rule', () => {
  expect(formatDate(DAY, 'weekdayDayMonthShort', 'ru', { midSentence: true })).toBe('чт, 29 окт.');
  expect(formatDate(DAY, 'weekdayDayMonthShort', 'en', { midSentence: true })).toBe('Thu, Oct 29');
});

// T-408: iOS's Foundation (ru_RU, pattern EEE) gives a day of the week alone
// in its standalone form, with a capital — "Пт" — where Node gives "пт", so
// "(Пт и Сб)" and "Ваши выходные: Пт и Сб" stood inside sentences on the
// phone and Jest could not see it. Here Intl answers as iOS does.
describe('inside a sentence, whatever case Intl gives (T-408)', () => {
  const IOS: Record<string, string> = { 'ru-RU': 'Пт', 'es-ES': 'Vie', 'en-US': 'Fri', 'de-DE': 'Fr' };
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function mock(locale) {
      return IOS[String(locale)];
    });
  });
  afterEach(() => spy.mockRestore());

  it('Russian and Spanish write the day in lower case, English and German as Intl does', () => {
    expect(formatDate('2026-01-09', 'weekdayShort', 'ru', { midSentence: true })).toBe('пт');
    expect(formatDate('2026-01-09', 'weekdayShort', 'es', { midSentence: true })).toBe('vie');
    expect(formatDate('2026-01-09', 'weekdayShort', 'en', { midSentence: true })).toBe('Fri');
    expect(formatDate('2026-01-09', 'weekdayShort', 'de', { midSentence: true })).toBe('Fr');
  });

  it('on its own, as a column\'s head, the day keeps its capital', () => {
    expect(formatDate('2026-01-09', 'weekdayShort', 'ru')).toBe('Пт');
  });
});

it('an interval of dates is the two short dates joined by a spaced en dash', () => {
  expect(formatDateRange('2026-10-29', '2026-11-04', 'ru')).toBe('29 окт. – 4 нояб.');
  expect(formatDateRange('2026-10-29', '2026-11-04', 'en')).toBe('Oct 29 – Nov 4');
  expect(formatDateRange('2026-10-29', '2026-11-04', 'es')).toBe('29 oct – 4 nov');
  expect(formatDateRange('2026-10-29', '2026-11-04', 'de')).toBe('29. Okt. – 4. Nov.');
});

it('a language the app does not have is written in English', () => {
  expect(formatDate(DAY, 'dayMonthShort', 'fr')).toBe('Oct 29');
});

// ---------------------------------------------------------------------------
// The rule: a screen asks this module for a date, never Intl itself.
// ---------------------------------------------------------------------------

const SRC = path.resolve(__dirname, '../../..');
const MODULE = path.join('shared', 'utils', 'dateFormat.ts');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

it('nothing but the module formats a date with Intl', () => {
  // A date's text: toLocaleDateString, toLocaleString, or a DateTimeFormat
  // given a locale or options. Intl.DateTimeFormat() alone only reads the
  // device's zone; toLocaleTimeString is a time (clockFormat.ts).
  const call = /\.toLocaleDateString\(|\.toLocaleString\(|Intl\.DateTimeFormat\(\s*[^)\s]/;
  const offenders = sources(SRC)
    .filter((file) => path.relative(SRC, file) !== MODULE)
    .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n')
      .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
      .filter(({ line }) => call.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .map(({ at }) => at));

  expect(offenders).toEqual([]);
});
