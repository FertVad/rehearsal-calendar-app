import { formatInTimeZone } from 'date-fns-tz';

/**
 * Common timezones presented to users when picking project/user timezone.
 * Curated for global theatre/rehearsal app use — balanced across regions,
 * not region-specific.
 *
 * Only the cities are written here. A zone's offset is worked out for the
 * moment it is shown (T-011): written out, it was standard time all year, and
 * New York read UTC-5 through the summer it is UTC-4.
 */
export interface TimezoneOption {
  value: string;     // IANA timezone identifier
  labelRu: string;
  labelEn: string;
}

interface CuratedZone {
  value: string;
  cityRu: string;
  cityEn: string;
}

const CURATED: CuratedZone[] = [
  // Americas
  { value: 'America/Los_Angeles', cityRu: 'Лос-Анджелес', cityEn: 'Los Angeles' },
  { value: 'America/Denver',      cityRu: 'Денвер',       cityEn: 'Denver' },
  { value: 'America/Chicago',     cityRu: 'Чикаго',       cityEn: 'Chicago' },
  { value: 'America/New_York',    cityRu: 'Нью-Йорк',     cityEn: 'New York' },
  { value: 'America/Sao_Paulo',   cityRu: 'Сан-Паулу',    cityEn: 'São Paulo' },

  // Europe
  { value: 'Europe/London',       cityRu: 'Лондон',       cityEn: 'London' },
  { value: 'Europe/Berlin',       cityRu: 'Берлин',       cityEn: 'Berlin' },
  { value: 'Europe/Kiev',         cityRu: 'Киев',         cityEn: 'Kyiv' },
  { value: 'Europe/Istanbul',     cityRu: 'Стамбул',      cityEn: 'Istanbul' },
  { value: 'Europe/Moscow',       cityRu: 'Москва',       cityEn: 'Moscow' },

  // Middle East & Africa
  { value: 'Africa/Cairo',        cityRu: 'Каир',         cityEn: 'Cairo' },
  { value: 'Asia/Jerusalem',      cityRu: 'Тель-Авив',    cityEn: 'Tel Aviv' },
  { value: 'Asia/Dubai',          cityRu: 'Дубай',        cityEn: 'Dubai' },

  // Asia
  { value: 'Asia/Yekaterinburg',  cityRu: 'Екатеринбург', cityEn: 'Yekaterinburg' },
  { value: 'Asia/Kolkata',        cityRu: 'Мумбаи',       cityEn: 'Mumbai' },
  { value: 'Asia/Bangkok',        cityRu: 'Бангкок',      cityEn: 'Bangkok' },
  { value: 'Asia/Singapore',      cityRu: 'Сингапур',     cityEn: 'Singapore' },
  { value: 'Asia/Tokyo',          cityRu: 'Токио',        cityEn: 'Tokyo' },

  // Oceania
  { value: 'Australia/Sydney',    cityRu: 'Сидней',       cityEn: 'Sydney' },
  { value: 'Pacific/Auckland',    cityRu: 'Окленд',       cityEn: 'Auckland' },
];

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

function curatedOption(zone: CuratedZone, at: Date): TimezoneOption {
  return {
    value: zone.value,
    labelRu: withOffset(zone.cityRu, zone.value, at),
    labelEn: withOffset(zone.cityEn, zone.value, at),
  };
}

/**
 * Build a TimezoneOption on the fly from an IANA identifier. Used when the
 * user's device reports a timezone outside the curated list — we still want
 * a nice label like "Vienna (UTC+1)" instead of raw "Europe/Vienna".
 */
function buildDynamicOption(tz: string, at: Date): TimezoneOption {
  // No translated form available for arbitrary cities, so reuse for both locales.
  const label = withOffset(getCityName(tz), tz, at);
  return { value: tz, labelRu: label, labelEn: label };
}

/**
 * Returns the curated list, prepended with the device's current timezone
 * if it's not already present. Makes it discoverable in the picker.
 */
export function getTimezonesWithDevice(at: Date = new Date()): TimezoneOption[] {
  let deviceTz: string | null = null;
  try {
    deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl unavailable — fall through to curated list
  }
  const curated = CURATED.map((zone) => curatedOption(zone, at));
  if (!deviceTz || CURATED.some(t => t.value === deviceTz)) return curated;
  return [buildDynamicOption(deviceTz, at), ...curated];
}

/**
 * Resolve display label for an IANA timezone identifier, with its offset at
 * `at`. Only Russian has fully curated translations; all other languages share
 * the English label set. Falls back to a computed "City (UTC±N)" when the
 * timezone isn't in the curated list.
 */
export function getTimezoneLabel(value: string, language: string, at: Date = new Date()): string {
  const useRussian = language === 'ru';
  const zone = CURATED.find(t => t.value === value);
  const opt = zone ? curatedOption(zone, at) : buildDynamicOption(value, at);
  return useRussian ? opt.labelRu : opt.labelEn;
}
