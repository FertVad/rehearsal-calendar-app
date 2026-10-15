import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { projectsAPI } from '../shared/services/api';
import { Project } from '../shared/types';
import { useAuth } from './AuthContext';
import { logger } from '../shared/utils/logger';
import { useLatestRequest, useSession, useSessionState } from '../shared/hooks/useSession';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
  setSelectedProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
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
  const [error, setError] = useSessionState<string | null>(null);
  const beginLoad = useLatestRequest();

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? projects[0] ?? null,
    [projects, selectedId]
  );

  const fetchProjects = async () => {
    if (!user) return;
    const current = beginLoad();

    setLoading(true);
    setError(null);

    try {
      const response = await projectsAPI.getUserProjects();
      if (!current()) return;
      setProjects(response.data.projects || []);
    } catch (err: any) {
      if (!current()) return;
      logger.error('Failed to fetch projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      if (current()) setLoading(false);
    }
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

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
