import { formatInTimeZone } from 'date-fns-tz';
import type { Language } from '../../i18n/translations';

/**
 * Common timezones presented to users when picking project/user timezone.
 * Curated for global theatre/rehearsal app use — balanced across regions,
 * not region-specific.
 *
 * Only the cities are written here. A zone's offset is worked out for the
 * moment it is shown (T-011): written out, it was standard time all year, and
 * New York read UTC-5 through the summer it is UTC-4.
 *
 * Each city is named in every language of the interface (T-257), as the
 * native readers of T-256 wrote them: Spanish and German read the English
 * names before, and their search found neither "Moskau" nor "Moscú".
 */
export interface TimezoneOption {
  value: string;   // IANA timezone identifier
  label: string;   // the city in the language of the interface, with its offset
  labelEn: string; // the same in English, which the search finds too
}

type CityNames = Record<Language, string>;

interface CuratedZone {
  value: string;
  city: CityNames;
}

const CURATED: CuratedZone[] = [
  // Americas
  { value: 'America/Los_Angeles', city: { en: 'Los Angeles', ru: 'Лос-Анджелес', es: 'Los Ángeles', de: 'Los Angeles' } },
  { value: 'America/Denver', city: { en: 'Denver', ru: 'Денвер', es: 'Denver', de: 'Denver' } },
  { value: 'America/Chicago', city: { en: 'Chicago', ru: 'Чикаго', es: 'Chicago', de: 'Chicago' } },
  { value: 'America/Mexico_City', city: { en: 'Mexico City', ru: 'Мехико', es: 'Ciudad de México', de: 'Mexiko-Stadt' } },
  { value: 'America/New_York', city: { en: 'New York', ru: 'Нью-Йорк', es: 'Nueva York', de: 'New York' } },
  { value: 'America/Bogota', city: { en: 'Bogotá', ru: 'Богота', es: 'Bogotá', de: 'Bogotá' } },
  { value: 'America/Sao_Paulo', city: { en: 'São Paulo', ru: 'Сан-Паулу', es: 'São Paulo', de: 'São Paulo' } },
  { value: 'America/Argentina/Buenos_Aires', city: { en: 'Buenos Aires', ru: 'Буэнос-Айрес', es: 'Buenos Aires', de: 'Buenos Aires' } },

  // Europe
  { value: 'Europe/London', city: { en: 'London', ru: 'Лондон', es: 'Londres', de: 'London' } },
  { value: 'Europe/Madrid', city: { en: 'Madrid', ru: 'Мадрид', es: 'Madrid', de: 'Madrid' } },
  { value: 'Europe/Berlin', city: { en: 'Berlin', ru: 'Берлин', es: 'Berlín', de: 'Berlin' } },
  { value: 'Europe/Zurich', city: { en: 'Zurich', ru: 'Цюрих', es: 'Zúrich', de: 'Zürich' } },
  { value: 'Europe/Vienna', city: { en: 'Vienna', ru: 'Вена', es: 'Viena', de: 'Wien' } },
  // Each language's own norm: Kyiv in English, Kiev in Spanish (FundéuRAE),
  // Kiew in German, Киев in Russian (the owner's decision, 13.11.2026).
  { value: 'Europe/Kiev', city: { en: 'Kyiv', ru: 'Киев', es: 'Kiev', de: 'Kiew' } },
  { value: 'Europe/Istanbul', city: { en: 'Istanbul', ru: 'Стамбул', es: 'Estambul', de: 'Istanbul' } },
  { value: 'Europe/Moscow', city: { en: 'Moscow', ru: 'Москва', es: 'Moscú', de: 'Moskau' } },

  // Middle East & Africa
  { value: 'Africa/Cairo', city: { en: 'Cairo', ru: 'Каир', es: 'El Cairo', de: 'Kairo' } },
  { value: 'Asia/Jerusalem', city: { en: 'Tel Aviv', ru: 'Тель-Авив', es: 'Tel Aviv', de: 'Tel Aviv' } },
  { value: 'Asia/Dubai', city: { en: 'Dubai', ru: 'Дубай', es: 'Dubái', de: 'Dubai' } },

  // Asia
  { value: 'Asia/Yekaterinburg', city: { en: 'Yekaterinburg', ru: 'Екатеринбург', es: 'Ekaterimburgo', de: 'Jekaterinburg' } },
  { value: 'Asia/Kolkata', city: { en: 'Mumbai', ru: 'Мумбаи', es: 'Bombay', de: 'Mumbai' } },
  { value: 'Asia/Bangkok', city: { en: 'Bangkok', ru: 'Бангкок', es: 'Bangkok', de: 'Bangkok' } },
  { value: 'Asia/Singapore', city: { en: 'Singapore', ru: 'Сингапур', es: 'Singapur', de: 'Singapur' } },
  { value: 'Asia/Tokyo', city: { en: 'Tokyo', ru: 'Токио', es: 'Tokio', de: 'Tokio' } },

  // Oceania
  { value: 'Australia/Sydney', city: { en: 'Sydney', ru: 'Сидней', es: 'Sídney', de: 'Sydney' } },
  { value: 'Pacific/Auckland', city: { en: 'Auckland', ru: 'Окленд', es: 'Auckland', de: 'Auckland' } },
];

