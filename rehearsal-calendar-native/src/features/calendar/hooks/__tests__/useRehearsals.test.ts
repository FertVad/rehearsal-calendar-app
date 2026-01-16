/**
 * Unit Tests for useRehearsals Hook
 *
 * Tests:
 * - fetchRehearsals with all projects (batch endpoint)
 * - fetchRehearsals with single project
 * - transformRehearsal (ISO to legacy format)
 * - updateAdminStats
 * - Error handling
 * - Loading states
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRehearsals } from '../useRehearsals';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { Project, Rehearsal } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('../../../../shared/utils/time', () => ({
  ...jest.requireActual('../../../../shared/utils/time'),
  isoToDateString: (iso: string) => iso.split('T')[0],
  isoToTimeString: (iso: string) => iso.split('T')[1].substring(0, 5),
}));

describe('useRehearsals Hook', () => {
  const mockProjects: Project[] = [
    {
      id: '1',
      name: 'Band Project',
      description: 'Rock band',
      is_admin: true,
      timezone: 'UTC',
    },
    {
      id: '2',
      name: 'Theater Project',
      description: 'Drama',
      is_admin: false,
      timezone: 'UTC',
    },
  ] as any; // Bypass chat_id type requirement for tests

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchRehearsals - Batch Endpoint (All Projects)', () => {
    it('should fetch rehearsals from all projects using batch endpoint', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          projectId: '1',
          projectName: 'Band Project',
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
          location: 'Studio A',
          userResponse: 'yes',
          adminStats: { confirmed: 5, invited: 10 },
        },
        {
          id: 'r2',
          projectId: '2',
          projectName: 'Theater Project',
          startsAt: '2025-12-30T14:00:00Z',
          endsAt: '2025-12-30T16:00:00Z',
          location: 'Hall',
        },
      ];

      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should call batch endpoint with all project IDs
      expect(rehearsalsAPI.getBatch).toHaveBeenCalledWith(['1', '2']);

      // Should transform and set rehearsals
      expect(result.current.rehearsals).toHaveLength(2);
      expect(result.current.rehearsals[0]).toMatchObject({
        id: 'r1',
        date: '2025-12-29',
        time: '10:00',
        endTime: '12:00',
      });

      // Should extract RSVP responses
      expect(result.current.rsvpResponses).toEqual({
        r1: 'yes',
      });

      // Should extract admin stats
      expect(result.current.adminStats).toEqual({
        r1: { confirmed: 5, invited: 10 },
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty rehearsals array', async () => {
      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: [] },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      expect(result.current.rehearsals).toEqual([]);
      expect(result.current.rsvpResponses).toEqual({});
      expect(result.current.adminStats).toEqual({});
    });
  });

  describe('fetchRehearsals - Single Project', () => {
    it('should fetch rehearsals for specific project', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
          location: 'Studio A',
        },
      ];

      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });

      // Mock RSVP and stats endpoints
      (rehearsalsAPI.getMyResponse as jest.Mock).mockResolvedValue({
        data: { response: { response: 'yes' } },
      });
      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({
        data: { stats: { confirmed: 5, invited: 10 } },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, '1'));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should call single project endpoint
      expect(rehearsalsAPI.getAll).toHaveBeenCalledWith('1');

      // Should add project name to rehearsals
      expect(result.current.rehearsals[0]).toMatchObject({
        id: 'r1',
        projectName: 'Band Project',
        projectId: '1',
        date: '2025-12-29',
      });

      // Should fetch RSVP for upcoming rehearsals
      expect(rehearsalsAPI.getMyResponse).toHaveBeenCalledWith('r1');
      expect(result.current.rsvpResponses).toEqual({ r1: 'yes' });

      // Should fetch admin stats for admin projects
      expect(rehearsalsAPI.getResponses).toHaveBeenCalledWith('r1');
      expect(result.current.adminStats).toEqual({
        r1: { confirmed: 5, invited: 10 },
      });
    });

    it('should not fetch admin stats for non-admin projects', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
        },
      ];

      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });
      (rehearsalsAPI.getMyResponse as jest.Mock).mockResolvedValue({
        data: { response: null },
      });

      // Select project '2' which has is_admin: false
      const { result } = renderHook(() => useRehearsals(mockProjects, '2'));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should fetch RSVP
      expect(rehearsalsAPI.getMyResponse).toHaveBeenCalled();

      // Should NOT fetch admin stats
      expect(rehearsalsAPI.getResponses).not.toHaveBeenCalled();
      expect(result.current.adminStats).toEqual({});
    });

    it('should only fetch RSVP for upcoming rehearsals', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: yesterday.toISOString(),
          endsAt: yesterday.toISOString(),
        },
      ];

      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, '1'));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should NOT fetch RSVP for past rehearsals
      expect(rehearsalsAPI.getMyResponse).not.toHaveBeenCalled();
      expect(rehearsalsAPI.getResponses).not.toHaveBeenCalled();
    });
  });

  describe('fetchRehearsals - Empty Projects', () => {
    it('should clear rehearsals when no projects', async () => {
      const { result } = renderHook(() => useRehearsals([], null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      expect(result.current.rehearsals).toEqual([]);
      expect(rehearsalsAPI.getBatch).not.toHaveBeenCalled();
      expect(rehearsalsAPI.getAll).not.toHaveBeenCalled();
    });
  });

  describe('fetchRehearsals - Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Network error');
      (rehearsalsAPI.getBatch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
      expect(result.current.rehearsals).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith('Failed to fetch rehearsals:', error);

      consoleError.mockRestore();
    });

    it('should handle RSVP fetch errors without failing', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: '2025-12-29T10:00:00Z',
          endsAt: '2025-12-29T12:00:00Z',
        },
      ];

      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });
      (rehearsalsAPI.getMyResponse as jest.Mock).mockRejectedValue(
        new Error('RSVP fetch failed')
      );

      const { result } = renderHook(() => useRehearsals(mockProjects, '1'));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should still set rehearsals
      expect(result.current.rehearsals).toHaveLength(1);
      expect(result.current.error).toBeNull();

      // Should log error
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch RSVP'),
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('fetchRehearsals - Loading States', () => {
    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (rehearsalsAPI.getBatch as jest.Mock).mockReturnValue(promise);

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      // Start fetch
      act(() => {
        result.current.fetchRehearsals();
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      // Resolve promise
      await act(async () => {
        resolvePromise!({ data: { rehearsals: [] } });
        await promise;
      });

      // Should clear loading
      expect(result.current.loading).toBe(false);
    });
  });

  describe('updateAdminStats', () => {
    it('should update admin stats for specific rehearsal', async () => {
      const mockStats = {
        confirmed: 8,
        declined: 1,
        tentative: 2,
        invited: 15,
      };

      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({
        data: { stats: mockStats },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.updateAdminStats('r1');
      });

      expect(rehearsalsAPI.getResponses).toHaveBeenCalledWith('r1');
      expect(result.current.adminStats).toEqual({
        r1: mockStats,
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (rehearsalsAPI.getResponses as jest.Mock).mockRejectedValue(
        new Error('Stats fetch failed')
      );

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.updateAdminStats('r1');
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to update admin stats for r1:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should merge stats with existing ones', async () => {
      const mockStats1 = { confirmed: 5, invited: 10 };
      const mockStats2 = { confirmed: 7, invited: 12 };

      (rehearsalsAPI.getResponses as jest.Mock)
        .mockResolvedValueOnce({ data: { stats: mockStats1 } })
        .mockResolvedValueOnce({ data: { stats: mockStats2 } });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.updateAdminStats('r1');
      });

      await act(async () => {
        await result.current.updateAdminStats('r2');
      });

      expect(result.current.adminStats).toEqual({
        r1: mockStats1,
        r2: mockStats2,
      });
    });
  });

  describe('transformRehearsal', () => {
    it('should transform ISO timestamps to legacy format', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: '2025-12-29T14:30:00Z',
          endsAt: '2025-12-29T16:45:00Z',
          location: 'Studio',
        },
      ];

      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      expect(result.current.rehearsals[0]).toMatchObject({
        id: 'r1',
        date: '2025-12-29',
        time: '14:30',
        endTime: '16:45',
        startsAt: '2025-12-29T14:30:00Z',
        endsAt: '2025-12-29T16:45:00Z',
      });
    });

    it('should keep legacy format if already present', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          date: '2025-12-29',
          time: '14:30',
          endTime: '16:45',
          location: 'Studio',
        },
      ];

      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: mockRehearsals },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      await act(async () => {
        await result.current.fetchRehearsals();
      });

      // Should not modify if already in legacy format
      expect(result.current.rehearsals[0]).toMatchObject({
        id: 'r1',
        date: '2025-12-29',
        time: '14:30',
        endTime: '16:45',
      });
    });
  });

  describe('State Setters', () => {
    it('should allow manual RSVP updates via setRsvpResponses', async () => {
      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      act(() => {
        result.current.setRsvpResponses({
          r1: 'yes',
          r2: null,
        });
      });

      expect(result.current.rsvpResponses).toEqual({
        r1: 'yes',
        r2: null,
      });
    });

    it('should allow manual admin stats updates via setAdminStats', async () => {
      const { result } = renderHook(() => useRehearsals(mockProjects, null));

      act(() => {
        result.current.setAdminStats({
          r1: { confirmed: 10, invited: 20 },
        });
      });

      expect(result.current.adminStats).toEqual({
        r1: { confirmed: 10, invited: 20 },
      });
    });
  });
});
