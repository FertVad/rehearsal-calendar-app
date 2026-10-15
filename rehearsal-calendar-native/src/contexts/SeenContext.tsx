import React, { createContext, useCallback, useContext, useMemo, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
import { RSVPStatus } from '../shared/types';
import { rehearsalsAPI } from '../shared/services/api';
import { useI18n } from './I18nContext';
import { useSessionState } from '../shared/hooks/useSession';
import { isCurrentSession, currentSession } from '../shared/services/session';

export interface SeenStats {
  confirmed: number;
  invited: number;
}

interface SeenContextValue {
  /** 'yes' when this user has marked the rehearsal seen, null otherwise. */
  responseFor: (rehearsalId: string) => RSVPStatus;
  /** Only present for rehearsals in projects the user administers. */
  statsFor: (rehearsalId: string) => SeenStats | undefined;
  /** True while the toggle for this rehearsal is in flight. */
  isResponding: (rehearsalId: string) => boolean;
  toggleSeen: (rehearsalId: string) => Promise<void>;
  /** Seeds what the server already told us, so a fresh list starts correct. */
  prime: SeenWriter;
  /**
   * A read of the marks begins: call before the request, and hand its answer
   * to the writer returned. A rehearsal toggled after the read began keeps the
   * toggle — the answer is older than it (HN02).
   */
  beginRead: () => SeenWriter;
}

type SeenWriter = (
  responses: Record<string, RSVPStatus>,
  stats?: Record<string, SeenStats>
) => void;

const SeenContext = createContext<SeenContextValue | undefined>(undefined);

/**
 * Who has seen which rehearsal, for the whole app.
 *
 * This used to be per-screen state threaded through props: born in
 * useRehearsals, held by CalendarScreen, passed to TodayRehearsals, passed again
 * into every card. Any other screen wanting to show the same thing had to be
 * given its own copy — and the details sheet, which both reads and writes it,
 * could only live where the copy did. That constraint is what kept a second
 * sheet inside TodayRehearsals, and a second sheet is what left iOS holding a
 * layer that swallowed every touch on the calendar.
 *
 * One store, many readers. The toggle lives here too: keeping the mutation
 * apart from the state it mutates is how two places end up believing different
 * things about the same rehearsal.
 */
export function SeenProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  // The marks are the session's: the next person starts from none, and a
  // toggle answered after a sign-out writes nothing back (HN03).
  const [responses, setResponses] = useSessionState<Record<string, RSVPStatus>>({});
  const [stats, setStats] = useSessionState<Record<string, SeenStats>>({});
  const [responding, setResponding] = useSessionState<Record<string, boolean>>({});

  // Reads and changes in one order. Each change of a rehearsal's mark takes the
  // next number, when it is made and when the server has it; a read remembers
  // the number it began at, and its answer for a rehearsal changed since is
  // older than what is shown. Without this a list asked for before a tap and
  // answered after it took the mark back (HN02, review).
  const changes = useRef(0);
  const changedAt = useRef<Record<string, number>>({});
  const markChanged = useCallback((rehearsalId: string) => {
    changes.current += 1;
    changedAt.current[rehearsalId] = changes.current;
  }, []);

  const beginRead = useCallback((): SeenWriter => {
    const since = changes.current;
    const unchanged = <T,>(answers: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(answers).filter(([id]) => (changedAt.current[id] ?? 0) <= since)
      ) as Record<string, T>;
    return (nextResponses, nextStats) => {
      // Merged rather than replaced: a list covering one project must not erase
      // what is known about another.
      const responsesNow = unchanged(nextResponses);
      setResponses((prev) => ({ ...prev, ...responsesNow }));
      if (nextStats) {
        const statsNow = unchanged(nextStats);
        setStats((prev) => ({ ...prev, ...statsNow }));
      }
    };
  }, [setResponses, setStats]);

  const prime = useCallback<SeenWriter>(
    (nextResponses, nextStats) => beginRead()(nextResponses, nextStats),
    [beginRead]
  );

  const toggleSeen = useCallback(
    async (rehearsalId: string) => {
      const current = responses[rehearsalId] ?? null;

      // The wire and the UI disagree on purpose: 'no' means invited and not yet
      // seen, and having a row at all is what puts you on the rehearsal, so the
      // row is never deleted. In state that same thing reads as null.
      const next: RSVPStatus = current === 'yes' ? null : 'yes';
      const onTheWire = current === 'yes' ? 'no' : 'yes';

      markChanged(rehearsalId);
      setResponses((prev) => ({ ...prev, [rehearsalId]: next }));
      setResponding((prev) => ({ ...prev, [rehearsalId]: true }));
      const session = currentSession();

      try {
        const response = await rehearsalsAPI.respond(rehearsalId, onTheWire);
        if (response.data) {
          setStats((prev) => ({ ...prev, [rehearsalId]: response.data }));
        }
      } catch (err: any) {
        // Put it back. An optimistic update that survives its own failure is
        // worse than no optimism at all.
        setResponses((prev) => ({ ...prev, [rehearsalId]: current }));
        if (isCurrentSession(session)) Alert.alert(t.common.error, err?.message || t.rehearsals.seenError);
      } finally {
        // A read that began while this was on its way may carry the old mark.
        markChanged(rehearsalId);
        setResponding((prev) => ({ ...prev, [rehearsalId]: false }));
      }
    },
    [responses, t, setResponses, setResponding, setStats, markChanged]
  );

  const value = useMemo<SeenContextValue>(
    () => ({
      responseFor: (id) => responses[id] ?? null,
      statsFor: (id) => stats[id],
      isResponding: (id) => Boolean(responding[id]),
      toggleSeen,
      prime,
      beginRead,
    }),
    [responses, stats, responding, toggleSeen, prime, beginRead]
  );

  return <SeenContext.Provider value={value}>{children}</SeenContext.Provider>;
}

export function useSeen(): SeenContextValue {
  const context = useContext(SeenContext);
  if (!context) {
    throw new Error('useSeen must be used within a SeenProvider');
  }
  return context;
}
