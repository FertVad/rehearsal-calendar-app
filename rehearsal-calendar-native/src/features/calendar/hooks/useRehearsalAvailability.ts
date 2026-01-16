import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { projectsAPI } from '../../../shared/services/api';
import { Project } from '../../../shared/types';
import { TimeRange } from '../../../shared/utils/availability';
import { logger } from '../../../shared/utils/logger';

/**
 * Hook for loading member availability for rehearsal scheduling
 */
export const useRehearsalAvailability = (
  project: Project | null,
  date: Date,
  selectedMemberIds: string[],
  t: any
) => {
  const [memberAvailability, setMemberAvailability] = useState<Record<string, { timeRanges: TimeRange[] }>>({});
  const [loading, setLoading] = useState(false);

  // Format date as YYYY-MM-DD
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadAvailability = async () => {
      logger.debug('[useRehearsalAvailability] Load called', {
        hasProject: !!project,
        memberCount: selectedMemberIds.length,
        projectId: project?.id,
        memberIds: selectedMemberIds,
      });

      if (!project || selectedMemberIds.length === 0) {
        logger.debug('[useRehearsalAvailability] Skipping - no project or members');
        setMemberAvailability({});
        return;
      }

      setLoading(true);
      try {
        const dateStr = formatDate(date);
        logger.debug('[useRehearsalAvailability] Calling API', {
          projectId: project.id,
          dateStr,
          memberIds: selectedMemberIds
        });

        const response = await projectsAPI.getMembersAvailability(
          project.id,
          dateStr,
          selectedMemberIds
        );

        logger.debug('[useRehearsalAvailability] API response', response.data);

        // Transform array response to Record<userId, {timeRanges}>
        const availabilityMap: Record<string, { timeRanges: TimeRange[] }> = {};
        const availabilityArray = response.data.availability || [];

        for (const userAvail of availabilityArray) {
          // Find the data for the current date
          const dateData = userAvail.dates?.find((d: any) => d.date === dateStr);
          if (dateData && dateData.timeRanges) {
            availabilityMap[userAvail.userId] = {
              timeRanges: dateData.timeRanges,
            };
          }
        }

        logger.debug('[useRehearsalAvailability] Transformed availability', availabilityMap);
        setMemberAvailability(availabilityMap);
      } catch (error: any) {
        logger.error('[useRehearsalAvailability] Failed to load', error);
        logger.error('[useRehearsalAvailability] Error details', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        Alert.alert(t.common.error, t.rehearsals.loadAvailabilityError);
        setMemberAvailability({});
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [project, date, selectedMemberIds]);

  return {
    memberAvailability,
    loading,
  };
};
