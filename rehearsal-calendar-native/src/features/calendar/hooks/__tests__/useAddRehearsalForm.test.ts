/**
 * Unit Tests for useAddRehearsalForm Hook
 *
 * Tests form state management, edit mode, and picker controls
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAddRehearsalForm } from '../useAddRehearsalForm';
import { rehearsalsAPI, projectsAPI } from '../../../../shared/services/api';
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
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    setLanguage: jest.fn(),
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
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
    // By id, not from the calendar batch: the batch is the caller's own
    // calendar, so an admin who was not on a rehearsal could not open it for
    // editing at all (review D04).
    it('loads the rehearsal by id, so an admin who is not on it can edit it (review D04)', async () => {
      (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1', projectId: '1', startsAt: '2025-12-29T14:00:00Z',
          endsAt: '2025-12-29T16:00:00Z', location: 'Studio A' } },
      });
      // The roster as the server reads it — people still in the project. 'no'
      // means invited and not yet seen, so everyone listed stays selected.
      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({
        data: { allParticipants: [
          { userId: 'user1', response: 'yes' }, { userId: 'user2', response: 'yes' }, { userId: 'user3', response: 'no' },
        ] },
      });

      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: { rehearsalId: 'r1', projectId: '1' },
        })
      );

      expect(result.current.loadingRehearsal).toBe(true);
      expect(result.current.isEditMode).toBe(true);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(rehearsalsAPI.getById).toHaveBeenCalledWith('r1');
      expect(rehearsalsAPI.getBatch).not.toHaveBeenCalled();
      expect(result.current.loadingRehearsal).toBe(false);
      expect(result.current.location).toBe('Studio A');
      expect(result.current.selectedMemberIds).toEqual(['user1', 'user2', 'user3']);
    });

    // An edit sends the whole participant list, and an empty one clears the
    // call. A form left open over a failed load could save exactly that
    // (review DF03), so a form that could not load closes.
    it.each([
      ['the rehearsal', () => (rehearsalsAPI.getById as jest.Mock).mockRejectedValue({ response: { status: 404 } })],
      ['its participants', () => {
        (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({
          data: { rehearsal: { id: 'r1', projectId: '1', startsAt: '2025-12-29T14:00:00Z', endsAt: '2025-12-29T16:00:00Z' } },
        });
        (rehearsalsAPI.getResponses as jest.Mock).mockRejectedValue(new Error('offline'));
      }],
    ])('closes the form when %s could not be loaded (review DF03)', async (_what, arrange) => {
      arrange();
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
          routeParams: { rehearsalId: 'r1', projectId: '1' },
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(Alert.alert).toHaveBeenCalled();
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
        result.current.handleDateChange(newDate);
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
        result.current.handleStartTimeChange(newStartTime);
      });

      // End time should be auto-adjusted to 2 hours after start
      expect(result.current.endTime.getTime()).toBeGreaterThan(newStartTime.getTime());
    });

    // Cause fix 15: the times are clock times, an end before the start the
    // next morning.
    describe('past midnight', () => {
      const at = (h: number, m = 0) => new Date(2026, 8, 10, h, m);
      const form = () => renderHook(() =>
        useAddRehearsalForm({ projects: mockProjects, selectedProject: null, setSelectedProject: mockSetSelectedProject })
      ).result;

      // The usual length: three hours for a project with no rehearsal (T-012).
      it('a start moved past a same-day end takes the end the usual length on — the next morning at 23:00', () => {
        const result = form();
        act(() => { result.current.setStartTime(at(18)); result.current.setEndTime(at(20)); });
        act(() => { result.current.handleStartTimeChange(at(23)); });

        expect(result.current.endTime.getHours()).toBe(2);
        expect(result.current.endsNextDay).toBe(true);
      });

      it('an overnight rehearsal keeps its end when its start moves', () => {
        const result = form();
        act(() => { result.current.setStartTime(at(23)); result.current.setEndTime(at(1)); });
        expect(result.current.endsNextDay).toBe(true);
        act(() => { result.current.handleStartTimeChange(at(22)); });

        expect(result.current.endTime.getHours()).toBe(1);
        expect(result.current.endsNextDay).toBe(true);
      });

      it('a start landing on the end moves it on', () => {
        const result = form();
        act(() => { result.current.setStartTime(at(23)); result.current.setEndTime(at(1)); });
        act(() => { result.current.handleStartTimeChange(at(1)); });

        expect(result.current.endTime.getHours()).toBe(4);
        expect(result.current.endsNextDay).toBe(false);
      });
    });
  });

  // T-012. A planner slot or a recommendation is free time, not a rehearsal:
  // "All day", 09:00-23:00, went into the form as a fourteen-hour rehearsal.
  // And the form opened on the hour already begun: 07:00 at 07:02.
  describe('What the form fills in by itself (T-012)', () => {
    const lastOf = (minutes: number) => ({
      data: { rehearsals: [
        { startsAt: '2026-10-01T18:00:00Z', endsAt: '2026-10-01T21:00:00Z', createdAt: '2026-09-01T10:00:00Z' },
        { startsAt: '2026-09-20T10:00:00Z', endsAt: new Date(Date.parse('2026-09-20T10:00:00Z') + minutes * 60000).toISOString(),
          createdAt: '2026-09-15T10:00:00Z' },
      ] },
    });
    const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    afterEach(() => jest.useRealTimers());

    it('a slot gives the start, and the end is the usual length on', async () => {
      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue(lastOf(150));
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: { projectId: '1', prefilledDate: '2026-11-03', prefilledTime: '09:00' },
        })
      );
      await settle();

      expect(rehearsalsAPI.getAll).toHaveBeenCalledWith('1');
      expect(clock(result.current.startTime)).toBe('09:00');
      // The last one put in the project ran 2 h 30 min.
      expect(clock(result.current.endTime)).toBe('11:30');
    });

    it('three hours for a project with no rehearsal yet, or none that could be read', async () => {
      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({ data: { rehearsals: [] } });
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects, selectedProject: null, setSelectedProject: mockSetSelectedProject,
          routeParams: { projectId: '1', prefilledTime: '09:00' },
        })
      );
      await settle();
      expect(clock(result.current.endTime)).toBe('12:00');

      (rehearsalsAPI.getAll as jest.Mock).mockRejectedValue(new Error('offline'));
      const offline = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects, selectedProject: null, setSelectedProject: mockSetSelectedProject,
          routeParams: { projectId: '1', prefilledTime: '09:00' },
        })
      ).result;
      await settle();
      expect(clock(offline.current.endTime)).toBe('12:00');
    });

    it('a recommendation gives the start only, and the end follows', async () => {
      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue(lastOf(120));
      const { result } = renderHook(() =>
        useAddRehearsalForm({ projects: mockProjects, selectedProject: null, setSelectedProject: mockSetSelectedProject })
      );
      await settle();
      act(() => { result.current.setEndTime(new Date(2026, 8, 10, 23, 0)); });

      act(() => { result.current.handleTimeSelect('09:00'); });

      expect(clock(result.current.startTime)).toBe('09:00');
      expect(clock(result.current.endTime)).toBe('11:00');
    });

    it('an end someone picked stays', async () => {
      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue(lastOf(120));
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects, selectedProject: null, setSelectedProject: mockSetSelectedProject,
          routeParams: { projectId: '1', prefilledTime: '09:00' },
        })
      );
      await settle();
      act(() => { result.current.handleEndTimeChange(new Date(2026, 8, 10, 10, 15)); });
      act(() => { result.current.handleStartTimeChange(new Date(2026, 8, 10, 8, 0)); });

      expect(clock(result.current.endTime)).toBe('10:15');
    });

    it('starts at the next whole hour: 08:00 at 07:02', () => {
      jest.useFakeTimers({ now: new Date(2026, 9, 29, 7, 2), doNotFake: ['nextTick', 'setImmediate'] });
      const { result } = renderHook(() =>
        useAddRehearsalForm({ projects: [], selectedProject: null, setSelectedProject: mockSetSelectedProject })
      );

      expect(clock(result.current.startTime)).toBe('08:00');
      expect(result.current.date.getDate()).toBe(29);
    });

    it('after 23:00 the next whole hour is midnight, on the next day', () => {
      jest.useFakeTimers({ now: new Date(2026, 9, 29, 23, 30), doNotFake: ['nextTick', 'setImmediate'] });
      const { result } = renderHook(() =>
        useAddRehearsalForm({ projects: [], selectedProject: null, setSelectedProject: mockSetSelectedProject })
      );

      expect(clock(result.current.startTime)).toBe('00:00');
      expect(result.current.date.getDate()).toBe(30);
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
      expect(result.current.participantsSettled).toBe(false);
    });

    // Review R9-01: picking the project already shown used to empty the
    // participants — on an edit, the saved roster went out empty.
    it('picking the project already shown keeps the participants', () => {
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: mockProjects[0],
          setSelectedProject: mockSetSelectedProject,
          routeParams: { projectId: '1' },
        })
      );
      act(() => {
        result.current.startParticipants('1', ['user1', 'user2']);
      });

      act(() => {
        result.current.handleSelectProject(mockProjects[0]);
      });

      expect(result.current.selectedMemberIds).toEqual(['user1', 'user2']);
      expect(result.current.participantsSettled).toBe(true);
      expect(result.current.showProjectPicker).toBe(false);
    });

    it('an existing rehearsal stays in its project, and its roster is not touched', async () => {
      (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1', projectId: '1', startsAt: '2025-12-29T14:00:00Z', endsAt: '2025-12-29T16:00:00Z' } },
      });
      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({ data: { allParticipants: [{ userId: 'user9' }] } });
      const { result } = renderHook(() =>
        useAddRehearsalForm({
          projects: mockProjects,
          selectedProject: null,
          setSelectedProject: mockSetSelectedProject,
          routeParams: { rehearsalId: 'r1', projectId: '1' },
        })
      );
      expect(result.current.participantsSettled).toBe(false);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(result.current.participantsSettled).toBe(true);

      act(() => {
        result.current.handleSelectProject(mockProjects[2]);
      });

      expect(mockSetSelectedProject).not.toHaveBeenCalledWith(mockProjects[2]);
      expect(result.current.localSelectedProject?.id).toBe('1');
      expect(result.current.selectedMemberIds).toEqual(['user9']);
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

      // On the app stack, beside the form; the Projects tab has no such screen (R9-03).
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
