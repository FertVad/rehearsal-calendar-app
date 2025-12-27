/**
 * Format Date object to YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date object to HH:MM
 */
export function formatTime(d: Date): string {
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format Date object for display (localized)
 */
export function formatDisplayDate(d: Date, language: 'ru' | 'en'): string {
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Parse time string (HH:MM) into Date object
 * @param timeStr - Time string in HH:MM format
 * @param baseDate - Optional base date to use (defaults to current date)
 * @returns Date object with parsed time
 */
export function parseTimeString(timeStr: string, baseDate?: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}
