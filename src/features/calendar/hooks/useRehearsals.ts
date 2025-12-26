import { useState, useCallback } from 'react';
import { Rehearsal, Project, RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDateToString, isoToDateString, isoToTimeString } from '../../../shared/utils/time';

/**
 * Transform rehearsal from API format to UI format
 * Converts ISO timestamps to legacy date/time fields for backward compatibility
 */
const transformRehearsal = (r: Rehearsal): Rehearsal => {
  // If rehearsal already has legacy format, return as-is
  if (r.date && r.time) {
    return r;
  }

  // Convert from new format (startsAt/endsAt) to legacy format (date/time/endTime)
  if (r.startsAt && r.endsAt) {
    return {
      ...r,
      date: isoToDateString(r.startsAt),
      time: isoToTimeString(r.startsAt),
      endTime: isoToTimeString(r.endsAt),
    };
  }

  // Fallback: return as-is
  return r;
};

export const useRehearsals = (projects: Project[], filterProjectId: string | null) => {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpResponses, setRsvpResponses] = useState<Record<string, RSVPStatus>>({});
  const [adminStats, setAdminStats] = useState<Record<string, { confirmed: number; invited: number }>>({});

  const fetchRehearsals = useCallback(async () => {
    if (projects.length === 0) {
      setRehearsals([]);
      return;
    }

    setLoading(true);
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
          // Extract RSVP data from batch response
          if (r.userResponse === 'yes') {
            responses[r.id] = 'yes';
          }
          if (r.adminStats) {
            stats[r.id] = r.adminStats;
          }
          return transformRehearsal(r);
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
          })
        );
        fetchedRehearsals = projectRehearsals;

        // For single project view, still need to fetch RSVP data separately
        // (since getAll endpoint doesn't include it yet)
        const today = formatDateToString(new Date());
        const upcomingRehearsals = fetchedRehearsals.filter(r => r.date && r.date >= today);

        if (upcomingRehearsals.length > 0) {
          await Promise.all(
            upcomingRehearsals.map(async (rehearsal) => {
              const isAdmin = project?.is_admin;

              // Load personal response for everyone
              try {
                const res = await rehearsalsAPI.getMyResponse(rehearsal.id);
                if (res.data.response) {
                  const serverResponse = res.data.response.response;
                  responses[rehearsal.id] = serverResponse === 'yes' ? 'yes' : null;
                }
              } catch (err) {
                console.error(`Failed to fetch RSVP for ${rehearsal.id}:`, err);
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
                  console.error(`Failed to fetch admin stats for ${rehearsal.id}:`, err);
                }
              }
            })
          );
        }
      }

      setRehearsals(fetchedRehearsals);
      setRsvpResponses(responses);
      setAdminStats(stats);
    } catch (err: any) {
      console.error('Failed to fetch rehearsals:', err);
      setError(err.message || 'Failed to load rehearsals');
    } finally {
      setLoading(false);
    }
  }, [projects, filterProjectId]);

  const updateAdminStats = useCallback(async (rehearsalId: string) => {
    try {
      const res = await rehearsalsAPI.getResponses(rehearsalId);
      if (res.data.stats) {
        setAdminStats(prev => ({
          ...prev,
          [rehearsalId]: {
            confirmed: res.data.stats.confirmed,
            declined: res.data.stats.declined,
            tentative: res.data.stats.tentative,
            invited: res.data.stats.invited,
          },
        }));
      }
    } catch (err) {
      console.error(`Failed to update admin stats for ${rehearsalId}:`, err);
    }
  }, []);

  return {
    rehearsals,
    loading,
    error,
    rsvpResponses,
    setRsvpResponses,
    adminStats,
    setAdminStats,
    fetchRehearsals,
    updateAdminStats,
  };
};
