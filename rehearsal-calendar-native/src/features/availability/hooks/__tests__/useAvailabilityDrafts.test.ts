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
import { Animated } from 'react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { useAvailabilityEditor } from '../useAvailabilityEditor';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

// The profile's zone, as AuthContext sets it with the user.
beforeEach(() => setProfileTimezone('UTC'));

jest.mock('../../../../shared/services/api');
// The editor animates its panel; nothing here is about that.
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);
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
  act(() => { result.current.markSaved(sent, {}); });

  expect(Object.keys(result.current.changed)).toEqual(['2026-10-01']);
  expect(result.current.hasChanges).toBe(true);
});

describe('What leaving would lose: a day saying something else than the server (T-013, review)', () => {
  // The screen's two hooks together, as AvailabilityScreen joins them.
  const open = async () => {
    const { result } = renderHook(() => {
      const data = useAvailabilityData();
      const editor = useAvailabilityEditor({
        availability: data.availability,
        setAvailability: data.setAvailability,
        markChanged: data.markChanged,
        markSettled: data.markSettled,
        today: '2026-09-20',
        getDayState: data.getDayState,
        months: [{ year: 2026, month: 9, key: '2026-9' }],
      });
      return { data, editor };
    });
    await waitFor(() => expect(result.current.data.loading).toBe(false));
    act(() => { result.current.editor.handleDayPress(2026, 9, 1, () => '2026-10-01'); });
    return result;
  };

  it('its hours\' mode picked again changes nothing to lose, though it can still be saved', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [busy('2026-10-01', '10:00', '12:00')] });
    const result = await open();

    act(() => { result.current.editor.handleModeChange('custom'); });

    expect(result.current.data.hasChanges).toBe(true);
    expect(result.current.data.differsFromSaved).toBe(false);
  });

  it('a real change is one, and put back as it was is none', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [{
      startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-01T23:59:59.999Z', type: 'busy', isAllDay: true, source: 'manual',
    }] });
    const result = await open();

    act(() => { result.current.editor.handleModeChange('free'); });
    expect(result.current.data.differsFromSaved).toBe(true);

    act(() => { result.current.editor.handleModeChange('busy'); });
    expect(result.current.data.differsFromSaved).toBe(false);
  });

  it('other hours on a day of hours are a change', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [busy('2026-10-01', '10:00', '12:00')] });
    const result = await open();

    act(() => { result.current.editor.addSlot(); });

    expect(result.current.data.differsFromSaved).toBe(true);
  });

  it('an untouched day marked free is a change: the server holds nothing for it', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [] });
    const result = await open();

    act(() => { result.current.editor.handleModeChange('free'); });

    expect(result.current.data.differsFromSaved).toBe(true);
  });

  it('after a save, a day is compared with what was sent: an edit made meanwhile still differs', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [] });
    const result = await open();

    act(() => { result.current.editor.handleModeChange('busy'); });
    const sent = { ...result.current.data.changed };
    const sentDays = { ...result.current.data.availability };
    // Changed again while the save was out.
    act(() => { result.current.editor.handleModeChange('free'); });
    act(() => { result.current.data.markSaved(sent, sentDays); });
    expect(result.current.data.differsFromSaved).toBe(true);

    // And back to what was sent: nothing to lose.
    act(() => { result.current.editor.handleModeChange('busy'); });
    expect(result.current.data.differsFromSaved).toBe(false);
  });
});
