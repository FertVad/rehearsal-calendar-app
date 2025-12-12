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
  const [adminStats, setAdminStats] = useState<Record<string, { confirmed: number; declined: number; pending: number }>>({});

  const fetchRehearsals = useCallback(async () => {
    if (projects.length === 0) {
      setRehearsals([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let fetchedRehearsals: Rehearsal[] = [];

      // If filter is null (All projects), fetch from all projects
      if (filterProjectId === null) {
        const allRehearsals: Rehearsal[] = [];
        for (const project of projects) {
          try {
            const response = await rehearsalsAPI.getAll(project.id);
            const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) =>
              transformRehearsal({
                ...r,
                projectName: project.name,
                projectId: project.id,
              })
            );
            allRehearsals.push(...projectRehearsals);
          } catch (err) {
            console.error(`Failed to fetch rehearsals for project ${project.id}:`, err);
          }
        }
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
      }

      setRehearsals(fetchedRehearsals);

      // Fetch user's RSVP responses and admin stats for upcoming rehearsals
      const today = formatDateToString(new Date());
      const upcomingRehearsals = fetchedRehearsals.filter(r => r.date && r.date >= today);

      if (upcomingRehearsals.length > 0) {
        const responses: Record<string, RSVPStatus> = {};
        const stats: Record<string, { confirmed: number; declined: number; pending: number }> = {};

        await Promise.all(
          upcomingRehearsals.map(async (rehearsal) => {
            const project = projects.find(p => p.id === rehearsal.projectId);
            const isAdmin = project?.is_admin;

            if (isAdmin) {
              try {
                const res = await rehearsalsAPI.getResponses(rehearsal.id);
                if (res.data.stats) {
                  stats[rehearsal.id] = {
                    confirmed: res.data.stats.confirmed,
                    declined: res.data.stats.declined,
                    pending: res.data.stats.invited + res.data.stats.tentative,
                  };
                }
              } catch (err) {
                console.error(`Failed to fetch admin stats for ${rehearsal.id}:`, err);
              }
            } else {
              try {
                const res = await rehearsalsAPI.getMyResponse(rehearsal.id);
                if (res.data.response) {
                  // Map server response ('yes'/'no'/'maybe') to client status ('confirmed'/'declined'/'tentative')
                  const responseMap: Record<string, RSVPStatus> = {
                    'yes': 'confirmed',
                    'no': 'declined',
                    'maybe': 'tentative',
                  };
                  const serverResponse = res.data.response.response;
                  responses[rehearsal.id] = responseMap[serverResponse] || serverResponse as RSVPStatus;
                }
              } catch (err) {
                console.error(`Failed to fetch RSVP for ${rehearsal.id}:`, err);
              }
            }
          })
        );

        setRsvpResponses(responses);
        setAdminStats(stats);
      }
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
            pending: res.data.stats.invited + res.data.stats.tentative,
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
