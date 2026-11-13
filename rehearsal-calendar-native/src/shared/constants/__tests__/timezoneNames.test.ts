/**
 * The picker's cities in the language of the interface (T-257). Only Russian
 * had its own names: Spanish and German read the English ones, and their
 * search did not find "Moskau", "Wien" or "Moscú". A phone's zone outside the
 * list read its English IANA name in Russian too ("Samara", "Minsk"). There
 * was not one Spanish-speaking city in the list, and a phone that names Kyiv
 * by its new IANA name, Europe/Kyiv, saw the city twice: the list has it as
 * Europe/Kiev, an alias of the same zone.
 */
import { getTimezoneLabel, getTimezonesWithDevice, searchTimezones } from '../timezones';

const JULY = new Date('2026-07-15T12:00:00Z');
const JANUARY = new Date('2026-01-15T12:00:00Z');

// The phone's zone, as Intl reports it to a formatter made without a zone.
// date-fns-tz's formatters, made with one, stay real: it keeps them.
const RealDateTimeFormat = Intl.DateTimeFormat;
function phoneIn(zone: string) {
  (Intl as any).DateTimeFormat = function (locale?: any, options?: Intl.DateTimeFormatOptions) {
    const real = new RealDateTimeFormat(locale, options);
    if (options?.timeZone) return real;
    const resolved = real.resolvedOptions();
    real.resolvedOptions = () => ({ ...resolved, timeZone: zone });
    return real;
  };
  (Intl.DateTimeFormat as any).supportedLocalesOf = RealDateTimeFormat.supportedLocalesOf;
}
afterEach(() => { (Intl as any).DateTimeFormat = RealDateTimeFormat; });

const cities = (language: string, at: Date = JULY) =>
  getTimezonesWithDevice(language as any, at).map((option) => option.label);

describe('a city is named in the language of the interface', () => {
  it.each([
    ['Europe/Moscow', 'en', 'Moscow (UTC+3)'],
    ['Europe/Moscow', 'ru', 'Москва (UTC+3)'],
    ['Europe/Moscow', 'es', 'Moscú (UTC+3)'],
    ['Europe/Moscow', 'de', 'Moskau (UTC+3)'],
    ['America/New_York', 'es', 'Nueva York (UTC-4)'],
    ['Europe/London', 'es', 'Londres (UTC+1)'],
    ['Asia/Kolkata', 'es', 'Bombay (UTC+5:30)'],
    ['Africa/Cairo', 'de', 'Kairo (UTC+3)'],
    ['Asia/Yekaterinburg', 'de', 'Jekaterinburg (UTC+5)'],
    ['Asia/Tokyo', 'de', 'Tokio (UTC+9)'],
  ])('%s in %s reads %s', (zone, language, label) => {
    expect(getTimezoneLabel(zone, language, JULY)).toBe(label);
  });

  it('names Kyiv as each language writes it', () => {
    expect(getTimezoneLabel('Europe/Kiev', 'en', JULY)).toBe('Kyiv (UTC+3)');
    expect(getTimezoneLabel('Europe/Kiev', 'es', JULY)).toBe('Kiev (UTC+3)');
    expect(getTimezoneLabel('Europe/Kiev', 'de', JULY)).toBe('Kiew (UTC+3)');
    expect(getTimezoneLabel('Europe/Kiev', 'ru', JULY)).toBe('Киев (UTC+3)');
  });

  it('lists the cities in the language of the interface', () => {
    expect(cities('de')).toEqual(expect.arrayContaining(['Moskau (UTC+3)', 'Singapur (UTC+8)']));
    expect(cities('es')).toEqual(expect.arrayContaining(['Moscú (UTC+3)', 'Estambul (UTC+3)']));
    expect(cities('ru')).toEqual(expect.arrayContaining(['Москва (UTC+3)', 'Токио (UTC+9)']));
    expect(cities('en')).toEqual(expect.arrayContaining(['Moscow (UTC+3)', 'Tokyo (UTC+9)']));
  });
});

describe('the list has Spanish-speaking cities, Vienna and Zurich', () => {
  it.each([
    ['Europe/Madrid', 'Madrid (UTC+2)', 'Мадрид (UTC+2)', 'Madrid (UTC+2)', 'Madrid (UTC+2)'],
    ['America/Mexico_City', 'Mexico City (UTC-6)', 'Мехико (UTC-6)', 'Ciudad de México (UTC-6)', 'Mexiko-Stadt (UTC-6)'],
    ['America/Bogota', 'Bogotá (UTC-5)', 'Богота (UTC-5)', 'Bogotá (UTC-5)', 'Bogotá (UTC-5)'],
    ['America/Argentina/Buenos_Aires', 'Buenos Aires (UTC-3)', 'Буэнос-Айрес (UTC-3)', 'Buenos Aires (UTC-3)', 'Buenos Aires (UTC-3)'],
    ['Europe/Vienna', 'Vienna (UTC+2)', 'Вена (UTC+2)', 'Viena (UTC+2)', 'Wien (UTC+2)'],
    ['Europe/Zurich', 'Zurich (UTC+2)', 'Цюрих (UTC+2)', 'Zúrich (UTC+2)', 'Zürich (UTC+2)'],
  ])('%s', (zone, en, ru, es, de) => {
    phoneIn('Pacific/Honolulu');
    expect(cities('en')).toContain(en);
    expect(cities('ru')).toContain(ru);
    expect(cities('es')).toContain(es);
    expect(cities('de')).toContain(de);
    expect(getTimezonesWithDevice('en' as any, JULY).some((option) => option.value === zone)).toBe(true);
  });
});

