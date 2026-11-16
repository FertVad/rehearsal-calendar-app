/**
 * Tests for useTimeRecommendations Hook
 * Tests Smart Planner functionality - finding optimal rehearsal times
 */
import { renderHook } from '@testing-library/react-native';
import { useTimeRecommendations } from '../useTimeRecommendations';
import { ProjectMember } from '../../../../shared/types';
import { TimeRange } from '../../../../shared/utils/availability';

describe('useTimeRecommendations - Smart Planner', () => {
  const mockMembers: ProjectMember[] = [
    {
      id: '1',
      userId: 'user-1',
      firstName: 'Alice',
      email: 'alice@test.com',
      role: 'owner',
      status: 'active',
      joinedAt: '2025-01-01',
    },
    {
      id: '2',
      userId: 'user-2',
      firstName: 'Bob',
      email: 'bob@test.com',
      role: 'member',
      status: 'active',
      joinedAt: '2025-01-01',
    },
  ];

  describe('Basic Time Slot Recommendations', () => {
    // T-238: 09:00–23:00 is the working day, not a window to tap.
    it('says everyone is free all day, and offers no window, when no one is busy', () => {
      const memberAvailability = {
        'user-1': { timeRanges: [] },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability)
      );

      expect(result.current).toEqual({ freeAllDay: true, windows: [] });
    });

    it('busy only outside the working day is free all day too', () => {
      const memberAvailability = {
        'user-1': { timeRanges: [{ start: '06:00', end: '08:00', type: 'busy' as const }] },
        'user-2': { timeRanges: [{ start: '14:00', end: '23:00', type: 'available' as const }] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability)
      );

      expect(result.current).toEqual({ freeAllDay: true, windows: [] });
    });

    it('should return empty array when everyone is busy all day', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '23:00', type: 'busy' as const }],
        },
        'user-2': {
          timeRanges: [{ start: '09:00', end: '23:00', type: 'busy' as const }],
        },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toEqual([]);
    });

    it('should return nothing when no members selected', () => {
      const memberAvailability = {};

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', [], memberAvailability)
      );

      expect(result.current).toEqual({ freeAllDay: false, windows: [] });
    });

    it('should return nothing when no date selected', () => {
      const memberAvailability = {
        'user-1': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('', mockMembers, memberAvailability)
      );

      expect(result.current).toEqual({ freeAllDay: false, windows: [] });
    });
  });

  describe('Finding Free Gaps Between Busy Times', () => {
    it('should find morning slot when afternoon is busy', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '14:00', end: '23:00', type: 'busy' as const }],
        },
        'user-2': {
          timeRanges: [{ start: '15:00', end: '23:00', type: 'busy' as const }],
        },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('14:00');
      expect(result.current[0].duration).toBe(5);
    });

    it('should find afternoon slot when morning is busy', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '12:00', type: 'busy' as const }],
        },
        'user-2': {
          timeRanges: [{ start: '09:00', end: '11:00', type: 'busy' as const }],
        },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('12:00');
      expect(result.current[0].endTime).toBe('23:00');
      expect(result.current[0].duration).toBe(11);
    });

    it('should find gap between two busy periods', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '09:00', end: '11:00', type: 'busy' as const },
            { start: '15:00', end: '23:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('11:00');
      expect(result.current[0].endTime).toBe('15:00');
      expect(result.current[0].duration).toBe(4);
    });

    it('should find multiple free gaps', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '10:00', end: '11:00', type: 'busy' as const },
            { start: '14:00', end: '15:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current.length).toBeGreaterThanOrEqual(2);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('10:00');
    });
  });

  describe('Merging Overlapping Busy Times', () => {
    it('should merge overlapping busy ranges', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '10:00', end: '14:00', type: 'busy' as const }],
        },
        'user-2': {
          timeRanges: [{ start: '12:00', end: '16:00', type: 'busy' as const }],
        },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // Should have morning (09:00-10:00) and afternoon (16:00-23:00) slots
      expect(result.current).toHaveLength(2);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('10:00');
      expect(result.current[1].startTime).toBe('16:00');
      expect(result.current[1].endTime).toBe('23:00');
    });

    it('should merge adjacent busy ranges', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '10:00', end: '14:00', type: 'busy' as const }],
        },
        'user-2': {
          timeRanges: [{ start: '14:00', end: '16:00', type: 'busy' as const }],
        },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // Should have morning (09:00-10:00) and afternoon (16:00-23:00) slots
      expect(result.current).toHaveLength(2);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('10:00');
      expect(result.current[1].startTime).toBe('16:00');
      expect(result.current[1].endTime).toBe('23:00');
    });
  });

  describe('Minimum Duration Filtering', () => {
    it('should filter out slots shorter than 1 hour', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '09:00', end: '09:45', type: 'busy' as const },
            { start: '10:00', end: '23:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // 09:45-10:00 is only 15 minutes, should be filtered out
      expect(result.current).toEqual([]);
    });

    it('should include slots exactly 1 hour long', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '09:00', end: '10:00', type: 'busy' as const },
            { start: '11:00', end: '23:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('10:00');
      expect(result.current[0].endTime).toBe('11:00');
      expect(result.current[0].duration).toBe(1);
    });

    it('should include slots longer than 1 hour', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '11:00', type: 'busy' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('11:00');
      expect(result.current[0].endTime).toBe('23:00');
      expect(result.current[0].duration).toBe(12);
    });
  });

  describe('Workday Clamping (09:00-23:00)', () => {
    it('should clamp slot to workday start (09:00)', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '10:00', end: '23:00', type: 'busy' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('10:00');
    });

    it('should clamp slot to workday end (23:00)', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '17:00', type: 'busy' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('17:00');
      expect(result.current[0].endTime).toBe('23:00');
    });

    it('should ignore busy time outside workday hours', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '06:00', end: '08:00', type: 'busy' as const },
            { start: '20:00', end: '23:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // 06:00-08:00 is before the working day: only 20:00 cuts it.
      expect(result.current).toHaveLength(1);
      expect(result.current[0].startTime).toBe('09:00');
      expect(result.current[0].endTime).toBe('20:00');
    });
  });

  describe('Tentative Busy Times', () => {
    it('should treat tentative as busy (conflict)', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '14:00', end: '23:00', type: 'tentative' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // Should exclude tentative time (14:00-23:00)
      expect(result.current).toHaveLength(1);
      expect(result.current[0].endTime).toBe('14:00');
    });

    it('should ignore available type (not a conflict)', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '14:00', end: '23:00', type: 'available' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      // Should NOT exclude available time - free all day, no window
      expect(result.current).toEqual([]);
    });
  });

  describe('Slot Sorting', () => {
    it('should sort slots by start time (ascending)', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [
            { start: '10:00', end: '11:00', type: 'busy' as const },
            { start: '14:00', end: '15:00', type: 'busy' as const },
          ],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current.length).toBeGreaterThanOrEqual(2);
      // First slot should start earliest
      expect(result.current[0].startTime).toBe('09:00');
      // Later slots should have later start times
      for (let i = 1; i < result.current.length; i++) {
        expect(
          result.current[i].startTime.localeCompare(result.current[i - 1].startTime)
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate integer duration for whole hours', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '12:00', type: 'busy' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current[0].duration).toBe(11); // 12:00 to 23:00 = 11 hours
    });

    it('should calculate fractional duration for partial hours', () => {
      const memberAvailability = {
        'user-1': {
          timeRanges: [{ start: '09:00', end: '11:30', type: 'busy' as const }],
        },
        'user-2': { timeRanges: [] },
      };

      const { result } = renderHook(() =>
        useTimeRecommendations('2025-12-29', mockMembers, memberAvailability).windows
      );

      expect(result.current[0].duration).toBe(11.5); // 11:30 to 23:00 = 11.5 hours
    });
  });

  describe('Reactivity to Changes', () => {
    it('should recompute when members change', () => {
      const memberAvailability = {
        'user-1': { timeRanges: [] },
        'user-2': { timeRanges: [{ start: '14:00', end: '23:00', type: 'busy' as const }] },
      };

      const { result, rerender } = renderHook(
        (props: { members: ProjectMember[] }) =>
          useTimeRecommendations('2025-12-29', props.members, memberAvailability),
        { initialProps: { members: [mockMembers[0]] } }
      );

      // Initially one member, free all day
      expect(result.current.freeAllDay).toBe(true);

      // Add second member, busy from 14:00
      rerender({ members: mockMembers });

      expect(result.current.freeAllDay).toBe(false);
      expect(result.current.windows.map(w => w.endTime)).toEqual(['14:00']);
    });

    it('should recompute when availability changes', () => {
      const { result, rerender } = renderHook(
        (props: { availability: Record<string, { timeRanges: TimeRange[] }> }) =>
          useTimeRecommendations('2025-12-29', mockMembers, props.availability),
        {
          initialProps: {
            availability: {
              'user-1': { timeRanges: [] },
              'user-2': { timeRanges: [] },
            },
          },
        }
      );

      // Initially no busy times - free all day
      expect(result.current.freeAllDay).toBe(true);

      // Add busy time
      rerender({
        availability: {
          'user-1': {
            timeRanges: [{ start: '14:00', end: '23:00', type: 'busy' as const }],
          },
          'user-2': { timeRanges: [] },
        },
      });

      // Should recompute with new busy time
      expect(result.current.windows[0].endTime).toBe('14:00');
    });

    it('should recompute when date changes', () => {
      const memberAvailability = {
        'user-1': { timeRanges: [] },
        'user-2': { timeRanges: [] },
      };

      const { result, rerender } = renderHook(
        (props: { date: string }) =>
          useTimeRecommendations(props.date, mockMembers, memberAvailability),
        { initialProps: { date: '2025-12-29' } }
      );

      expect(result.current.freeAllDay).toBe(true);

      // Change date, and none
      rerender({ date: '2025-12-30' });
      expect(result.current.freeAllDay).toBe(true);
      rerender({ date: '' });
      expect(result.current.freeAllDay).toBe(false);
    });
  });
});