/**
 * Names for zones a phone is likely to report that are not in the list: the
 * tables of likely zones of T-256's native readers. A language without the
 * zone, and English always, reads the zone's own IANA name.
 */
const PHONE_ZONES: Record<string, Partial<Record<Exclude<Language, 'en'>, string>>> = {
  // Russia and its neighbours
  'Europe/Kaliningrad': { ru: 'Калининград' },
  'Europe/Samara': { ru: 'Самара' },
  'Europe/Ulyanovsk': { ru: 'Ульяновск' },
  'Europe/Saratov': { ru: 'Саратов' },
  'Europe/Astrakhan': { ru: 'Астрахань' },
  'Europe/Volgograd': { ru: 'Волгоград' },
  'Europe/Kirov': { ru: 'Киров' },
  'Europe/Simferopol': { ru: 'Симферополь' },
  'Asia/Omsk': { ru: 'Омск' },
  'Asia/Novosibirsk': { ru: 'Новосибирск' },
  'Asia/Barnaul': { ru: 'Барнаул' },
  'Asia/Tomsk': { ru: 'Томск' },
  'Asia/Novokuznetsk': { ru: 'Новокузнецк' },
  'Asia/Krasnoyarsk': { ru: 'Красноярск' },
  'Asia/Irkutsk': { ru: 'Иркутск' },
  'Asia/Chita': { ru: 'Чита' },
  'Asia/Yakutsk': { ru: 'Якутск' },
  'Asia/Vladivostok': { ru: 'Владивосток' },
  'Asia/Sakhalin': { ru: 'Южно-Сахалинск' },
  'Asia/Magadan': { ru: 'Магадан' },
  'Asia/Kamchatka': { ru: 'Петропавловск-Камчатский' },
  'Asia/Anadyr': { ru: 'Анадырь' },
  'Europe/Minsk': { ru: 'Минск' },
  'Europe/Chisinau': { ru: 'Кишинёв' },
  'Europe/Riga': { ru: 'Рига' },
  'Europe/Vilnius': { ru: 'Вильнюс' },
  'Europe/Tallinn': { ru: 'Таллин' },
  'Asia/Tbilisi': { ru: 'Тбилиси' },
  'Asia/Yerevan': { ru: 'Ереван' },
  'Asia/Baku': { ru: 'Баку' },
  'Asia/Almaty': { ru: 'Алматы' },
  'Asia/Qostanay': { ru: 'Костанай' },
  'Asia/Aqtobe': { ru: 'Актобе' },
  'Asia/Aqtau': { ru: 'Актау' },
  'Asia/Atyrau': { ru: 'Атырау' },
  'Asia/Oral': { ru: 'Уральск' },
  'Asia/Qyzylorda': { ru: 'Кызылорда' },
  'Asia/Tashkent': { ru: 'Ташкент' },
  'Asia/Samarkand': { ru: 'Самарканд' },
  'Asia/Bishkek': { ru: 'Бишкек' },
  'Asia/Dushanbe': { ru: 'Душанбе' },
  'Asia/Ashgabat': { ru: 'Ашхабад' },
  'Asia/Nicosia': { ru: 'Никосия' },

  // Europe
  'Europe/Paris': { ru: 'Париж' },
  'Europe/Lisbon': { ru: 'Лиссабон', de: 'Lissabon' },
  'Europe/Rome': { ru: 'Рим', de: 'Rom' },
  'Europe/Amsterdam': { ru: 'Амстердам' },
  'Europe/Brussels': { ru: 'Брюссель', de: 'Brüssel' },
  'Europe/Luxembourg': { de: 'Luxemburg' },
  'Europe/Busingen': { de: 'Büsingen' },
  'Europe/Prague': { ru: 'Прага', de: 'Prag' },
  'Europe/Warsaw': { ru: 'Варшава', de: 'Warschau' },
  'Europe/Budapest': { ru: 'Будапешт' },
  'Europe/Belgrade': { ru: 'Белград', de: 'Belgrad' },
  'Europe/Podgorica': { ru: 'Подгорица' },
  'Europe/Sofia': { ru: 'София' },
  'Europe/Bucharest': { ru: 'Бухарест', de: 'Bukarest' },
  'Europe/Athens': { ru: 'Афины', de: 'Athen' },
  'Europe/Helsinki': { ru: 'Хельсинки' },
  'Europe/Stockholm': { ru: 'Стокгольм' },
  'Europe/Oslo': { ru: 'Осло' },
  'Europe/Copenhagen': { ru: 'Копенгаген', de: 'Kopenhagen' },
  'Europe/Dublin': { ru: 'Дублин' },
  'Atlantic/Canary': { es: 'Canarias' },

  // The Americas
  'America/Toronto': { ru: 'Торонто' },
  'America/Vancouver': { ru: 'Ванкувер' },
  'America/Monterrey': { es: 'Monterrey' },
  'America/Tijuana': { es: 'Tijuana' },
  'America/Cancun': { es: 'Cancún' },
  'America/Lima': { es: 'Lima' },
  'America/Santiago': { es: 'Santiago de Chile' },
  'America/Montevideo': { es: 'Montevideo' },
  'America/Asuncion': { es: 'Asunción' },
  'America/La_Paz': { es: 'La Paz' },
  'America/Guayaquil': { es: 'Guayaquil' },
  'America/Caracas': { es: 'Caracas' },
  'America/Panama': { es: 'Panamá' },
  'America/Costa_Rica': { es: 'Costa Rica' },
  'America/Guatemala': { es: 'Guatemala' },
  'America/El_Salvador': { es: 'El Salvador' },
  'America/Tegucigalpa': { es: 'Tegucigalpa' },
  'America/Managua': { es: 'Managua' },
  'America/Havana': { es: 'La Habana' },
  'America/Santo_Domingo': { es: 'Santo Domingo' },
  'America/Puerto_Rico': { es: 'Puerto Rico' },

  // Asia
  'Asia/Hong_Kong': { de: 'Hongkong' },
  'Asia/Tehran': { de: 'Teheran' },
  'Asia/Ho_Chi_Minh': { ru: 'Хошимин' },
  'Asia/Makassar': { ru: 'Макасар' },
  'Asia/Colombo': { ru: 'Коломбо' },
};

