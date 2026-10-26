/**
 * The app's own mark on the events it exports, and the one rule for "this
 * event is ours" (cause fix 19, EX01).
 */

/**
 * The rehearsal an exported event stands for, written into the event's URL.
 *
 * The event carried nothing identifying it: every rehearsal of a project got
 * the same title and the same notes, so a second device — which sees the same
 * iCloud calendar but addresses its events by a different local id — had to
 * guess which event was which from the title, the start time and the location.
 * Two rehearsals of one project starting in the same minute were
 * indistinguishable, and one without a location matched nothing at all.
 *
 * The URL rather than the notes: an event has no hidden field on iOS, so the
 * mark is visible either way, and a link at least takes the reader to the
 * rehearsal instead of showing them an identifier for nothing. The scheme is
 * the app's own — `rehearsalapp`, already registered and already routed — and
 * navigation resolves it to the details screen. iOS only, which is what this
 * ships on.
 */
export const eventUrlFor = (rehearsalId: string) => `rehearsalapp://rehearsal/${rehearsalId}`;

const rehearsalIdFromUrl = (url?: string | null): string | null => {
  const match = /^rehearsalapp:\/\/rehearsal\/(.+)$/.exec(url || '');
  return match ? match[1] : null;
};

/** What the export writes into the notes. */
export const eventNotesFor = (projectName: string) => `Project: ${projectName}\n\nCreated via Rehearsly`;

/** How those notes end, under both names the app has had. */
const APP_SIGNATURE = /\n\nCreated via (Rehearsly|Rehearsal Calendar app)$/;

/** An event of ours from before the URL: it names no rehearsal. */
export const LEGACY = Symbol('legacy export');

export type MarkedEvent = { url?: string | null; notes?: string | null };

/**
 * Whose event this is, by the app's own mark and nothing else.
 *
 * The rehearsal's id in the URL; for an event written before the URL existed,
 * the signature the export has always put at the end of the notes, which names
 * no rehearsal (LEGACY). Anything without either is the reader's (null),
 * whatever it says. The export used to take an event as its own when its
 * title, times and place matched a rehearsal — so a personal "Rehearsal" from
 * 10 to 12 became the export of the admin's rehearsal at those hours, and was
 * rewritten when the rehearsal changed and deleted when it was cancelled.
 * Permission to write to a calendar says nothing about who wrote an event in it.
 */
export function ownMarkOf(event: MarkedEvent): string | typeof LEGACY | null {
  const rehearsalId = rehearsalIdFromUrl(event.url);
  if (rehearsalId) return rehearsalId;
  if (!event.url && APP_SIGNATURE.test(event.notes ?? '')) return LEGACY;
  return null;
}

/**
 * May the export write to or remove `event` for this rehearsal?
 *
 * Asked before every adoption, update and removal, so a mapping that points at
 * someone else's event — one the old guess adopted, or an id from another
 * device — never reaches it either.
 */
export function isOwnEventOf(event: MarkedEvent, rehearsalId: string | number): boolean {
  const mark = ownMarkOf(event);
  return mark === LEGACY || mark === String(rehearsalId);
}
