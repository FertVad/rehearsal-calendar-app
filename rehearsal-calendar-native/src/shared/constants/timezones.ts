/**
 * Common timezones presented to users when picking project/user timezone.
 * Curated for global theatre/rehearsal app use — balanced across regions,
 * not region-specific.
 *
 * UTC offsets reflect standard time; some entries observe DST and shift
 * by one hour seasonally.
 */
export interface TimezoneOption {
  value: string;     // IANA timezone identifier
  labelRu: string;
  labelEn: string;
}

export const TIMEZONES: TimezoneOption[] = [
  // Americas
  { value: 'America/Los_Angeles', labelRu: 'Лос-Анджелес (UTC-8)', labelEn: 'Los Angeles (UTC-8)' },
  { value: 'America/Denver',      labelRu: 'Денвер (UTC-7)',       labelEn: 'Denver (UTC-7)' },
  { value: 'America/Chicago',     labelRu: 'Чикаго (UTC-6)',       labelEn: 'Chicago (UTC-6)' },
  { value: 'America/New_York',    labelRu: 'Нью-Йорк (UTC-5)',     labelEn: 'New York (UTC-5)' },
  { value: 'America/Sao_Paulo',   labelRu: 'Сан-Паулу (UTC-3)',    labelEn: 'São Paulo (UTC-3)' },

  // Europe
  { value: 'Europe/London',       labelRu: 'Лондон (UTC+0)',       labelEn: 'London (UTC+0)' },
  { value: 'Europe/Berlin',       labelRu: 'Берлин (UTC+1)',       labelEn: 'Berlin (UTC+1)' },
  { value: 'Europe/Kiev',         labelRu: 'Киев (UTC+2)',         labelEn: 'Kyiv (UTC+2)' },
  { value: 'Europe/Istanbul',     labelRu: 'Стамбул (UTC+3)',      labelEn: 'Istanbul (UTC+3)' },
  { value: 'Europe/Moscow',       labelRu: 'Москва (UTC+3)',       labelEn: 'Moscow (UTC+3)' },

  // Middle East & Africa
  { value: 'Africa/Cairo',        labelRu: 'Каир (UTC+2)',         labelEn: 'Cairo (UTC+2)' },
  { value: 'Asia/Jerusalem',      labelRu: 'Тель-Авив (UTC+2)',    labelEn: 'Tel Aviv (UTC+2)' },
  { value: 'Asia/Dubai',          labelRu: 'Дубай (UTC+4)',        labelEn: 'Dubai (UTC+4)' },

  // Asia
  { value: 'Asia/Yekaterinburg',  labelRu: 'Екатеринбург (UTC+5)', labelEn: 'Yekaterinburg (UTC+5)' },
  { value: 'Asia/Kolkata',        labelRu: 'Мумбаи (UTC+5:30)',    labelEn: 'Mumbai (UTC+5:30)' },
  { value: 'Asia/Bangkok',        labelRu: 'Бангкок (UTC+7)',      labelEn: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore',      labelRu: 'Сингапур (UTC+8)',     labelEn: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          labelRu: 'Токио (UTC+9)',        labelEn: 'Tokyo (UTC+9)' },

  // Oceania
  { value: 'Australia/Sydney',    labelRu: 'Сидней (UTC+10)',      labelEn: 'Sydney (UTC+10)' },
  { value: 'Pacific/Auckland',    labelRu: 'Окленд (UTC+12)',      labelEn: 'Auckland (UTC+12)' },
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
 * Compute the current UTC offset label for any IANA timezone, e.g. "UTC+2".
 * Returns empty string if Intl can't resolve the timezone.
 */
function getOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return tzName.replace('GMT', 'UTC') || 'UTC';
  } catch {
    return '';
  }
}

/**
 * Build a TimezoneOption on the fly from an IANA identifier. Used when the
 * user's device reports a timezone outside the curated list — we still want
 * a nice label like "Vienna (UTC+1)" instead of raw "Europe/Vienna".
 */
function buildDynamicOption(tz: string): TimezoneOption {
  const city = getCityName(tz);
  const offset = getOffsetLabel(tz);
  const label = offset ? `${city} (${offset})` : city;
  // No translated form available for arbitrary cities, so reuse for both locales.
  return { value: tz, labelRu: label, labelEn: label };
}

/**
 * Returns the curated list, prepended with the device's current timezone
 * if it's not already present. Makes it discoverable in the picker.
 */
export function getTimezonesWithDevice(): TimezoneOption[] {
  let deviceTz: string | null = null;
  try {
    deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl unavailable — fall through to curated list
  }
  if (!deviceTz || TIMEZONES.some(t => t.value === deviceTz)) return TIMEZONES;
  return [buildDynamicOption(deviceTz), ...TIMEZONES];
}

/**
 * Resolve display label for an IANA timezone identifier.
 * Only Russian has fully curated translations; all other languages share
 * the English label set. Falls back to a computed "City (UTC±N)" when the
 * timezone isn't in the curated list.
 */
export function getTimezoneLabel(value: string, language: string): string {
  const useRussian = language === 'ru';
  const tz = TIMEZONES.find(t => t.value === value);
  if (tz) return useRussian ? tz.labelRu : tz.labelEn;
  const opt = buildDynamicOption(value);
  return useRussian ? opt.labelRu : opt.labelEn;
}
