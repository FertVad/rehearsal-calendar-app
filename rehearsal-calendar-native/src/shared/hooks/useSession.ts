import { useCallback, useMemo, useRef, useState, useSyncExternalStore, SetStateAction } from 'react';
import { currentSession, isCurrentSession, subscribeSession, SessionStamp } from '../services/session';

/** The session the screen is showing (shared/services/session.ts). */
export function useSession(): SessionStamp {
  return useSyncExternalStore(subscribeSession, currentSession, currentSession);
}

/**
 * State that belongs to the session it was written in. A new session reads
 * `initial` from its first render — no frame of the previous person's — and a
 * write from a closure of an earlier session is dropped, so a late answer has
 * nowhere to land. The providers above the navigator hold their state this
 * way: a sign-out does not unmount them (HN03, NI03, BC01).
 */
export function useSessionState<T>(initial: T): [T, (next: SetStateAction<T>) => void] {
  const session = useSession();
  const first = useRef(initial).current;
  const [held, setHeld] = useState<{ session: SessionStamp; value: T }>({ session, value: first });
  const value = held.session === session ? held.value : first;
  const set = useCallback((next: SetStateAction<T>) => {
    if (!isCurrentSession(session)) return;
    setHeld((prev) => {
      const base = prev.session === session ? prev.value : first;
      const value = typeof next === 'function' ? (next as (previous: T) => T)(base) : next;
      return { session, value };
    });
  }, [session, first]);
  return [value, set];
}

/**
 * The newest question's answer, and only while the session it was asked in
 * lasts. `begin()` before the request; the check it returns is true until a
 * newer `begin()` or the end of the session (DF06). Reads that race changes of
 * the same state go through `useRequestOrder` instead.
 */
export function useLatestRequest(): () => () => boolean {
  const latest = useRef(0);
  return useCallback(() => {
    const mine = ++latest.current;
    const session = currentSession();
    return () => mine === latest.current && isCurrentSession(session);
  }, []);
}

/** Asks whether an answer may land on `key` now; true means it is landing. */
export type AnswerCheck = (key?: string) => boolean;

const WHOLE = '';

/**
 * Reads and changes of one piece of state, in one order (HN02, NI04).
 *
 * A change is on its way from the moment it is sent until the server has
 * answered, and the whole of that time counts: a read that answers while a
 * change of the same key is out, or that began before the change finished, may
 * hold the state from before the change — its answer is dropped. Among the
 * answers that remain the one asked last wins, so an older answer never
 * replaces a newer one already shown, and a read never drops a change's answer.
 *
 * The order itself is the session's. The stores that use it sit above the
 * navigator and outlive a sign-out, so each session gets an order of its own,
 * and a request keeps the one it was sent in: the previous person's change
 * still on its way, and its ending, touch nothing of the next person's
 * (review 3).
 *
 * `beginRead()` before the request, and ask the check it returns right as each
 * key's answer lands. `write(send, key)` wraps a change; `send` gets the check
 * for its own answer. Keys split one store into independent parts (a
 * rehearsal's mark); without one, the whole store is one part.
 */
export function useRequestOrder(): {
  beginRead: () => AnswerCheck;
  write: <T>(send: (answer: () => boolean) => Promise<T>, key?: string) => Promise<T>;
} {
  const held = useRef<SessionOrder | null>(null);

  // The order of the session running now; a new session starts a new one.
  const current = useCallback((): SessionOrder => {
    const session = currentSession();
    if (held.current?.session !== session) held.current = newOrder(session);
    return held.current;
  }, []);

  const beginRead = useCallback((): AnswerCheck => {
    const order = current();
    const askedAt = ++order.clock;
    return (key = WHOLE) =>
      isCurrentSession(order.session)
      && !order.inFlight.get(key)
      && (order.lastWriteEnd.get(key) ?? 0) < askedAt
      && land(order, key, askedAt);
  }, [current]);

  const write = useCallback(async <T,>(send: (answer: () => boolean) => Promise<T>, key = WHOLE) => {
    const order = current();
    const askedAt = ++order.clock;
    order.inFlight.set(key, (order.inFlight.get(key) ?? 0) + 1);
    try {
      return await send(() => isCurrentSession(order.session) && land(order, key, askedAt));
    } finally {
      order.inFlight.set(key, (order.inFlight.get(key) ?? 1) - 1);
      order.lastWriteEnd.set(key, ++order.clock);
    }
  }, [current]);

  return useMemo(() => ({ beginRead, write }), [beginRead, write]);
}

interface SessionOrder {
  session: SessionStamp;
  clock: number;
  inFlight: Map<string, number>;
  lastWriteEnd: Map<string, number>;
  shown: Map<string, number>;
}

function newOrder(session: SessionStamp): SessionOrder {
  return { session, clock: 0, inFlight: new Map(), lastWriteEnd: new Map(), shown: new Map() };
}

// An answer lands unless one asked later already has.
function land(order: SessionOrder, key: string, askedAt: number): boolean {
  if ((order.shown.get(key) ?? 0) > askedAt) return false;
  order.shown.set(key, askedAt);
  return true;
}
