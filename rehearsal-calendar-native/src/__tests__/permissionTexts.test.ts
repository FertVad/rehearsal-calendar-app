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

  it('declares the reminder descriptions, which the app never asks for', () => {
    expect(declared).toEqual(expect.arrayContaining([
      'NSRemindersFullAccessUsageDescription',
      'NSRemindersUsageDescription',
    ]));
  });

  // app.json is not what the build gets. expo-calendar is one of the legacy
  // plugins @expo/prebuild-config applies on its own even when `plugins` does
  // not list it: with no options it keeps the texts app.json gives, and with
  // `remindersPermission: false` it deletes both NSReminders* keys. What lands
  // in Info.plist is app.json after that plugin.
  //
  // The reminder keys must land even though the app never asks for reminders.
  // expo-calendar's native module reads the reminders permission when it is
  // created (CalendarModule OnCreate → initializePermittedEntities →
  // RemindersPermissionRequester.getPermissions), and without the key it calls
  // EXFatal. In a Release build that stopped the other Expo modules from
  // registering: the JavaScript found no ExpoPushTokenManager, and TestFlight
  // build 1.0.0 (1) opened on a black screen (07.11.2026). No e2e flow saw it,
  // because the e2e build's ios/ was not regenerated after T-040.
  it('the infoPlist after the expo-calendar plugin has the calendar and reminder texts', async () => {
    const entry = (appJson.expo.plugins ?? []).find((p: unknown) =>
      (Array.isArray(p) ? p[0] : p) === 'expo-calendar');
    const options = Array.isArray(entry) ? entry[1] : undefined;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const withCalendar = require(path.join(root, 'node_modules/expo-calendar/app.plugin.js'));
    const plugin = withCalendar.default ?? withCalendar;
    const config = plugin(JSON.parse(JSON.stringify(appJson.expo)), options);
    const result = await config.mods.ios.infoPlist({
      ...config,
      modResults: { ...appJson.expo.ios.infoPlist },
      modRequest: { platform: 'ios', modName: 'infoPlist', projectRoot: root, platformProjectRoot: path.join(root, 'ios'), introspect: true },
    });
    const infoPlist = result.modResults;

    const en = localeIos('en');
    const keys = Object.keys(infoPlist).filter((k) => /^NS(Calendars|Reminders)/.test(k)).sort();
    expect(keys).toEqual([
      'NSCalendarsFullAccessUsageDescription',
      'NSCalendarsUsageDescription',
      'NSCalendarsWriteOnlyAccessUsageDescription',
      'NSRemindersFullAccessUsageDescription',
      'NSRemindersUsageDescription',
    ]);
    for (const key of keys) expect(infoPlist[key]).toBe(en[key]);
  });

  it('each language words it its own way', () => {
    for (const key of declared) {
      const texts = LANGUAGES.map((lang) => localeIos(lang)[key]);
      expect(new Set(texts).size).toBe(LANGUAGES.length);
    }
  });
});
