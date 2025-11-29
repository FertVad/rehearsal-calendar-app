import { useState, useCallback } from 'react';
import { Rehearsal, Project, RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDateToString } from '../../../shared/utils/time';

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
            const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) => ({
              ...r,
              projectName: project.name,
              projectId: project.id,
            }));
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
        const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) => ({
          ...r,
          projectName: project?.name,
          projectId: filterProjectId,
        }));
        fetchedRehearsals = projectRehearsals;
      }

      setRehearsals(fetchedRehearsals);

      // Fetch user's RSVP responses and admin stats for upcoming rehearsals
      const today = formatDateToString(new Date());
      const upcomingRehearsals = fetchedRehearsals.filter(r => r.date >= today);

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
                  responses[rehearsal.id] = res.data.response.status;
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

  return {
    rehearsals,
    loading,
    error,
    rsvpResponses,
    setRsvpResponses,
    adminStats,
    fetchRehearsals,
  };
};
