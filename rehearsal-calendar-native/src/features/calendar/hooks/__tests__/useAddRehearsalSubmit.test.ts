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
import { setProfileTimezone } from '../../../../shared/utils/time';

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
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    setLanguage: jest.fn(),
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', timezone: 'UTC' },
    isAuthenticated: true,
    loading: false,
  }),
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
    title: '', location: 'Studio A',
    selectedMemberIds: [],
    participantsSettled: true,
    membersFailed: false,
    reloadMembers: jest.fn(),
    members: mockMembers,
    memberAvailability: {},
    availabilityReady: true,
    availabilityFailed: false,
    reloadAvailability: jest.fn(),
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
    // A profile in UTC, so the instants read as the clock times picked.
    beforeEach(() => setProfileTimezone('UTC'));
    afterEach(() => setProfileTimezone(null));

    it('an end before the start is the next morning, and is sent so (DF04)', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({ data: { rehearsal: { id: '9' } } });
      // The form opened at 23:00: its end, two hours on, is 01:00 the next day.
      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          date: new Date('2025-12-31T00:00:00'),
          startTime: new Date('2025-12-31T23:00:00'),
          endTime: new Date('2026-01-01T01:00:00'),
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).toHaveBeenCalledWith('1', expect.objectContaining({
        startsAt: '2025-12-31T23:00:00.000Z',
        endsAt: '2026-01-01T01:00:00.000Z',
      }), expect.anything());
    });

    it('only the clock counts: an end Date on the start day before the start is still the next morning', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({ data: { rehearsal: { id: '9' } } });
      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          date: new Date('2025-12-29T00:00:00'),
          startTime: new Date('2025-12-29T22:00:00'),
          endTime: new Date('2025-12-29T00:30:00'),
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).toHaveBeenCalledWith('1', expect.objectContaining({
        startsAt: '2025-12-29T22:00:00.000Z',
        endsAt: '2025-12-30T00:30:00.000Z',
      }), expect.anything());
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
          // An untitled rehearsal must not send an empty string.
          title: undefined,
          location: 'Studio A',
        }),
        expect.any(String)
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
        }),
        expect.any(String)
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

  // A create whose answer was lost reads as a failure and is tapped again.
  // Each tap used to make another rehearsal; the server now creates once per
  // Idempotency-Key, and the form keeps its key for the same request (cause
  // fix 10: D03).
  describe('Idempotency-Key of a create', () => {
    const keysSent = () => (rehearsalsAPI.create as jest.Mock).mock.calls.map((call) => call[2]);
    const submit = async (result: { current: { handleSubmit: () => Promise<void> } }) => {
      await act(async () => {
        await result.current.handleSubmit();
      });
    };

    it('a retry of the same form after a failure sends the same key', async () => {
      (rehearsalsAPI.create as jest.Mock)
        .mockRejectedValueOnce(new Error('timeout of 15000ms exceeded'))
        .mockResolvedValueOnce({ data: { rehearsal: { id: 'r1' } } });
      const { result } = renderHook(() => useAddRehearsalSubmit(defaultProps));

      await submit(result);
      await submit(result);

      const [first, second] = keysSent();
      expect(first).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
      expect(second).toBe(first);
    });

    it('a changed form is a new create, with a new key', async () => {
      (rehearsalsAPI.create as jest.Mock).mockRejectedValue(new Error('timeout'));
      const { result, rerender } = renderHook(
        (props: typeof defaultProps) => useAddRehearsalSubmit(props),
        { initialProps: defaultProps },
      );

      await submit(result);
      rerender({ ...defaultProps, location: 'Studio B' });
      await submit(result);

      const [first, second] = keysSent();
      expect(second).not.toBe(first);
    });

    it('after a success, the next create is a new one even if it asks the same', async () => {
      (rehearsalsAPI.create as jest.Mock).mockResolvedValue({ data: { rehearsal: { id: 'r1' } } });
      const { result } = renderHook(() => useAddRehearsalSubmit(defaultProps));

      await submit(result);
      await submit(result);

      const [first, second] = keysSent();
      expect(second).not.toBe(first);
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
        }),
        expect.any(String)
      );
    });

    // [] clears the roster, undefined keeps it; an edit that unselected
    // everyone used to send undefined and saved nothing (review DF02).
    it('sends an empty list when nobody is selected, so an edit clears the roster (review DF02)', async () => {
      (rehearsalsAPI.update as jest.Mock).mockResolvedValue({
        data: { rehearsal: { id: 'r1' } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          selectedMemberIds: [],
          isEditMode: true,
          rehearsalId: 'r1',
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.update).toHaveBeenCalledWith(
        '1',
        'r1',
        expect.objectContaining({ participant_ids: [] })
      );
    });

    it('says in the app language that someone chosen has left the project', async () => {
      (rehearsalsAPI.update as jest.Mock).mockRejectedValue({
        response: { status: 400, data: { error: 'Participants must be active members of the project',
          code: 'NOT_PROJECT_MEMBERS', userIds: [5] } },
      });

      const { result } = renderHook(() =>
        useAddRehearsalSubmit({
          ...defaultProps,
          t: { ...mockT, rehearsals: { ...mockT.rehearsals, participantsLeft: 'Someone has left' } },
          selectedMemberIds: ['user1'],
          isEditMode: true,
          rehearsalId: 'r1',
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Someone has left');
    });
  });

  // The conflict check reads the availability of the day on the form. Saved
  // while that was still loading — or after it failed — the check ran on the
  // previous day's answer, or on none, and found nobody busy (DF05).
  describe('Availability not yet in hand (DF05)', () => {
    const t = { ...mockT, common: { ...mockT.common, retry: 'Retry' },
      rehearsals: { ...mockT.rehearsals, availabilityChecking: 'Still checking', loadAvailabilityError: 'Could not check' } };

    it('does not save while the availability of the day shown is loading', async () => {
      const props: any = { ...defaultProps, t, selectedMemberIds: ['user1'], availabilityReady: false, availabilityFailed: false };
      const { result } = renderHook(() => useAddRehearsalSubmit(props));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(checkSchedulingConflicts).not.toHaveBeenCalled();
      expect(rehearsalsAPI.create).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Still checking');
    });

    it('does not save over a failed availability load, and offers to try again', async () => {
      const reloadAvailability = jest.fn();
      const props: any = { ...defaultProps, t, selectedMemberIds: ['user1'], availabilityReady: false, availabilityFailed: true, reloadAvailability };
      const { result } = renderHook(() => useAddRehearsalSubmit(props));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(rehearsalsAPI.create).not.toHaveBeenCalled();
      const [, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(message).toBe('Could not check');
      buttons[1].onPress();
      expect(reloadAvailability).toHaveBeenCalled();
    });
  });
});
