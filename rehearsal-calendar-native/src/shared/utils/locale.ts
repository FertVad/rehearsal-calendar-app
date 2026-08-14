const DATE_LOCALES: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
};

/**
 * Maps the app's UI language to a BCP 47 locale tag for use with
 * Intl APIs (`toLocaleDateString`, `Intl.DateTimeFormat`, etc).
 * Accepts a plain string so callers that receive `language` as a
 * prop don't have to import the Language type.
 */
export function getDateLocale(language: string): string {
  return DATE_LOCALES[language] ?? 'en-US';
}
