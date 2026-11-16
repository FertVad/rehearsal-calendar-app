/**
 * How long ago the last sync was, in words.
 *
 * Lived inside an availability hook, which meant any other screen wanting to
 * say the same thing had to import that hook. It only ever needed the
 * translations.
 *
 * The words are written in the translations as they are inside a sentence —
 * "just now", «только что», "hace 5 min", "vor 5 Min" (German nouns keep
 * their capital) — and begin with a capital only where they stand alone.
 * They were all written alone, so the sync screen said "Synced Just now"
 * (T-239); the caller says which it is.
 */
export type LastSyncPlace = 'alone' | 'inSentence';

export function formatLastSync(lastSync: string | null | undefined, t: any, place: LastSyncPlace): string {
  if (!lastSync) return '';

  const diffMs = Date.now() - new Date(lastSync).getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  const words: string =
    minutes < 1 ? t.calendarSync.justNow
      : minutes < 60 ? t.calendarSync.minutesAgo(minutes)
        : hours < 24 ? t.calendarSync.hoursAgo(hours)
          : t.calendarSync.daysAgo(days);

  return place === 'alone' ? words.charAt(0).toLocaleUpperCase() + words.slice(1) : words;
}
