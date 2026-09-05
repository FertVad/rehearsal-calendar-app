/**
 * What the availability screen shows when it cannot reach the server.
 *
 * It used to show an empty screen and, beside it, "mark when you are busy —
 * until you do, everyone sees you as free". Both false: the entries are safe on
 * the server and nobody is being told anything different. The load swallowed
 * its failure and left the state empty, and an empty state is what the banner
 * reads.
 *
 * The unread count is stored on the device for exactly this reason. Availability
 * is now too, so a start with no network shows the last that loaded rather than
 * nothing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { availabilityAPI } from '../../../../shared/services/api';

jest.mock('../../../../shared/services/api');
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ language: 'ru', t: jest.requireActual('../../../../i18n/translations').ru }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', timezone: 'Europe/Berlin' }, isAuthenticated: true, loading: false }),
}));

const record = {
  startsAt: '2026-10-01T08:00:00.000Z',
  endsAt: '2026-10-01T10:00:00.000Z',
  type: 'busy',
  isAllDay: false,
  source: 'manual',
};

const load = async () => {
  const { result } = renderHook(() => useAvailabilityData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('availability-cache');
});

describe('When the server answers', () => {
  it('shows what it said, and says the load worked', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [record] });

    const result = await load();

    expect(result.current.loadFailed).toBe(false);
    expect(Object.keys(result.current.availability)).toHaveLength(1);
  });

  it('keeps a copy for next time', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [record] });

    await load();

    expect(await AsyncStorage.getItem('availability-cache')).toContain('2026-10-01');
  });
});

describe('When it does not', () => {
  it('says so, rather than letting an empty screen speak for it', async () => {
    (availabilityAPI.getAll as jest.Mock).mockRejectedValue(new Error('offline'));

    const result = await load();

    expect(result.current.loadFailed).toBe(true);
  });

  it('shows the last that loaded instead of nothing', async () => {
    (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [record] });
    await load();

    (availabilityAPI.getAll as jest.Mock).mockRejectedValue(new Error('offline'));
    const offline = await load();

    expect(Object.keys(offline.current.availability)).toHaveLength(1);
    expect(offline.current.loadFailed).toBe(true);
  });

  it('is honest when there is nothing cached either', async () => {
    (availabilityAPI.getAll as jest.Mock).mockRejectedValue(new Error('offline'));

    const result = await load();

    expect(result.current.availability).toEqual({});
    expect(result.current.loadFailed).toBe(true);
  });
});
