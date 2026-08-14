import type { Language } from '../../../i18n/translations';
import { getDateLocale } from '../../../shared/utils/locale';

/**
 * Format Date object for display (localized)
 */
export function formatDisplayDate(d: Date, language: Language): string {
  return d.toLocaleDateString(getDateLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
