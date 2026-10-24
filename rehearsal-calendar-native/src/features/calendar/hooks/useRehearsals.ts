import { logger } from '../../../shared/utils/logger';
import { useState, useCallback, useRef } from 'react';
import { Rehearsal, Project, RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { todayIn } from '../../../shared/utils/time';
import { lastDateOf, rehearsalInZone } from '../../../shared/utils/rehearsalDays';
import { useSeen } from '../../../contexts/SeenContext';
import { useLatestRequest } from '../../../shared/hooks/useSession';
import { useTimezone } from '../../../shared/hooks/useClock';

// Cache duration in milliseconds (15 seconds)
const CACHE_DURATION = 15000;

/**
 * Every rehearsal is read from its interval, in the profile's zone (time.ts,
 * cause fix 14), even when the server sent the legacy date/time fields too:
 * those name the start's day only, and the screens need the last day as well
 * (rehearsalInZone, DD02).
 */
const transformRehearsal = (r: Rehearsal, userTimezone: string): Rehearsal =>
  rehearsalInZone(r, userTimezone);

export const useRehearsals = (projects: Project[], filterProjectId: string | null) => {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const beginLoad = useLatestRequest();

  // Seen state lives in one place for the whole app, so this hook hands what
  // the server told it to the store rather than keeping a copy of its own.
  const { beginRead } = useSeen();

  // The zone rehearsals are dated in, and "today" below with them: the
  // profile's (DF01 — dated by the profile and compared with the device's today,
  // a rehearsal already over counted as upcoming).
  const userTimezone = useTimezone();

  const fetchRehearsals = useCallback(async (force = false) => {
    if (projects.length === 0) {
      // No projects is an answer, and the newest: the load still out is
      // dropped, and with it the `finally` that would have ended the spinner,
      // so it ends here (review).
      beginLoad();
      setRehearsals([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Smart caching: skip fetch if last update was recent (unless forced)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (!force && timeSinceLastFetch < CACHE_DURATION) {
      logger.debug('[useRehearsals] Skipping fetch - cache is fresh');
      return;
    }

    // Only the newest load lands: a filter changed while the previous one was
    // out must not be answered with the previous filter's rehearsals (DF06).
    const current = beginLoad();
    // The marks of the answer land only where nobody toggled since (HN02).
    const primeSeen = beginRead();

    // Use loading for initial load (no data), refreshing for background updates
    if (isInitialLoadRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      let fetchedRehearsals: Rehearsal[] = [];
      const responses: Record<string, RSVPStatus> = {};
      const stats: Record<string, { confirmed: number; invited: number }> = {};

      // If filter is null (All projects), fetch from all projects using batch endpoint
      if (filterProjectId === null) {
        // Use batch endpoint for better performance (single request instead of N requests)
        // Batch endpoint now includes RSVP data (userResponse + adminStats)
        const projectIds = projects.map(p => p.id);
        const response = await rehearsalsAPI.getBatch(projectIds);
        const allRehearsals = (response.data.rehearsals || []).map((r: any) => {
          // Every rehearsal of the answer says where this person stands, and
          // "not seen" is said too: left out, a mark taken back elsewhere stayed
          // on here (HN02).
          responses[r.id] = r.userResponse === 'yes' ? 'yes' : null;
          if (r.adminStats) {
            stats[r.id] = r.adminStats;
          }
          return transformRehearsal(r, userTimezone);
        });
        fetchedRehearsals = allRehearsals;
      } else {
        // Fetch from selected project only
        const response = await rehearsalsAPI.getAll(filterProjectId);
        const project = projects.find(p => p.id === filterProjectId);
        const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) =>
          transformRehearsal({
            ...r,
            projectName: project?.name,
            projectId: filterProjectId,
          }, userTimezone)
        );
        fetchedRehearsals = projectRehearsals;

        // For single project view, still need to fetch RSVP data separately
        // (since getAll endpoint doesn't include it yet)
        const today = todayIn(userTimezone);
        const upcomingRehearsals = fetchedRehearsals.filter(r => (lastDateOf(r) ?? '') >= today);

        if (upcomingRehearsals.length > 0) {
          await Promise.all(
            upcomingRehearsals.map(async (rehearsal) => {
              const isAdmin = project?.is_admin;

              // Load personal response for everyone
              try {
                const res = await rehearsalsAPI.getMyResponse(rehearsal.id);
                responses[rehearsal.id] = res.data.response?.response === 'yes' ? 'yes' : null;
              } catch (err) {
                logger.error(`Failed to fetch RSVP for ${rehearsal.id}:`, err);
              }

              // Load stats for admins
              if (isAdmin) {
                try {
                  const res = await rehearsalsAPI.getResponses(rehearsal.id);
                  if (res.data.stats) {
                    stats[rehearsal.id] = {
                      confirmed: res.data.stats.confirmed,
                      invited: res.data.stats.invited,
                    };
                  }
                } catch (err) {
                  logger.error(`Failed to fetch admin stats for ${rehearsal.id}:`, err);
                }
              }
            })
          );
        }
      }

      if (!current()) return;
      setRehearsals(fetchedRehearsals);
      primeSeen(responses, stats);

      // Update cache timestamp and mark initial load complete
      lastFetchTime.current = Date.now();
      isInitialLoadRef.current = false;
    } catch (err: any) {
      if (!current()) return;
      logger.error('Failed to fetch rehearsals:', err);
      setError(err.message || 'Failed to load rehearsals');
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projects, filterProjectId, userTimezone, beginRead, beginLoad]);

  return {
    rehearsals,
    loading,
    refreshing,
    error,
    fetchRehearsals,
  };
};
