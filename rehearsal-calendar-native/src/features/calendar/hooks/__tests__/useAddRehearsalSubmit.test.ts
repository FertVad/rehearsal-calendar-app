/**
 * Unit Tests for useAddRehearsalSubmit Hook
 *
 * Tests validation, conflict detection, create/edit operations
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAddRehearsalSubmit } from '../useAddRehearsalSubmit';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { checkSchedulingConflicts } from '../../../../shared/utils/conflictDetection';
import { getSyncSettings } from '../../../../shared/utils/calendarStorage';
import { syncRehearsalToCalendar } from '../../../../shared/services/calendar';
import { Project, ProjectMember } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('../../../../shared/utils/conflictDetection');
jest.mock('../../../../shared/utils/calendarStorage');
jest.mock('../../../../shared/services/calendar');
jest.mock('expo-calendar');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useAddRehearsalSubmit Hook', () => {
  const mockProject: Project = {
    id: '1',
    name: 'Band Project',
    is_admin: true,
  } as any;

  const mockMembers: ProjectMember[] = [
    { userId: 'user1', name: 'Alice', role: 'member' },
    { userId: 'user2', name: 'Bob', role: 'member' },
  ] as any;

  const mockT = {
    common: {
      error: 'Error',
      cancel: 'Cancel',
    },
    rehearsals: {
      success: 'Success',
      rehearsalCreated: 'Rehearsal created',
      rehearsalUpdated: 'Rehearsal updated',
      createError: 'Failed to create',
      updateError: 'Failed to update',
      projectNotSelected: 'Please select a project',
      endTimeError: 'End time must be after start time',
      scheduleConflict: 'Schedule Conflict',
      scheduleConflictMessage: 'Continue anyway?',
      createAnyway: 'Create Anyway',
    },
  };

  const defaultProps = {
    localSelectedProject: mockProject,
    date: new Date('2025-12-29'),
    startTime: new Date('2025-12-29T14:00:00'),
    endTime: new Date('2025-12-29T16:00:00'),
    location: 'Studio A',
    selectedMemberIds: [],
    members: mockMembers,
    memberAvailability: {},
    resetForm: jest.fn(),
    t: mockT,
    isEditMode: false,
    rehearsalId: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSyncSettings as jest.Mock).mockResolvedValue({
      exportEnabled: false,
      exportCalendarId: null,
    });
    (checkSchedulingConflicts as jest.Mock).mockReturnValue({
      hasConflicts: false,
      fullyBusy: [],
      partiallyBusy: [],
    });
  });

  describe('Validation - Project Not Selected', () => {
    it('should show error when project not selected', async () => {
      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          localSelectedProject: null,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Please select a project'
      );
      expect(rehearsalsAPI.create).not.toHaveBeenCalled();
    });
  });

  describe('Validation - End Time Before Start Time', () => {
    it('should show error when end time <= start time', async () => {
      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          startTime: new Date('2025-12-29T16:00:00'),
          endTime: new Date('2025-12-29T14:00:00'), // Before start
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'End time must be after start time'
      );
      expect(rehearsalsAPI.create).not.toHaveBeenCalled();
    });

    it('should show error when end time equals start time', async () => {
      const sameTime = new Date('2025-12-29T14:00:00');
      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          startTime: sameTime,
          endTime: sameTime,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'End time must be after start time'
      );
    });
  });

  describe('Conflict Detection', () => {
    it('should show warning when conflicts detected', async () => {
      (checkSchedulingConflicts as jest.Mock).mockReturnValue({
        hasConflicts: true,
        fullyBusy: ['Alice'],
        partiallyBusy: [],
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          selectedMemberIds: ['user1', 'user2'],
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      // Should show conflict alert with two buttons
      expect(Alert.alert).toHaveBeenCalledWith(
        'Schedule Conflict',
        expect.stringContaining('Continue anyway?'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Create Anyway' }),
        ])
      );

      // Should not create immediately
      expect(rehearsalsAPI.create).not.toHaveBeenCalled();
    });

    it('should skip conflict check when no members selected', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          selectedMemberIds: [], // No members
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(checkSchedulingConflicts).not.toHaveBeenCalled();
      expect(rehearsalsAPI.create).toHaveBeenCalled();
    });
  });

  describe('Create Mode - Successful Creation', () => {
    it('should create rehearsal successfully', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const mockGoBack = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        goBack: mockGoBack,
      });

      const mockResetForm = jest.fn();

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          resetForm: mockResetForm,
        })
      );

      expect(result.current.loading).toBe(false);

      await act(async () => {
        await result.current.handleSubmit();
      });

      // Should call API with correct data
      expect(rehearsalsAPI.create).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          startsAt: expect.any(String),
          endsAt: expect.any(String),
          location: 'Studio A',
        })
      );

      // Should show success alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Rehearsal created',
        expect.arrayContaining([
          expect.objectContaining({ text: 'OK' }),
        ])
      );
    });

    it('should handle empty location (trim and set to undefined)', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          location: '   ', // Whitespace only
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          location: undefined, // Should be undefined, not empty string
        })
      );
    });

    it('should set loading state during creation', async () => {
      let resolveCreate: any;
      (rehearsalsAPI.create as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.handleSubmit();
      });

      // Should be loading during API call
      expect(result.current.loading).toBe(true);

      // Resolve the API call
      await act(async () => {
        resolveCreate({ data: { rehearsal: { id: 'r1' } } });
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Edit Mode - Successful Update', () => {
    it('should update rehearsal in edit mode', async () => {
      (rehearsalsAPI.update as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          isEditMode: true,
          rehearsalId: 'r1',
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      // Should call update API, not create
      expect(rehearsalsAPI.update).toHaveBeenCalledWith(
        '1',
        'r1',
        expect.objectContaining({
          startsAt: expect.any(String),
          endsAt: expect.any(String),
        })
      );
      expect(rehearsalsAPI.create).not.toHaveBeenCalled();

      // Should show update success message
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Rehearsal updated',
        expect.any(Array)
      );
    });
  });

  describe('Calendar Auto-Sync', () => {
    it('should sync to calendar when export is enabled', async () => {
      (getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: true,
        exportCalendarId: 'cal123',
      });

      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(syncRehearsalToCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'r1',
          projectId: '1',
          projectName: 'Band Project',
        }),
        'cal123'
      );
    });

    it('should not sync when export is disabled', async () => {
      (getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: false,
        exportCalendarId: null,
      });

      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(syncRehearsalToCalendar).not.toHaveBeenCalled();
    });

    it('should not fail if sync fails', async () => {
      (getSyncSettings as jest.Mock).mockResolvedValue({
        exportEnabled: true,
        exportCalendarId: 'cal123',
      });

      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      (syncRehearsalToCalendar as jest.Mock).mockRejectedValue(
        new Error('Sync failed')
      );

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      // Should still show success even if sync failed
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Rehearsal created',
        expect.any(Array)
      );
    });
  });

  describe('Error Handling', () => {
    it('should show error alert on creation failure', async () => {
      (rehearsalsAPI.create as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Network error'
      );
      expect(result.current.loading).toBe(false);
    });

    it('should show API error message when available', async () => {
      (rehearsalsAPI.create as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: 'Project not found',
          },
        },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit(defaultProps)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Project not found'
      );
    });

    it('should show update error in edit mode', async () => {
      (rehearsalsAPI.update as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          isEditMode: true,
          rehearsalId: 'r1',
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Update failed'
      );
    });
  });

  describe('Member Participant IDs', () => {
    it('should include participant_ids when members selected', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          selectedMemberIds: ['user1', 'user2'],
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          participant_ids: ['user1', 'user2'],
        })
      );
    });

    it('should set participant_ids to undefined when no members selected', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          selectedMemberIds: [],
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          participant_ids: undefined,
        })
      );
    });
  });
});