/**
 * Older and newer IANA names of the zones above, each to the name written
 * here. A zone has more than one name: Europe/Kiev became Europe/Kyiv in
 * tzdata 2022b, the old name kept as a link. A phone with the newer tzdata
 * says Europe/Kyiv, the list says Europe/Kiev, and compared as strings they
 * were two zones: Kyiv was listed twice, and a profile saved as Europe/Kyiv
 * read the English "Kyiv" in every language.
 */
const ALIASES: Record<string, string> = {
  'Europe/Kyiv': 'Europe/Kiev',
  'Europe/Uzhgorod': 'Europe/Kiev', // links to Europe/Kyiv since 2022b
  'Europe/Zaporozhye': 'Europe/Kiev',
  'Asia/Calcutta': 'Asia/Kolkata',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Asia/Tel_Aviv': 'Asia/Jerusalem',
  'Asia/Istanbul': 'Europe/Istanbul',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Nicosia': 'Asia/Nicosia',
};

/** The name a zone is written by here, whichever IANA name it came by. */
function canonical(tz: string): string {
  return ALIASES[tz] ?? tz;
}

/**
 * Whether two IANA names are the same zone: "Europe/Kyiv" is "Europe/Kiev".
 * A picker marks the saved zone by it, whichever name it was saved under.
 */
