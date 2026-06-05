import type { Language } from '../../i18n/translations';

const DATE_LOCALES: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
};

/**
 * Maps the app's UI language to a BCP 47 locale tag for use with
 * Intl APIs (`toLocaleDateString`, `Intl.DateTimeFormat`, etc).
 */
export function getDateLocale(language: Language): string {
  return DATE_LOCALES[language] ?? 'en-US';
}
