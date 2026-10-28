import { useState, useEffect, useCallback } from 'react';
import { projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';

import { logger } from '../../../shared/utils/logger';
type Loaded = { projectId: string | null; members: ProjectMember[]; failed: boolean };

/**
 * The members of the project the form is on.
 *
 * Only that project's: a list loaded for the project before is not handed out
 * while the new one is in flight, and an answer for a project the form has
 * since left is dropped (CLAUDE.md 11). A load that failed says so — `failed`,
 * with `reload` to try again — rather than reading as a project with nobody
 * in it (CLAUDE.md 10): the form starts its participants from this list, and
 * an empty one would put nobody on the rehearsal (review R9-02).
 */
export const useRehearsalMembers = (project: Project | null) => {
  const [loaded, setLoaded] = useState<Loaded>({ projectId: null, members: [], failed: false });
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    if (!project) {
      setLoaded({ projectId: null, members: [], failed: false });
      return;
    }

    setLoading(true);
    projectsAPI.getMembers(project.id)
      .then((response) => {
        if (current) setLoaded({ projectId: project.id, members: response.data.members || [], failed: false });
      })
      .catch((error) => {
        if (!current) return;
        logger.error('Failed to load members:', error);
        setLoaded({ projectId: project.id, members: [], failed: true });
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [project, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const forThisProject = project != null && loaded.projectId === project.id;
  const failed = forThisProject && loaded.failed && !loading;
  return {
    members: forThisProject ? loaded.members : [],
    loading: loading || (project != null && !forThisProject),
    failed,
    /** The list is this project's, loaded and not failed. */
    ready: forThisProject && !loading && !loaded.failed,
    reload,
  };
};
