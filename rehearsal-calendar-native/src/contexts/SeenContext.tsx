import React, { createContext, useCallback, useContext, useMemo, ReactNode } from 'react';
import { Alert } from 'react-native';
import { RSVPStatus } from '../shared/types';
import { rehearsalsAPI } from '../shared/services/api';
import { useI18n } from './I18nContext';
import { useRequestOrder, useSessionState } from '../shared/hooks/useSession';
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
   * to the writer returned. A rehearsal whose toggle was on its way at any time
   * since the read began keeps the toggle — the answer may be older (HN02).
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

  // Reads and changes in one order, each rehearsal on its own (useRequestOrder).
  // A list that answers while a tap on a rehearsal is on its way, or that was
  // asked for before the tap landed, says nothing about that rehearsal: without
  // this it took the mark back (HN02, review).
  const order = useRequestOrder();

  const beginRead = useCallback((): SeenWriter => {
    const answer = order.beginRead();
    return (nextResponses, nextStats = {}) => {
      const landing = new Set(
        [...new Set([...Object.keys(nextResponses), ...Object.keys(nextStats)])].filter((id) => answer(id))
      );
      const only = <T,>(answers: Record<string, T>) =>
        Object.fromEntries(Object.entries(answers).filter(([id]) => landing.has(id))) as Record<string, T>;
      // Merged rather than replaced: a list covering one project must not erase
      // what is known about another.
      const responsesNow = only(nextResponses);
      const statsNow = only(nextStats);
      setResponses((prev) => ({ ...prev, ...responsesNow }));
      setStats((prev) => ({ ...prev, ...statsNow }));
    };
  }, [order, setResponses, setStats]);

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

      setResponses((prev) => ({ ...prev, [rehearsalId]: next }));
      setResponding((prev) => ({ ...prev, [rehearsalId]: true }));
      const session = currentSession();

      try {
        await order.write(async (answer) => {
          const response = await rehearsalsAPI.respond(rehearsalId, onTheWire);
          if (response.data && answer()) {
            setStats((prev) => ({ ...prev, [rehearsalId]: response.data }));
          }
        }, rehearsalId);
      } catch (err: any) {
        // Put it back. An optimistic update that survives its own failure is
        // worse than no optimism at all.
        setResponses((prev) => ({ ...prev, [rehearsalId]: current }));
        if (isCurrentSession(session)) Alert.alert(t.common.error, err?.message || t.rehearsals.seenError);
      } finally {
        setResponding((prev) => ({ ...prev, [rehearsalId]: false }));
      }
    },
    [responses, t, setResponses, setResponding, setStats, order]
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