describe('the search finds a city by its name in the interface language and in English', () => {
  const found = (language: string, query: string) =>
    searchTimezones(getTimezonesWithDevice(language as any, JULY), query).map((option) => option.value);

  it.each([
    ['de', 'moskau', 'Europe/Moscow'],
    ['de', 'Wien', 'Europe/Vienna'],
    ['de', 'zürich', 'Europe/Zurich'],
    ['de', 'kiew', 'Europe/Kiev'],
    ['es', 'Moscú', 'Europe/Moscow'],
    ['es', 'nueva york', 'America/New_York'],
    ['es', 'Ciudad de México', 'America/Mexico_City'],
    ['es', 'londres', 'Europe/London'],
    ['ru', 'москва', 'Europe/Moscow'],
    ['ru', 'Вена', 'Europe/Vienna'],
    // English everywhere: "Cairo" and "Mumbai" find theirs in Spanish too.
    ['es', 'cairo', 'Africa/Cairo'],
    ['es', 'mumbai', 'Asia/Kolkata'],
    ['de', 'moscow', 'Europe/Moscow'],
    ['ru', 'moscow', 'Europe/Moscow'],
  ])('in %s, "%s" finds %s', (language, query, zone) => {
    expect(found(language, query)).toContain(zone);
  });
});

describe("a phone's zone outside the list", () => {
  it('takes its name from the tables of likely zones', () => {
    expect(getTimezoneLabel('Europe/Samara', 'ru', JULY)).toBe('Самара (UTC+4)');
    expect(getTimezoneLabel('Europe/Minsk', 'ru', JULY)).toBe('Минск (UTC+3)');
    expect(getTimezoneLabel('Asia/Almaty', 'ru', JULY)).toMatch(/^Алматы \(UTC\+[56]\)$/);
    expect(getTimezoneLabel('America/Havana', 'es', JANUARY)).toBe('La Habana (UTC-5)');
    expect(getTimezoneLabel('Atlantic/Canary', 'es', JANUARY)).toBe('Canarias (UTC+0)');
    expect(getTimezoneLabel('Europe/Prague', 'de', JANUARY)).toBe('Prag (UTC+1)');
  });

  it('keeps its English IANA name where no table has it', () => {
    expect(getTimezoneLabel('Europe/Samara', 'en', JULY)).toBe('Samara (UTC+4)');
    expect(getTimezoneLabel('America/Havana', 'en', JANUARY)).toBe('Havana (UTC-5)');
    expect(getTimezoneLabel('Pacific/Honolulu', 'de', JULY)).toBe('Honolulu (UTC-10)');
    expect(getTimezoneLabel('Europe/Prague', 'es', JANUARY)).toBe('Prague (UTC+1)');
  });

  it('is listed first, in the language of the interface, and found by that name', () => {
    phoneIn('Europe/Samara');
    const russian = getTimezonesWithDevice('ru' as any, JULY);
    expect(russian[0]).toMatchObject({ value: 'Europe/Samara', label: 'Самара (UTC+4)' });
    expect(searchTimezones(russian, 'самара').map((option) => option.value)).toEqual(['Europe/Samara']);
    expect(searchTimezones(russian, 'samara').map((option) => option.value)).toEqual(['Europe/Samara']);
  });
});

// Europe/Kyiv is the zone's name since tzdata 2022b; Europe/Kiev, the one the
// list has, is now an alias of it. A phone with the newer name was not found
// in the list, so its zone was put in front of it: Kyiv twice.
describe('Kyiv, whichever name of the zone the phone has', () => {
  const kyivRows = (language: string) =>
    getTimezonesWithDevice(language as any, JULY)
      .filter((option) => /^(Kyiv|Kiev|Kiew|Киев)\b/.test(option.labelEn));

  it.each(['Europe/Kyiv', 'Europe/Kiev'])('a phone in %s sees Kyiv once', (zone) => {
    phoneIn(zone);
    expect(kyivRows('en')).toHaveLength(1);
    expect(kyivRows('de')).toHaveLength(1);
  });

  it('names Europe/Kyiv as the list names Kyiv', () => {
    expect(getTimezoneLabel('Europe/Kyiv', 'en', JULY)).toBe('Kyiv (UTC+3)');
    expect(getTimezoneLabel('Europe/Kyiv', 'es', JULY)).toBe('Kiev (UTC+3)');
    expect(getTimezoneLabel('Europe/Kyiv', 'de', JULY)).toBe('Kiew (UTC+3)');
    expect(getTimezoneLabel('Europe/Kyiv', 'ru', JULY)).toBe('Киев (UTC+3)');
  });

  it('Buenos Aires under its older name, America/Buenos_Aires, is listed once too', () => {
    phoneIn('America/Buenos_Aires');
    expect(getTimezonesWithDevice('es' as any, JULY)
      .filter((option) => option.labelEn.startsWith('Buenos Aires'))).toHaveLength(1);
  });
});
