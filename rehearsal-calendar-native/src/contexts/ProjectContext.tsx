import React, { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { projectsAPI } from '../shared/services/api';
import { onDataChanged } from '../shared/utils/dataChanged';
import { Project } from '../shared/types';
import { useAuth } from './AuthContext';
import { logger } from '../shared/utils/logger';
import { useLatestRequest, useSession, useSessionState } from '../shared/hooks/useSession';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  /** The failed load itself; the screen says it in its language (requestErrorMessage, T-228). */
  error: unknown;
  setSelectedProject: (project: Project | null) => void;
  /** `quiet`: behind the list on screen, without its skeleton (pull to refresh). */
  refreshProjects: (options?: { quiet?: boolean }) => Promise<void>;
  createProject: (idempotencyKey: string, name: string, description?: string, timezone?: string) => Promise<Project>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// The session's projects: a sign-out or another person's sign-in starts from
// none (BC01), and only the newest load's answer lands.
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const session = useSession();
  const [projects, setProjects] = useSessionState<Project[]>([]);
  // The choice is an id, and the project is read from the list as it is now:
  // a project deleted or left falls back to the first one, and a changed role
  // is the list's, not a copy taken when it was picked (BC02).
  const [selectedId, setSelectedId] = useSessionState<string | null>(null);
  const [loading, setLoading] = useSessionState(false);
  const [error, setError] = useSessionState<unknown>(null);
  const beginLoad = useLatestRequest();

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? projects[0] ?? null,
    [projects, selectedId]
  );

  // `quiet`: a re-read behind a list already on screen (T-229) — no skeleton
  // over it, and a failure keeps the list it has rather than replacing it with
  // an error; the next trigger tries again.
  const fetchProjects = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!user) return;
    const current = beginLoad();

    if (!quiet) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await projectsAPI.getUserProjects();
      if (!current()) return;
      setProjects(response.data.projects || []);
      setError(null);
    } catch (err: any) {
      if (!current()) return;
      logger.error('Failed to fetch projects:', err);
      if (!quiet) setError(err ?? new Error('Failed to load projects'));
    } finally {
      // Whichever load is newest ends the loading, a quiet one included: it
      // may have overtaken a loud one that set it.
      if (current()) setLoading(false);
    }
  };

  const refreshProjects = async (options?: { quiet?: boolean }) => {
    await fetchProjects(options);
  };

  // The role is the server's, and it changes on another device: the owner
  // makes someone an admin, removes them, deletes the project. The list used
  // to be read only at sign-in, after a join and after a delete, so a role
  // given or taken stayed as it was until the app was restarted (T-229). It is
  // read again whenever the app comes forward, and whenever something says
  // the projects changed — a push about a role, a removal or a deletion, a
  // pull on the projects screen, the server refusing an admin action (403).
  const latestFetch = useRef(fetchProjects);
  latestFetch.current = fetchProjects;
  useEffect(() => {
    if (!user) return;
    const reread = () => { latestFetch.current({ quiet: true }); };
    const offChanged = onDataChanged('projects', reread);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') reread();
    });
    return () => {
      offChanged();
      foreground.remove();
    };
  }, [user, session]);

  const createProject = async (
    idempotencyKey: string, name: string, description?: string, timezone?: string,
  ): Promise<Project> => {
    const response = await projectsAPI.createProject({ name, description, timezone }, idempotencyKey);
    const newProject = response.data.project;

    // Add to local state. A repeat is answered with the project the first try
    // made, which a refresh in between may already have listed: replace it
    // rather than show it twice.
    setProjects(prev => [newProject, ...prev.filter(p => p.id !== newProject.id)]);

    // Auto-select the new project
    setSelectedId(newProject.id);

    return newProject;
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, session]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        loading,
        error,
        setSelectedProject: (project) => setSelectedId(project?.id ?? null),
        refreshProjects,
        createProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
