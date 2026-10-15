import { useCallback, useRef, useState, useSyncExternalStore, SetStateAction } from 'react';
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
 * newer `begin()` or the end of the session. A mutation calls `begin()` too,
 * which drops a read that started before it and answers after it (DF06, NI04).
 */
export function useLatestRequest(): () => () => boolean {
  const latest = useRef(0);
  return useCallback(() => {
    const mine = ++latest.current;
    const session = currentSession();
    return () => mine === latest.current && isCurrentSession(session);
  }, []);
}
