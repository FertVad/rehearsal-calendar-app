/**
 * Unit Tests for useRehearsals Hook
 *
 * Tests:
 * - fetchRehearsals with all projects (batch endpoint)
 * - fetchRehearsals with single project
 * - transformRehearsal (ISO to legacy format)
 * - Error handling
 * - Loading states
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRehearsals } from '../useRehearsals';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { Project, Rehearsal } from '../../../../shared/types';
import { formatDateToString, setProfileTimezone } from '../../../../shared/utils/time';

// The profile's zone, as AuthContext sets it with the user.
beforeEach(() => setProfileTimezone('UTC'));

// Mock dependencies
jest.mock('../../../../shared/services/api');

// Dates relative to today. The fixtures used to hardcode December 2025, which
// was in the future when they were written; once it passed, the hook rightly
// stopped fetching RSVPs for them and four tests went red on the calendar
// rather than on any change to the code.
// The local date, as the hook reads it — not toISOString(), the UTC date,
// which west of UTC is a day ahead every evening.
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateToString(d);
};
const SOON = daysFromNow(7);
const SOON_AFTER = daysFromNow(8);

jest.mock('../../../../shared/utils/time', () => ({
  ...jest.requireActual('../../../../shared/utils/time'),
  isoToDateString: (iso: string) => iso.split('T')[0],
  isoToTimeString: (iso: string) => iso.split('T')[1].substring(0, 5),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    setLanguage: jest.fn(),
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
}));
const mockPrime = jest.fn();
jest.mock('../../../../contexts/SeenContext', () => ({
  useSeen: () => ({ prime: mockPrime, beginRead: () => mockPrime }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', timezone: 'UTC' },
    isAuthenticated: true,
    loading: false,
  }),
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
          startsAt: `${SOON}T10:00:00Z`,
          endsAt: `${SOON}T12:00:00Z`,
          location: 'Studio A',
          userResponse: 'yes',
          adminStats: { confirmed: 5, invited: 10 },
        },
        {
          id: 'r2',
          projectId: '2',
          projectName: 'Theater Project',
          startsAt: `${SOON_AFTER}T14:00:00Z`,
          endsAt: `${SOON_AFTER}T16:00:00Z`,
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
        date: SOON,
        time: '10:00',
        endTime: '12:00',
      });

      // Seen state now lives in the shared store, so what matters is what the
      // hook handed over rather than what it kept. r2 is not seen, and says
      // so: left out, a mark taken back on another device stayed on here after
      // a successful refresh (HN02).
      expect(mockPrime).toHaveBeenCalledWith(
        { r1: 'yes', r2: null },
        { r1: { confirmed: 5, invited: 10 } }
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    // "All projects" still loading when one project is picked: the project's
    // answer comes first, then the old one — which must not replace it (DF06).
    it('keeps the chosen project\'s rehearsals when the earlier filter answers last (DF06)', async () => {
      let answerAll!: (value: unknown) => void;
      (rehearsalsAPI.getBatch as jest.Mock).mockReturnValue(new Promise((resolve) => { answerAll = resolve; }));
      (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
        data: { rehearsals: [{ id: 'p2', startsAt: `${SOON}T10:00:00Z`, endsAt: `${SOON}T12:00:00Z` }] },
      });
      (rehearsalsAPI.getMyResponse as jest.Mock).mockResolvedValue({ data: { response: null } });

      const { result, rerender } = renderHook(
        ({ filter }: { filter: string | null }) => useRehearsals(mockProjects, filter),
        { initialProps: { filter: null as string | null } }
      );

      let allLoad!: Promise<void>;
      act(() => { allLoad = result.current.fetchRehearsals(true); });
      rerender({ filter: '2' });
      await act(async () => { await result.current.fetchRehearsals(true); });
      expect(result.current.rehearsals.map((r) => r.id)).toEqual(['p2']);

      await act(async () => {
        answerAll({ data: { rehearsals: [
          { id: 'r1', projectId: '1', startsAt: `${SOON}T10:00:00Z`, endsAt: `${SOON}T12:00:00Z`, userResponse: 'yes' },
          { id: 'p2', projectId: '2', startsAt: `${SOON}T10:00:00Z`, endsAt: `${SOON}T12:00:00Z` },
        ] } });
        await allLoad;
      });

      expect(result.current.rehearsals.map((r) => r.id)).toEqual(['p2']);
      expect(mockPrime).toHaveBeenCalledTimes(1);
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
      expect(mockPrime).toHaveBeenCalledWith({}, {});
    });
  });

  describe('fetchRehearsals - Single Project', () => {
    it('should fetch rehearsals for specific project', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: `${SOON}T10:00:00Z`,
          endsAt: `${SOON}T12:00:00Z`,
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
        date: SOON,
      });

      // Should fetch RSVP for upcoming rehearsals
      expect(rehearsalsAPI.getMyResponse).toHaveBeenCalledWith('r1');
      expect(rehearsalsAPI.getResponses).toHaveBeenCalledWith('r1');
      expect(mockPrime).toHaveBeenCalledWith(
        { r1: 'yes' },
        { r1: { confirmed: 5, invited: 10 } }
      );
    });

    it('should not fetch admin stats for non-admin projects', async () => {
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: `${SOON}T10:00:00Z`,
          endsAt: `${SOON}T12:00:00Z`,
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
      // No answer row is "not seen", said out loud (HN02).
      expect(mockPrime).toHaveBeenCalledWith({ r1: null }, {});
    });

    it('should only fetch RSVP for upcoming rehearsals', async () => {
      // Two days back, not one. The hook dates a rehearsal in the profile's
      // zone (UTC here) and "today" in the device's; a day back is still today
      // in UTC every evening west of it. That split is cause fix 14's to remove
      // (audit/TRIAGE_R4_R9.md); this test is about past rehearsals.
      const past = new Date();
      past.setDate(past.getDate() - 2);

      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: past.toISOString(),
          endsAt: past.toISOString(),
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

    // The last project deleted while a load was out: the empty list drops that
    // load, its `finally` with it, and the spinner turned forever (review).
    it('ends the loading when the last project goes while a load is out', async () => {
      let answer!: (value: unknown) => void;
      (rehearsalsAPI.getBatch as jest.Mock).mockReturnValue(new Promise((resolve) => { answer = resolve; }));
      const { result, rerender } = renderHook(
        ({ projects }: { projects: Project[] }) => useRehearsals(projects, null),
        { initialProps: { projects: mockProjects } }
      );

      let load!: Promise<void>;
      act(() => { load = result.current.fetchRehearsals(true); });
      expect(result.current.loading).toBe(true);

      rerender({ projects: [] });
      await act(async () => { await result.current.fetchRehearsals(true); });
      await act(async () => { answer({ data: { rehearsals: [] } }); await load; });

      expect(result.current.loading).toBe(false);
      expect(result.current.refreshing).toBe(false);
      expect(result.current.rehearsals).toEqual([]);
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
      expect(consoleError).toHaveBeenCalledWith(
        '[ERROR] Failed to fetch rehearsals:',
        expect.objectContaining({ name: 'Error', message: 'Network error' }),
      );

      consoleError.mockRestore();
    });

    it('should handle RSVP fetch errors without failing', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const mockRehearsals = [
        {
          id: 'r1',
          startsAt: `${SOON}T10:00:00Z`,
          endsAt: `${SOON}T12:00:00Z`,
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
        expect.objectContaining({ name: 'Error', message: 'RSVP fetch failed' })
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

    // DD02: one running past midnight is on the next day too, and says so —
    // even when the server sent the legacy fields, which name the start's day.
    it('a rehearsal past midnight carries its last day', async () => {
      (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({
        data: { rehearsals: [
          { id: 'night', startsAt: '2026-09-10T23:00:00Z', endsAt: '2026-09-11T01:00:00Z',
            date: '2026-09-10', time: '23:00:00', endTime: '01:00:00' },
          { id: 'late', startsAt: '2026-09-10T22:00:00Z', endsAt: '2026-09-11T00:00:00Z' },
        ] },
      });

      const { result } = renderHook(() => useRehearsals(mockProjects, null));
      await act(async () => {
        await result.current.fetchRehearsals();
      });

      const byId = Object.fromEntries(result.current.rehearsals.map((r) => [r.id, r]));
      expect(byId.night).toMatchObject({ date: '2026-09-10', endDate: '2026-09-11', time: '23:00', endTime: '01:00' });
      // Ending at midnight, it is over by the next day.
      expect(byId.late).toMatchObject({ date: '2026-09-10', endDate: '2026-09-10' });
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

});
