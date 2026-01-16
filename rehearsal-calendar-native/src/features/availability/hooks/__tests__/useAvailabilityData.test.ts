/**
 * Unit Tests for useAvailabilityData Hook
 *
 * Tests availability data loading, deduplication, and state management
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { availabilityAPI } from '../../../../shared/services/api';

// Mock dependencies
jest.mock('../../../../shared/services/api');

describe('useAvailabilityData Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading Availability', () => {
    it('should load availability data on mount', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T18:00:00Z',
          type: 'busy',
          isAllDay: false,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      // Should start loading
      expect(result.current.loading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have loaded data
      expect(result.current.availability).toHaveProperty('2025-12-29');
      expect(result.current.availability['2025-12-29'].mode).toBe('custom');
      expect(result.current.availability['2025-12-29'].slots).toHaveLength(1);

      // Times are converted from UTC to local timezone
      const slot = result.current.availability['2025-12-29'].slots[0];
      expect(slot.start).toBe(
        new Date('2025-12-29T10:00:00Z').toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
      expect(slot.end).toBe(
        new Date('2025-12-29T18:00:00Z').toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    });

    it('should handle all-day busy slots', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T00:00:00Z',
          endsAt: '2025-12-29T23:59:59Z',
          type: 'busy',
          isAllDay: true,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availability['2025-12-29'].mode).toBe('busy');
      expect(result.current.availability['2025-12-29'].slots[0]).toEqual({
        start: '00:00',
        end: '23:59',
      });
    });

    it('should handle all-day free/available slots', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T00:00:00Z',
          endsAt: '2025-12-29T23:59:59Z',
          type: 'available',
          isAllDay: true,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availability['2025-12-29'].mode).toBe('free');
    });

    it('should handle multiple time slots for same date', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
          type: 'busy',
          isAllDay: false,
        },
        {
          startsAt: '2025-12-29T14:00:00Z',
          endsAt: '2025-12-29T16:00:00Z',
          type: 'busy',
          isAllDay: false,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availability['2025-12-29'].slots).toHaveLength(2);
      // Times are converted from UTC to local timezone
      expect(result.current.availability['2025-12-29'].slots[0].start).toBe(
        new Date('2025-12-29T10:00:00Z').toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
      expect(result.current.availability['2025-12-29'].slots[0].end).toBe(
        new Date('2025-12-29T12:00:00Z').toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    });

    it('should handle empty response', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availability).toEqual({});
    });

    it('should handle API error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (availabilityAPI.getAll as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load availability:',
        expect.any(Error)
      );
      expect(result.current.availability).toEqual({});

      consoleError.mockRestore();
    });
  });

  describe('Deduplication Logic', () => {
    it('should prioritize rehearsal slots over manual slots with same time range', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const mockData = [
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
          type: 'busy',
          source: 'manual',
        },
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
          type: 'busy',
          source: 'rehearsal',
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only have one slot (duplicate removed)
      expect(result.current.availability['2025-12-29'].slots).toHaveLength(1);

      // Should log the deduplication
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Skipping duplicate manual slot')
      );

      consoleLog.mockRestore();
    });

    it('should keep both slots if time ranges are different', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T08:00:00Z',
          endsAt: '2025-12-29T10:00:00Z',
          type: 'busy',
          source: 'manual',
        },
        {
          startsAt: '2025-12-29T12:00:00Z',
          endsAt: '2025-12-29T14:00:00Z',
          type: 'busy',
          source: 'rehearsal',
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have both slots (different times)
      expect(result.current.availability['2025-12-29'].slots).toHaveLength(2);
    });
  });

  describe('getDayState', () => {
    it('should return state for existing date', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T18:00:00Z',
          type: 'busy',
          isAllDay: false,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const dayState = result.current.getDayState('2025-12-29');
      expect(dayState.mode).toBe('custom');
      expect(dayState.slots).toHaveLength(1);
    });

    it('should return default state for non-existing date', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const dayState = result.current.getDayState('2025-12-30');
      expect(dayState.mode).toBe('free');
      expect(dayState.slots).toEqual([{ start: '10:00', end: '18:00' }]);
    });
  });

  describe('Manual Reload', () => {
    it('should allow manual reload of availability data', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(availabilityAPI.getAll).toHaveBeenCalledTimes(1);

      // Reload
      await act(async () => {
        await result.current.loadAvailability();
      });

      expect(availabilityAPI.getAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('Legacy Format Support', () => {
    it('should handle legacy date field instead of startsAt', async () => {
      const mockData = [
        {
          date: '2025-12-29',
          start_time: '10:00',
          end_time: '18:00',
          type: 'busy',
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availability['2025-12-29']).toBeDefined();
      expect(result.current.availability['2025-12-29'].slots[0]).toEqual({
        start: '10:00',
        end: '18:00',
      });
    });

    it('should strip seconds from time strings', async () => {
      const mockData = [
        {
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T18:00:00Z',
          type: 'busy',
          isAllDay: false,
        },
      ];

      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should be HH:MM format (times converted from UTC to local)
      const startTime = result.current.availability['2025-12-29'].slots[0].start;
      const endTime = result.current.availability['2025-12-29'].slots[0].end;

      // Should match HH:MM format
      expect(startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(endTime).toMatch(/^\d{2}:\d{2}$/);

      // Should not have seconds
      expect(startTime).not.toContain(':00:');
      expect(endTime).not.toContain(':00:');
    });
  });

  describe('State Management', () => {
    it('should allow setting availability manually', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newAvailability = {
        '2025-12-30': {
          mode: 'busy' as const,
          slots: [{ start: '00:00', end: '23:59' }],
        },
      };

      act(() => {
        result.current.setAvailability(newAvailability);
      });

      expect(result.current.availability).toEqual(newAvailability);
    });

    it('should track hasChanges flag', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasChanges).toBe(false);

      act(() => {
        result.current.setHasChanges(true);
      });

      expect(result.current.hasChanges).toBe(true);
    });

    it('should track saving flag', async () => {
      (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailabilityData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.saving).toBe(false);

      act(() => {
        result.current.setSaving(true);
      });

      expect(result.current.saving).toBe(true);
    });
  });
});
