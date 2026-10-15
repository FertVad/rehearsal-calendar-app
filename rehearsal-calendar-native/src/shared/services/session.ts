/**
 * Who the app is working for, and whether an answer still has anyone to go to
 * (cause fix 12; CLAUDE.md 11).
 *
 * Everything the app holds about a person — projects, the seen marks, the
 * unread count, a calendar sync under way — belongs to one session. A session
 * ends at a sign-out, at a sign-in as somebody else, and when the server
 * refuses the session for good. Each ending moves `generation` on, so:
 *
 * - state written in an earlier session reads as never written
 *   (useSessionState), and an answer asked for in one is dropped
 *   (isCurrentSession, useLatestRequest);
 * - work that writes in the person's name — the calendar sync — runs as the
 *   session's work (sessionWork). The change of owner waits for it before the
 *   next person's tokens are written, so nothing it sends can go out under
 *   them; the work itself stops at its next checkpoint once the session has
 *   ended, which keeps the wait short.
 *
 * One owner at a time: the AuthContext moves it, and only through here.
 */

/** The session an answer was asked for in. */
export type SessionStamp = number;

let generation = 0;
let owner: string | null = null;
const listeners = new Set<() => void>();
const work = new Set<Promise<unknown>>();

// A sign-out waits for the session's work no longer than this. A calendar
// provider that never answers must not keep the person signed in; past it the
// work is stopped by its own checkpoints, not waited for.
export const SESSION_WORK_WAIT_MS = 10000;

export function currentSession(): SessionStamp {
  return generation;
}

export function isCurrentSession(stamp: SessionStamp): boolean {
  return stamp === generation;
}

/** Work of a session that has ended: it stops here and writes nothing more. */
export class SessionEndedError extends Error {
  constructor() {
    super('The session this work belonged to has ended');
    this.name = 'SessionEndedError';
  }
}

export function assertSession(stamp: SessionStamp): void {
  if (stamp !== generation) throw new SessionEndedError();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hands the app to `userId` (null: to nobody). The same person keeps their
 * session — an address change writes a new pair of tokens for them, and their
 * screens stay as they are. Anybody else starts a new one: earlier answers are
 * dropped, and this waits for the earlier session's work to finish before
 * returning, so the caller writes the new credentials only after it.
 */
export async function changeOwner(userId: string | number | null): Promise<void> {
  const next = userId === null ? null : String(userId);
  if (next !== null && next === owner) return;
  // Signed out and staying so: nothing of anybody's is left to end.
  if (next === null && owner === null && work.size === 0) return;
  owner = next;
  generation += 1;
  listeners.forEach((listener) => listener());
  await settleSessionWork();
}

/**
 * The person a restored session belongs to, at start: nothing was asked for
 * anybody before it, so nothing is ended.
 */
export function restoreOwner(userId: string | number): void {
  if (owner === null) owner = String(userId);
}

async function settleSessionWork(): Promise<void> {
  if (work.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SESSION_WORK_WAIT_MS);
  });
  await Promise.race([Promise.allSettled([...work]), limit]);
  if (timer) clearTimeout(timer);
}

/**
 * Runs `run` as the current session's work. It gets the session's stamp and
 * checks it (assertSession) before each write; a change of owner waits for it.
 */
export function sessionWork<T>(run: (session: SessionStamp) => Promise<T>): Promise<T> {
  const session = generation;
  const running = run(session);
  work.add(running);
  const done = () => {
    work.delete(running);
  };
  running.then(done, done);
  return running;
}

// The server has refused the session for good (the refresh token itself was
// rejected). The AuthContext listens and signs the person out on the spot.
const expiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

export function reportSessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}

/** Tests only: a fresh app. */
export function resetSessionForTests(): void {
  generation = 0;
  owner = null;
  work.clear();
  listeners.clear();
  expiredListeners.clear();
}
