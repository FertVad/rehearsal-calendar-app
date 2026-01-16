/**
 * Unit Tests for useAddRehearsalForm Hook
 *
 * Tests form state management, edit mode, and picker controls
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAddRehearsalForm } from '../useAddRehearsalForm';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { Project } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useAddRehearsalForm Hook', () => {
  const mockProjects: Project[] = [
    {
      id: '1',
      name: 'Band Project',
      description: 'Rock band',
      is_admin: true,
      timezone: 'UTC',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Theater Project',
      description: 'Drama',
      is_admin: false,
      timezone: 'UTC',
      created_at: '2025-01-02T00:00:00Z',
    },
    {
      id: '3',
      name: 'New Project',
      description: 'Newest',
      is_admin: true,
      timezone: 'UTC',
      created_at: '2025-01-03T00:00:00Z', // Newest
    },
  ] as any;

  const mockSetSelectedProject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form State Initialization - Create Mode', () => {
    it('should initialize with default values in create mode', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      expect(result.current.date).toBeInstanceOf(Date);
      expect(result.current.startTime).toBeInstanceOf(Date);
      expect(result.current.endTime).toBeInstanceOf(Date);
      expect(result.current.location).toBe('');
      expect(result.current.selectedMemberIds).toEqual([]);
      expect(result.current.isEditMode).toBe(false);
      expect(result.current.loadingRehearsal).toBe(false);
    });

    it('should filter admin projects only', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      expect(result.current.adminProjects).toHaveLength(2);
      expect(result.current.adminProjects[0].id).toBe('1');
      expect(result.current.adminProjects[1].id).toBe('3');
    });

    it('should select newest admin project as default', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      // Project 3 is newest (created 2025-01-03)
      expect(result.current.defaultProject?.id).toBe('3');
    });

    it('should auto-select default project when no project selected', () => {
      renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      // Should call setSelectedProject with newest admin project
      expect(mockSetSelectedProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: '3' })
      );
    });
  });

  describe('Form State Initialization - Edit Mode with rehearsalId', () => {
    it('should enter edit mode when rehearsalId is provided', async () => {
      const mockRehearsal = {
        id: 'r1',
        projectId: '1',
        startsAt: '2025-12-29T14:00:00Z',
        endsAt: '2025-12-29T16:00:00Z',
        location: 'Studio A',
      };

      const mockResponses = [
        { userId: 'user1', response: 'yes' },
        { userId: 'user2', response: 'yes' },
        { userId: 'user3', response: 'no' },
      ];

      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: [mockRehearsal] },
      });

      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({
        data: { responses: mockResponses },
      });

      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: {
            rehearsalId: 'r1',
            projectId: '1',
          },
        })
      );

      // Should start loading
      expect(result.current.loadingRehearsal).toBe(true);
      expect(result.current.isEditMode).toBe(true);

      // Wait for async loading
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should have loaded rehearsal data
      expect(result.current.loadingRehearsal).toBe(false);
      expect(result.current.location).toBe('Studio A');
      expect(result.current.selectedMemberIds).toEqual(['user1', 'user2']);
    });

    it('should show alert and go back if rehearsal not found', async () => {
      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: [] }, // Empty - rehearsal not found
      });

      const mockGoBack = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        goBack: mockGoBack,
        navigate: jest.fn(),
      });

      renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: {
            rehearsalId: 'r1',
            projectId: '1',
          },
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Rehearsal not found');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Prefill from Route Params', () => {
    it('should prefill project from projectId param', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: {
            projectId: '1',
          },
        })
      );

      expect(mockSetSelectedProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' })
      );
    });

    it('should prefill date from prefilledDate param', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: {
            prefilledDate: '2025-12-25',
          },
        })
      );

      const expectedDate = new Date('2025-12-25T00:00:00');
      expect(result.current.date.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should not prefill non-admin project', () => {
      renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: {
            projectId: '2', // Non-admin project
          },
        })
      );

      // Should not call with project 2
      expect(mockSetSelectedProject).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: '2' })
      );
    });
  });

  describe('Date and Time Pickers', () => {
    it('should open date picker', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      expect(result.current.showDatePicker).toBe(false);

      act(() => {
        result.current.openDatePicker();
      });

      expect(result.current.showDatePicker).toBe(true);
    });

    it('should open start time picker', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      act(() => {
        result.current.openStartTimePicker();
      });

      expect(result.current.showStartTimePicker).toBe(true);
    });

    it('should open end time picker', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      act(() => {
        result.current.openEndTimePicker();
      });

      expect(result.current.showEndTimePicker).toBe(true);
    });

    it('should handle date change', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      const newDate = new Date('2025-12-31');

      act(() => {
        result.current.handleDateChange({}, newDate);
      });

      expect(result.current.date).toEqual(newDate);
    });

    it('should auto-adjust end time if start time becomes after end time', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      const initialEndTime = result.current.endTime;
      const newStartTime = new Date(initialEndTime.getTime() + 1000); // 1 second after end

      act(() => {
        result.current.handleStartTimeChange({}, newStartTime);
      });

      // End time should be auto-adjusted to 2 hours after start
      expect(result.current.endTime.getTime()).toBeGreaterThan(newStartTime.getTime());
    });
  });

  describe('Project Selection', () => {
    it('should handle project selection', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      act(() => {
        result.current.handleSelectProject(mockProjects[0]);
      });

      expect(mockSetSelectedProject).toHaveBeenCalledWith(mockProjects[0]);
      expect(result.current.showProjectPicker).toBe(false);
      expect(result.current.selectedMemberIds).toEqual([]); // Reset members
    });

    it('should open create project screen', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      act(() => {
        result.current.handleCreateProject();
      });

      expect(mockNavigate).toHaveBeenCalledWith('CreateProject');
      expect(result.current.showProjectPicker).toBe(false);
    });
  });

  describe('Form Reset', () => {
    it('should reset form to initial state', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      // Modify form state
      act(() => {
        result.current.setLocation('Test Location');
      });

      expect(result.current.location).toBe('Test Location');

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.location).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty projects list', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: [],
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      expect(result.current.adminProjects).toEqual([]);
      expect(result.current.defaultProject).toBeNull();
    });

    it('should handle projects with no admin projects', () => {
      const nonAdminProjects = [
        { id: '1', name: 'Project 1', is_admin: false },
        { id: '2', name: 'Project 2', is_admin: false },
      ] as any;

      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: nonAdminProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
        })
      );

      expect(result.current.adminProjects).toEqual([]);
      expect(result.current.defaultProject).toBeNull();
    });
  });
});