export function sameTimezone(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && canonical(a) === canonical(b);
}

/**
 * Extract a human-readable city name from an IANA timezone identifier.
 * e.g. 'America/New_York' → 'New York', 'Europe/Vienna' → 'Vienna'
 */
function getCityName(tz: string): string {
  const last = tz.split('/').pop() || tz;
  return last.replace(/_/g, ' ');
}

/**
 * The UTC offset of `tz` at the moment `at`, e.g. "UTC+2", "UTC-10",
 * "UTC+5:30". Worked out by date-fns-tz, as every date in the app is, not
 * from Intl's timeZoneName 'shortOffset': Hermes answers that with a bare
 * "GMT", and Honolulu read "(UTC)" (T-011). formatInTimeZone takes `at` as
 * the moment it is; getTimezoneOffset took its fields in the device's zone
 * for the wall clock of `tz`, and an hour either side of a change of clocks
 * gave the other side's offset. Empty if the zone is unknown.
 */
function getOffsetLabel(tz: string, at: Date): string {
  let iso: string;
  try {
    iso = formatInTimeZone(at, tz, 'xxx'); // "-04:00", "+05:30"
  } catch {
    return '';
  }
  const parts = /^([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!parts) return '';
  const [, sign, hours, minutes] = parts;
  return `UTC${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
}

function withOffset(city: string, tz: string, at: Date): string {
  const offset = getOffsetLabel(tz, at);
  return offset ? `${city} (${offset})` : city;
}

function asLanguage(language: string): Language {
  return language === 'ru' || language === 'es' || language === 'de' ? language : 'en';
}

/** The city of `tz` in `language`: the list's name, the table's, or IANA's. */
function cityOf(tz: string, language: Language): string {
  const name = canonical(tz);
  const zone = CURATED.find((t) => t.value === name);
  if (zone) return zone.city[language];
  const own = language === 'en' ? undefined : PHONE_ZONES[name]?.[language];
  return own ?? getCityName(tz);
}

function option(tz: string, language: Language, at: Date): TimezoneOption {
  return {
    value: tz,
    label: withOffset(cityOf(tz, language), tz, at),
    labelEn: withOffset(cityOf(tz, 'en'), tz, at),
  };
}

/**
 * Returns the curated list in `language`, prepended with the device's current
 * timezone if it's not already present, under any of its names. Makes it
 * discoverable in the picker.
 */
export function getTimezonesWithDevice(language: string, at: Date = new Date()): TimezoneOption[] {
  const lang = asLanguage(language);
  let deviceTz: string | null = null;
  try {
    deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl unavailable — fall through to curated list
  }
  const curated = CURATED.map((zone) => option(zone.value, lang, at));
  if (!deviceTz || CURATED.some((t) => sameTimezone(t.value, deviceTz))) return curated;
  return [option(deviceTz, lang, at), ...curated];
}

/**
 * The options whose city, in the language they were made in or in English,
 * or zone name has `query` in it, in any case: "hon" finds Honolulu,
 * "pacific" the zones of the Pacific, and "new york" and "new_york" find the
 * same. An empty query is every option.
 */
export function searchTimezones(options: TimezoneOption[], query: string): TimezoneOption[] {
  const q = query.trim().toLocaleLowerCase().replace(/_/g, ' ');
  if (!q) return options;
  return options.filter((opt) =>
    [opt.label, opt.labelEn, opt.value.replace(/_/g, ' ')]
      .some((text) => text.toLocaleLowerCase().includes(q)));
}

/**
 * Resolve display label for an IANA timezone identifier in `language`, with
 * its offset at `at`: "Moskau (UTC+3)". A zone outside the list is named by
 * the tables of likely zones, or else by its IANA name.
 */
export function getTimezoneLabel(value: string, language: string, at: Date = new Date()): string {
  return option(value, asLanguage(language), at).label;
}
