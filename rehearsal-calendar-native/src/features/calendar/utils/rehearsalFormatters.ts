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
