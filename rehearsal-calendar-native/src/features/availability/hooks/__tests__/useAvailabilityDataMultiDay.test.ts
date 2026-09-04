/**
 * A record that spans more than one day has to appear on all of them.
 *
 * The grid holds one list of HH:mm ranges per day, so a stored instant range
 * must be cut up and clipped to each day it covers. It used to be filed under
 * its start date alone, taking the *end's* time-of-day with it — so an imported
 * calendar event running 3 September 20:00 to 6 September 21:00 showed up as
 * "3 September, 20:00–21:00" and left the 4th, 5th and 6th looking free.
 *
 * That is how two periods marked in the phone's calendar could import
 * correctly, sit in the database, and be invisible on the screen: both were
 * multi-day, so all anyone saw was a one-hour sliver on the first day of each.
 * Observed against production on 2026-09-04; the two rows below are that data.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { availabilityAPI } from '../../../../shared/services/api';

jest.mock('../../../../shared/services/api');
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    setLanguage: jest.fn(),
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', timezone: 'Asia/Jerusalem' },
    isAuthenticated: true,
    loading: false,
  }),
}));

const load = async (data: unknown[]) => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data });
  const { result } = renderHook(() => useAvailabilityData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
};

const imported = (day: any) =>
  (day?.importedSlots ?? []).map((s: any) => `${s.start}-${s.end}`);

describe('A multi-day calendar event, read in Jerusalem', () => {
  // 3 September 20:00 → 6 September 21:00 local.
  const THREE_NIGHTS = {
    startsAt: '2026-09-03T17:00:00.000Z',
    endsAt: '2026-09-06T18:00:00.000Z',
    type: 'busy',
    isAllDay: false,
    source: 'apple_calendar',
  };

  it('appears on every day it covers, not only the first', async () => {
    const result = await load([THREE_NIGHTS]);
    const days = Object.keys(result.current.availability).sort();

    expect(days).toEqual(['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
  });

  it('is clipped to each day', async () => {
    const result = await load([THREE_NIGHTS]);
    const a = result.current.availability;

    expect(imported(a['2026-09-03'])).toEqual(['20:00-23:59']);
    expect(imported(a['2026-09-04'])).toEqual(['00:00-23:59']);
    expect(imported(a['2026-09-05'])).toEqual(['00:00-23:59']);
    expect(imported(a['2026-09-06'])).toEqual(['00:00-21:00']);
  });

  it('stays read-only — it is not turned into hand-entered slots', async () => {
    const result = await load([THREE_NIGHTS]);

    for (const day of ['2026-09-03', '2026-09-04', '2026-09-06']) {
      expect(result.current.availability[day].slots).toHaveLength(0);
    }
  });

  it('leaves a single-day event exactly as it was', async () => {
    const result = await load([
      {
        startsAt: '2026-09-05T18:00:00.000Z',
        endsAt: '2026-09-05T20:00:00.000Z',
        type: 'busy',
        isAllDay: false,
        source: 'apple_calendar',
      },
    ]);

    expect(Object.keys(result.current.availability)).toEqual(['2026-09-05']);
    expect(imported(result.current.availability['2026-09-05'])).toEqual(['21:00-23:00']);
  });

  it('does not leave a sliver when the event ends exactly at midnight', async () => {
    const result = await load([
      {
        // 5 September 22:00 → 6 September 00:00 local.
        startsAt: '2026-09-05T19:00:00.000Z',
        endsAt: '2026-09-05T21:00:00.000Z',
        type: 'busy',
        isAllDay: false,
        source: 'apple_calendar',
      },
    ]);

    // Runs to the end of the 5th and stops there — the 6th gets nothing.
    expect(Object.keys(result.current.availability)).toEqual(['2026-09-05']);
    expect(imported(result.current.availability['2026-09-05'])).toEqual(['22:00-23:59']);
  });

  it('covers every day of a multi-day whole-day entry', async () => {
    const result = await load([
      {
        startsAt: '2026-09-23T00:00:00.000Z',
        endsAt: '2026-09-25T23:59:59.999Z',
        type: 'busy',
        isAllDay: true,
        source: 'apple_calendar',
      },
    ]);

    expect(Object.keys(result.current.availability).sort()).toEqual([
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });
});
