import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';

/**
 * Hook for loading project members
 */
export const useRehearsalMembers = (
  project: Project | null,
  t: any
) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      if (!project) {
        setMembers([]);
        return;
      }

      setLoading(true);
      try {
        const response = await projectsAPI.getMembers(project.id);
        setMembers(response.data.members || []);
      } catch (error) {
        console.error('Failed to load members:', error);
        Alert.alert(t.common.error, t.rehearsals.loadMembersError);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [project]);

  return {
    members,
    loading,
  };
};
