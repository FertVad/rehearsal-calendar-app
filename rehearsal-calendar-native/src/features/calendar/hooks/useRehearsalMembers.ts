import { useState, useEffect, useCallback } from 'react';
import { projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';

import { logger } from '../../../shared/utils/logger';
// `error`: what the failed load failed with, kept for its text (T-228); null when it did not fail.
type Loaded = { projectId: string | null; members: ProjectMember[]; error: unknown };

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
  const [loaded, setLoaded] = useState<Loaded>({ projectId: null, members: [], error: null });
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // By id: the project list is read again behind the form (T-229), and the
  // same project read anew is not another project to load the members of.
  const projectId = project?.id ?? null;

  useEffect(() => {
    let current = true;

    if (!projectId) {
      setLoaded({ projectId: null, members: [], error: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    projectsAPI.getMembers(projectId)
      .then((response) => {
        if (current) setLoaded({ projectId, members: response.data.members || [], error: null });
      })
      .catch((error) => {
        if (!current) return;
        logger.error('Failed to load members:', error);
        setLoaded({ projectId, members: [], error: error ?? new Error('members load failed') });
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [projectId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const forThisProject = project != null && loaded.projectId === project.id;
  const failed = forThisProject && loaded.error != null && !loading;
  return {
    members: forThisProject ? loaded.members : [],
    loading: loading || (project != null && !forThisProject),
    failed,
    /** What it failed with, for requestErrorMessage: no connection is not the server down (T-228). */
    error: failed ? loaded.error : null,
    /** The list is this project's, loaded and not failed. */
    ready: forThisProject && !loading && loaded.error == null,
    reload,
  };
};
