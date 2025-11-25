import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { projectsAPI } from '../shared/services/api';
import { Project } from '../shared/types';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
  setSelectedProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string, timezone?: string) => Promise<Project>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await projectsAPI.getUserProjects();
      const projectsList = response.data.projects || [];
      setProjects(projectsList);

      // Auto-select first project if none selected
      if (!selectedProject && projectsList.length > 0) {
        setSelectedProject(projectsList[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

  const createProject = async (name: string, description?: string, timezone?: string): Promise<Project> => {
    const response = await projectsAPI.createProject({ name, description, timezone });
    const newProject = response.data.project;

    // Add to local state
    setProjects(prev => [newProject, ...prev]);

    // Auto-select the new project
    setSelectedProject(newProject);

    return newProject;
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        loading,
        error,
        setSelectedProject,
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
