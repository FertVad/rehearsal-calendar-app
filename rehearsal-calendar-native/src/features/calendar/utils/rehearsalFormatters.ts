import type { Language } from '../../../i18n/translations';
import { getDateLocale } from '../../../shared/utils/locale';

/**
 * Format Date object for display (localized)
 */
export function formatDisplayDate(d: Date, language: Language): string {
  // With its day of the week: picked on a month, the day is known by it (T-018).
  return d.toLocaleDateString(getDateLocale(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
