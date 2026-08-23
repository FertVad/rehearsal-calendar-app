/**
 * How long ago the last sync was, in words.
 *
 * Lived inside an availability hook, which meant any other screen wanting to
 * say the same thing had to import that hook. It only ever needed the
 * translations.
 */
export function formatLastSync(lastSync: string | null | undefined, t: any): string {
  if (!lastSync) return '';

  const diffMs = Date.now() - new Date(lastSync).getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (minutes < 1) return t.calendarSync.justNow;
  if (minutes < 60) return t.calendarSync.minutesAgo(minutes);
  if (hours < 24) return t.calendarSync.hoursAgo(hours);
  return t.calendarSync.daysAgo(days);
}
