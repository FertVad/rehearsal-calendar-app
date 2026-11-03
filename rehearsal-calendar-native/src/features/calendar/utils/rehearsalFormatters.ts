import type { Language } from '../../../i18n/translations';
import { formatDate } from '../../../shared/utils/dateFormat';

/**
 * Format Date object for display (localized)
 */
export function formatDisplayDate(d: Date, language: Language): string {
  // With its day of the week: picked on a month, the day is known by it (T-018).
  return formatDate(d, 'fullDate', language);
}
