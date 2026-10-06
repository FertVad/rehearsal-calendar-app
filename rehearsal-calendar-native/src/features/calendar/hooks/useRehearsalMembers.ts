import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';

/**
 * The members of the project the form is on.
 *
 * Only that project's: a list loaded for the project before is not handed out
 * while the new one is in flight, and an answer for a project the form has
 * since left is dropped (CLAUDE.md 11). The form picks its participants from
 * this list once per project (initialParticipants), so a stale list would put
 * one project's people on another's rehearsal.
 */
export const useRehearsalMembers = (
  project: Project | null,
  t: any
) => {
  const [loaded, setLoaded] = useState<{ projectId: string | null; members: ProjectMember[] }>({
    projectId: null,
    members: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let current = true;

    if (!project) {
      setLoaded({ projectId: null, members: [] });
      return;
    }

    setLoading(true);
    projectsAPI.getMembers(project.id)
      .then((response) => {
        if (current) setLoaded({ projectId: project.id, members: response.data.members || [] });
      })
      .catch((error) => {
        if (!current) return;
        console.error('Failed to load members:', error);
        // Nobody to pick from, and said so — never another project's list.
        setLoaded({ projectId: project.id, members: [] });
        Alert.alert(t.common.error, t.rehearsals.loadMembersError);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [project]);

  const forThisProject = project != null && loaded.projectId === project.id;
  return {
    members: forThisProject ? loaded.members : [],
    loading: loading || (project != null && !forThisProject),
  };
};
