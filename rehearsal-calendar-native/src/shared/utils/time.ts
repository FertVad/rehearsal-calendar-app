/**
 * Parse YYYY-MM-DD string to Date without timezone conversion.
 * This prevents the issue where "2024-11-30" becomes "2024-11-29" due to UTC conversion.
 */
export const parseDateString = (dateStr: string): Date => {
  if (!dateStr || !dateStr.includes('-')) {
    return new Date();
  }
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

/**
 * Format Date to YYYY-MM-DD string without timezone conversion.
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert time string (HH:mm) to minutes since midnight.
 * @example timeToMinutes('14:30') => 870
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:mm).
 * @example minutesToTime(870) => '14:30'
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Format YYYY-MM-DD string to localized date string (e.g., "25 ноября, понедельник").
 */
export const formatDateLocalized = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  },
  locale: string = 'ru-RU'
): string => {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString(locale, options);
};

/**
 * Convert ISO 8601 timestamp to local date string (YYYY-MM-DD)
 * @param isoTimestamp - ISO 8601 timestamp (e.g., "2025-12-10T19:00:00+02:00")
 * @returns Date string in YYYY-MM-DD format in local timezone
 */
export const isoToDateString = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  return formatDateToString(date);
};

/**
 * Convert ISO 8601 timestamp to local time string (HH:mm)
 * @param isoTimestamp - ISO 8601 timestamp (e.g., "2025-12-10T19:00:00+02:00")
 * @returns Time string in HH:mm format in local timezone
 */
export const isoToTimeString = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Convert date and time strings to ISO 8601 timestamp
 * Assumes local timezone
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:mm format
 * @returns ISO 8601 timestamp string
 */
export const dateTimeToISO = (dateStr: string, timeStr: string): string => {
  const date = parseDateString(dateStr);
  const [hours, minutes] = timeStr.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};
