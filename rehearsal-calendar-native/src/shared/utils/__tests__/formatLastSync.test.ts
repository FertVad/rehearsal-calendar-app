/**
 * How long ago the last sync was, inside a sentence and on its own (T-239).
 *
 * The sync screen said "Synced Just now", «Синхронизировано Только что»,
 * "Sincronizado Ahora mismo", "Synchronisiert Gerade eben": the words were
 * written with a capital, as they stand alone over the availability's month,
 * and `syncedAgo` put them in the middle of its sentence. Now the
 * translations hold the words as they are inside a sentence, and only a
 * `when` that stands alone begins with a capital.
 */
import { translations, type Language } from '../../../i18n/translations';
import { formatLastSync } from '../formatLastSync';

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60 * 1000;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

const synced = (language: Language, when: string) =>
  translations[language].calendarSync.syncedAgo(
    formatLastSync(when, translations[language], 'inSentence'));
const alone = (language: Language, when: string) =>
  formatLastSync(when, translations[language], 'alone');

describe('"just now" inside the sync screen\'s sentence', () => {
  it.each([
    ['ru', 'Синхронизировано только что'],
    ['en', 'Synced just now'],
    ['es', 'Sincronizado ahora mismo'],
    ['de', 'Synchronisiert gerade eben'],
  ] as const)('%s: %s', (language, expected) => {
    expect(synced(language, ago(10 * 1000))).toBe(expected);
  });
});

describe('minutes, hours and days inside the sentence, as each language writes them', () => {
  it.each([
    ['ru', 'Синхронизировано 5 мин назад', 'Синхронизировано 3ч назад', 'Синхронизировано 2д назад'],
    ['en', 'Synced 5 min ago', 'Synced 3h ago', 'Synced 2d ago'],
    ['es', 'Sincronizado hace 5 min', 'Sincronizado hace 3 h', 'Sincronizado hace 2 d'],
    // Nouns keep their capital in German, abbreviated too.
    ['de', 'Synchronisiert vor 5 Min', 'Synchronisiert vor 3 Std', 'Synchronisiert vor 2 T'],
  ] as const)('%s', (language, minutes, hours, days) => {
    expect(synced(language, ago(5 * MINUTE))).toBe(minutes);
    expect(synced(language, ago(3 * 60 * MINUTE))).toBe(hours);
    expect(synced(language, ago(2 * 24 * 60 * MINUTE))).toBe(days);
  });
});

describe('on its own, over the availability\'s month, it begins with a capital', () => {
  it.each([
    ['ru', 'Только что', '5 мин назад'],
    ['en', 'Just now', '5 min ago'],
    ['es', 'Ahora mismo', 'Hace 5 min'],
    ['de', 'Gerade eben', 'Vor 5 Min'],
  ] as const)('%s', (language, now, minutes) => {
    expect(alone(language, ago(10 * 1000))).toBe(now);
    expect(alone(language, ago(5 * MINUTE))).toBe(minutes);
  });

  it('says nothing when there has been no sync', () => {
    expect(alone('en', '')).toBe('');
    expect(formatLastSync(null, translations.en, 'inSentence')).toBe('');
  });
});
