import { useEffect, useState } from 'react';
import { rehearsalsAPI } from '../../../shared/services/api';
import { Project } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';
import { DEFAULT_REHEARSAL_MINUTES, usualRehearsalMinutes } from '../utils/rehearsalDefaults';

/**
 * How long a new rehearsal of `project` runs unless someone says otherwise:
 * the length of its last one (rehearsalDefaults.ts). Three hours until the
 * project's rehearsals are in, and when they could not be read — a default
 * the form offers, never a value it saves unseen. An answer for a project the
 * form has since left is dropped (CLAUDE.md 11).
 */
export function useUsualDuration(project: Project | null): number {
  const [loaded, setLoaded] = useState<{ projectId: string; minutes: number } | null>(null);
  const projectId = project?.id ?? null;

  useEffect(() => {
    if (!projectId) return;
    let current = true;
    (async () => {
      try {
        const response = await rehearsalsAPI.getAll(projectId);
        if (current) setLoaded({ projectId, minutes: usualRehearsalMinutes(response.data.rehearsals || []) });
      } catch (error) {
        logger.debug('Usual rehearsal length not read, three hours offered:', error);
      }
    })();
    return () => {
      current = false;
    };
  }, [projectId]);

  return loaded && loaded.projectId === projectId ? loaded.minutes : DEFAULT_REHEARSAL_MINUTES;
}
