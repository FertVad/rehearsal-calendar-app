/**
 * "Something on the server changed — reload if you are showing it."
 *
 * A push arriving while the app is open used to move the unread count and
 * nothing else. The rehearsal it announced did not appear in the list until the
 * app was restarted, because screens reload when they gain focus and a screen
 * already in focus never gains it again.
 *
 * Deliberately smaller than a context: there is no state here, and a screen
 * that wants to know says so in one line. Nothing is passed with the signal —
 * a listener reloads what it owns rather than trying to patch a single record,
 * which is how two copies of the same list start disagreeing.
 */
type Topic = 'rehearsals';

const listeners = new Map<Topic, Set<() => void>>();

/** Returns the unsubscribe, for a useEffect cleanup. */
export function onDataChanged(topic: Topic, listener: () => void): () => void {
  const forTopic = listeners.get(topic) ?? new Set();
  forTopic.add(listener);
  listeners.set(topic, forTopic);

  return () => {
    forTopic.delete(listener);
  };
}

export function emitDataChanged(topic: Topic): void {
  for (const listener of listeners.get(topic) ?? []) {
    try {
      listener();
    } catch {
      // One screen failing to reload must not stop the others.
    }
  }
}
