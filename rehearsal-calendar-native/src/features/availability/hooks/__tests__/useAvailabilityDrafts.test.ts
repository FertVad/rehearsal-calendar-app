/**
 * The days being edited belong to the person, not to the last load
 * (review CC02, CC03).
 *
 * Coming back to the tab or pulling to refresh used to replace everything with
 * what the server said, unsaved edits included. And a save marked the whole
 * screen saved when it finished, so an edit made while the request was out
 * looked saved and was gone after the next load.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

// The profile's zone, as AuthContext sets it with the user.
beforeEach(() => setProfileTimezone('UTC'));

jest.mock('../../../../shared/services/api');
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ language: 'ru', t: jest.requireActual('../../../../i18n/translations').ru }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', timezone: 'UTC' }, isAuthenticated: true, loading: false }),
}));

const busy = (date: string, from: string, to: string) => ({
  startsAt: `${date}T${from}:00.000Z`, endsAt: `${date}T${to}:00.000Z`, type: 'busy', isAllDay: false, source: 'manual',
});

const load = async () => {
  const { result } = renderHook(() => useAvailabilityData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('availability-cache');
});

it('a reload keeps the days being edited and refreshes the rest (review CC02)', async () => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
    data: [busy('2026-10-01', '10:00', '12:00'), busy('2026-10-02', '10:00', '12:00')],
  });
  const result = await load();

  act(() => {
    result.current.setAvailability((prev) => ({ ...prev, '2026-10-01': { mode: 'busy', slots: [] } }));
    result.current.markChanged(['2026-10-01']);
  });
  expect(result.current.hasChanges).toBe(true);

  // Meanwhile another device changed the 2nd.
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({
    data: [busy('2026-10-01', '10:00', '12:00'), busy('2026-10-02', '14:00', '16:00')],
  });
  await act(async () => { await result.current.loadAvailability(); });

  expect(result.current.availability['2026-10-01']).toEqual({ mode: 'busy', slots: [] });
  expect(result.current.availability['2026-10-02'].slots).toEqual([{ start: '14:00', end: '16:00' }]);
  expect(result.current.hasChanges).toBe(true);
});

it('keeps them when the reload falls back to the copy on the device, too', async () => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [busy('2026-10-01', '10:00', '12:00')] });
  const result = await load();

  act(() => {
    result.current.setAvailability((prev) => ({ ...prev, '2026-10-01': { mode: 'free', slots: [] } }));
    result.current.markChanged(['2026-10-01']);
  });
  (availabilityAPI.getAll as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { await result.current.loadAvailability(); });

  expect(result.current.availability['2026-10-01']).toEqual({ mode: 'free', slots: [] });
});

it('a save marks saved only the edits it sent: one made meanwhile stays unsaved (review CC03)', async () => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [] });
  const result = await load();

  act(() => { result.current.markChanged(['2026-10-01', '2026-10-02']); });
  const sent = { ...result.current.changed };
  // Edited again while the save was out.
  act(() => { result.current.markChanged(['2026-10-01']); });
  act(() => { result.current.markSaved(sent); });

  expect(Object.keys(result.current.changed)).toEqual(['2026-10-01']);
  expect(result.current.hasChanges).toBe(true);
});
