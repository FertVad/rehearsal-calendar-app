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
import { useAvailabilitySave } from '../useAvailabilitySave';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

// The profile's zone, as AuthContext sets it with the user.
beforeEach(() => setProfileTimezone('Asia/Jerusalem'));

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

  // A day the event runs straight through has nothing free left in it, so it is
  // flagged whole-day: the screen says "all day" instead of 00:00–23:59, and the
  // day reads busy rather than partly busy.
  it('flags the days it covers entirely as whole-day', async () => {
    const result = await load([THREE_NIGHTS]);
    const flag = (d: string) =>
      result.current.availability[d].importedSlots?.map((s: any) => s.isAllDay);

    expect(flag('2026-09-03')).toEqual([false]);
    expect(flag('2026-09-04')).toEqual([true]);
    expect(flag('2026-09-05')).toEqual([true]);
    expect(flag('2026-09-06')).toEqual([false]);
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

  // Cause fix 15: the person's own slot past midnight is one slot of the day it
  // starts on, the day that edits and saves it. Cut into 23:00–23:59 plus an
  // own 00:00–01:00, saving that day wrote it back ending at 23:59.
  describe('a hand-entered slot past midnight', () => {
    // 10 September 23:00 → 11 September 01:00 local.
    const OVERNIGHT = {
      startsAt: '2026-09-10T20:00:00.000Z',
      endsAt: '2026-09-10T22:00:00.000Z',
      type: 'busy',
      isAllDay: false,
      source: 'manual',
    };

    it('is one slot of the day it starts, whole', async () => {
      const result = await load([OVERNIGHT]);
      expect(result.current.availability['2026-09-10'].slots).toEqual([{ start: '23:00', end: '01:00' }]);
    });

    it('shows its morning on the next day, read-only', async () => {
      const result = await load([OVERNIGHT]);
      const next = result.current.availability['2026-09-11'];
      expect(next.slots).toEqual([]);
      expect(next.importedSlots).toEqual([
        expect.objectContaining({ start: '00:00', end: '01:00', source: 'previous_day' }),
      ]);
    });

    it('saved back unchanged, is the same interval', async () => {
      const result = await load([OVERNIGHT]);
      const { result: save } = renderHook(() => useAvailabilitySave());
      const [entry] = save.current.entriesForDay('2026-09-10', result.current.availability['2026-09-10']);
      // The device's zone writes it here; the instants are what must match.
      expect(Date.parse(entry.endsAt) - Date.parse(entry.startsAt)).toBe(2 * 60 * 60 * 1000);
    });
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
