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
 * Resolve display label for an IANA timezone identifier.
 * Falls back to the raw value when the timezone isn't in the curated list
 * (e.g. user's device reports an obscure tz from Intl.DateTimeFormat).
 */
export function getTimezoneLabel(value: string, language: 'ru' | 'en'): string {
  const tz = TIMEZONES.find(t => t.value === value);
  if (!tz) return value;
  return language === 'ru' ? tz.labelRu : tz.labelEn;
}
