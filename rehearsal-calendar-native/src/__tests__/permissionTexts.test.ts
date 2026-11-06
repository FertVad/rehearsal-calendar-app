/**
 * The texts of iOS permission prompts (T-040).
 *
 * iOS shows the prompt in the phone's language only if the build carries the
 * text for it: Expo writes `expo.locales[lang].ios` into <lang>.lproj/
 * InfoPlist.strings, and falls back to the English `ios.infoPlist` value.
 * Every usage description the app declares needs a text in every language the
 * app speaks, and a locale file has nothing the app does not declare.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const LANGUAGES = ['en', 'ru', 'es', 'de'];

const isUsageDescription = (key: string) => /^NS\w+UsageDescription$/.test(key);
const declared = Object.keys(appJson.expo.ios.infoPlist).filter(isUsageDescription).sort();

function localeIos(lang: string): Record<string, string> {
  const file = appJson.expo.locales?.[lang];
  if (typeof file !== 'string') throw new Error(`expo.locales.${lang} is not set in app.json`);
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).ios ?? {};
}

describe('iOS permission prompt texts', () => {
  it('declares the calendar descriptions', () => {
    expect(declared).toEqual(expect.arrayContaining([
      'NSCalendarsFullAccessUsageDescription',
      'NSCalendarsUsageDescription',
      'NSCalendarsWriteOnlyAccessUsageDescription',
    ]));
  });

  it.each(LANGUAGES)('%s has a text for every declared description and nothing else', (lang) => {
    const texts = localeIos(lang);
    const described = Object.keys(texts).filter(isUsageDescription).sort();
    expect(described).toEqual(declared);
    for (const key of described) {
      expect(typeof texts[key]).toBe('string');
      expect(texts[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('the English locale says what the infoPlist fallback says', () => {
    const en = localeIos('en');
    for (const key of declared) expect(appJson.expo.ios.infoPlist[key]).toBe(en[key]);
  });

  it('each language words it its own way', () => {
    for (const key of declared) {
      const texts = LANGUAGES.map((lang) => localeIos(lang)[key]);
      expect(new Set(texts).size).toBe(LANGUAGES.length);
    }
  });
});
