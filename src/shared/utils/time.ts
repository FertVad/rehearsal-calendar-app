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
 * Format YYYY-MM-DD string to localized date string (e.g., "25 ноября, понедельник").
 */
export const formatDateLocalized = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }
): string => {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString('ru-RU', options);
};
