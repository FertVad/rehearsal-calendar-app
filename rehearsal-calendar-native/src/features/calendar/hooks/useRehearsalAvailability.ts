import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { projectsAPI } from '../../../shared/services/api';
import { Project } from '../../../shared/types';
import { TimeRange } from '../../../shared/utils/availability';
import { logger } from '../../../shared/utils/logger';

type AvailabilityMap = Record<string, { timeRanges: TimeRange[] }>;
type Loaded = { key: string | null; availability: AvailabilityMap; failed: boolean };

// Format date as YYYY-MM-DD
const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Hook for loading member availability for rehearsal scheduling
 *
 * The availability is for one question — the project, the day, the people
 * and the rehearsal left out — and is handed out only for the question the
 * form is asking now (DF05; CLAUDE.md 11). An answer for a day the form has
 * since left is dropped, and while the current one is out, or after it failed,
 * there is none: `ready` is false and the form does not save as if nobody were
 * busy (CLAUDE.md 10).
 */
export const useRehearsalAvailability = (
  project: Project | null,
  date: Date,
  selectedMemberIds: string[],
  t: any,
  excludeRehearsalId?: string
) => {
  const [loaded, setLoaded] = useState<Loaded>({ key: null, availability: {}, failed: false });
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const dateStr = formatDate(date);
  const key = project && selectedMemberIds.length > 0
    ? [project.id, dateStr, [...selectedMemberIds].sort().join(','), excludeRehearsalId ?? ''].join('|')
    : null;

  useEffect(() => {
    let current = true;

    if (!project || key === null) {
      logger.debug('[useRehearsalAvailability] Skipping - no project or members');
      setLoaded({ key: null, availability: {}, failed: false });
      setLoading(false);
      return;
    }

    setLoading(true);
    projectsAPI.getMembersAvailability(project.id, dateStr, selectedMemberIds, excludeRehearsalId)
      .then((response) => {
        if (!current) return;
        // Transform array response to Record<userId, {timeRanges}>
        const availabilityMap: AvailabilityMap = {};
        for (const userAvail of response.data.availability || []) {
          // Find the data for the current date
          const dateData = userAvail.dates?.find((d: any) => d.date === dateStr);
          if (dateData && dateData.timeRanges) {
            availabilityMap[userAvail.userId] = { timeRanges: dateData.timeRanges };
          }
        }
        setLoaded({ key, availability: availabilityMap, failed: false });
      })
      .catch((error: any) => {
        if (!current) return;
        logger.error('[useRehearsalAvailability] Failed to load', {
          message: error.message,
          status: error.response?.status,
        });
        Alert.alert(t.common.error, t.rehearsals.loadAvailabilityError);
        setLoaded({ key, availability: {}, failed: true });
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const forThisQuestion = key !== null && loaded.key === key;
  return {
    memberAvailability: forThisQuestion ? loaded.availability : {},
    loading: loading || (key !== null && !forThisQuestion),
    failed: forThisQuestion && loaded.failed && !loading,
    /** Nobody to check, or the answer for exactly what the form shows. */
    ready: key === null || (forThisQuestion && !loaded.failed && !loading),
    reload,
  };
};
