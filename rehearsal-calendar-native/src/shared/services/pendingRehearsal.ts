/**
 * "Open this rehearsal when the calendar next has a chance."
 *
 * Three attempts went through the navigator instead, and each broke differently.
 * Nested params via `navigate` worked but pushed a second copy of the tabs when
 * called from a modal — a calendar inside the inbox, with its own bell, without
 * end. `popTo` stopped the copies and dropped the params, so the calendar opened
 * knowing nothing. Doing both left a dismissed modal still mounted over the
 * screen, swallowing every touch.
 *
 * The target is not really navigation state, so it stops pretending to be. The
 * id is put here, the modal simply closes, and CalendarScreen picks it up when
 * it comes forward. Nothing races, and a lost message costs nothing worse than
 * a rehearsal not opening.
 */

let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingRehearsal(id: string | number): void {
  pending = String(id);
  listeners.forEach((notify) => notify());
}

/** Reads and clears — a target is meant to be acted on once. */
export function consumePendingRehearsal(): string | null {
  const id = pending;
  pending = null;
  return id;
}

export function hasPendingRehearsal(): boolean {
  return pending !== null;
}

/**
 * Told when a target arrives, for the case where the calendar is already on
 * screen and would otherwise never be focused again.
 */
export function subscribePendingRehearsal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
