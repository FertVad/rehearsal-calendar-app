/**
 * Which day a whole-day entry belongs to.
 *
 * A whole-day entry is written as `${localDate}T00:00:00.000Z` — UTC midnight
 * standing for a calendar date rather than for an instant. That is the
 * convention across the app and the key the server's delete uses. Reading it
 * back through a timezone conversion therefore moved it: for anyone at a
 * negative UTC offset, marking 10 September stored a value whose local date was
 * 9 September, so the screen showed 9 September marked and 10 September free —
 * and each save after a reload walked the entry another day earlier.
 *
 * Nobody east of UTC ever saw it, which is why it lasted: the users are in
 * Berlin, Moscow and Jerusalem, where the two dates agree. The App Store does
 * not stop at those.
 *
 * The existing useAvailabilityData tests mock the timezone as UTC, where the
 * bug is invisible by construction, so this file carries its own.
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
    user: { id: 'test-user', timezone: 'America/New_York' },
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

describe('A whole-day entry, read from five hours behind UTC', () => {
  it('lands on the day it was marked', async () => {
    const result = await load([
      {
        startsAt: '2026-09-10T00:00:00.000Z',
        endsAt: '2026-09-10T23:59:59.999Z',
        type: 'busy',
        isAllDay: true,
      },
    ]);

    expect(Object.keys(result.current.availability)).toContain('2026-09-10');
    expect(Object.keys(result.current.availability)).not.toContain('2026-09-09');
  });

  it('is read as covering the whole day', async () => {
    // A whole-day marking is the day's MODE, not a slot. It used to be carried
    // as a 00:00–23:59 row as well, which showed up as an editable line and was
    // written back as timed hours.
    const result = await load([
      {
        startsAt: '2026-09-10T00:00:00.000Z',
        endsAt: '2026-09-10T23:59:59.999Z',
        type: 'busy',
        isAllDay: true,
      },
    ]);

    const day = result.current.availability['2026-09-10'];
    expect(day?.mode).toBe('busy');
    expect(day?.slots).toHaveLength(0);
  });

  it('accepts the snake_case spelling the server sometimes sends', async () => {
    const result = await load([
      {
        startsAt: '2026-09-10T00:00:00.000Z',
        endsAt: '2026-09-10T23:59:59.999Z',
        type: 'busy',
        is_all_day: true,
      },
    ]);

    expect(Object.keys(result.current.availability)).toContain('2026-09-10');
  });
});

describe('A timed entry, from the same place', () => {
  it('still converts into the reader zone, because it names an instant', async () => {
    // 02:00 UTC on 11 September is 22:00 on the 10th in New York. Reading this
    // one as its UTC date would be the mirror of the bug above.
    const result = await load([
      {
        startsAt: '2026-09-11T02:00:00.000Z',
        endsAt: '2026-09-11T03:00:00.000Z',
        type: 'busy',
        isAllDay: false,
      },
    ]);

    expect(Object.keys(result.current.availability)).toContain('2026-09-10');
  });

  it('keeps its own hours', async () => {
    const result = await load([
      {
        startsAt: '2026-09-10T14:00:00.000Z',
        endsAt: '2026-09-10T16:00:00.000Z',
        type: 'busy',
        isAllDay: false,
      },
    ]);

    const day = result.current.availability['2026-09-10'];
    expect(day?.slots?.[0]).toMatchObject({ start: '10:00', end: '12:00' });
  });
});

describe('A day holding both kinds', () => {
  it('files them under the same date', async () => {
    // After the fix the two are keyed differently — one by its UTC date, one by
    // conversion — so a day with both is where they could come apart.
    const result = await load([
      {
        startsAt: '2026-09-10T00:00:00.000Z',
        endsAt: '2026-09-10T23:59:59.999Z',
        type: 'busy',
        isAllDay: true,
      },
      {
        startsAt: '2026-09-10T18:00:00.000Z',
        endsAt: '2026-09-10T20:00:00.000Z',
        type: 'busy',
        isAllDay: false,
      },
    ]);

    const day = result.current.availability['2026-09-10'];
    expect(day?.mode).toBe('busy');
    // The whole-day row became the mode; the timed one is kept rather than
    // discarded, so switching the mode does not lose it.
    expect(day?.slots).toHaveLength(1);
    expect(day?.slots[0]).toMatchObject({ start: '14:00', end: '16:00' });
  });
});

describe('What the day shows when the phone calendar disagrees', () => {
  const free = {
    startsAt: '2026-09-10T00:00:00.000Z',
    endsAt: '2026-09-10T23:59:59.999Z',
    type: 'available',
    isAllDay: true,
    source: 'manual',
  };
  const calendarEvent = {
    startsAt: '2026-09-10T18:00:00.000Z',
    endsAt: '2026-09-10T19:00:00.000Z',
    type: 'busy',
    isAllDay: false,
    source: 'apple_calendar',
  };

  it('does not claim the day is free when the calendar says otherwise', async () => {
    // The screen used to read "free all day" while the endpoint that feeds
    // everyone else's planner reported the event as busy. The owner was the one
    // person not shown it.
    const result = await load([free, calendarEvent]);

    expect(result.current.availability['2026-09-10']?.mode).toBe('custom');
  });

  it('shows the event, and says where it came from', async () => {
    const result = await load([free, calendarEvent]);

    const day = result.current.availability['2026-09-10'];
    expect(day?.importedSlots).toHaveLength(1);
    expect(day?.importedSlots?.[0]).toMatchObject({ source: 'apple_calendar' });
  });

  it('keeps it out of the slots a save would write', async () => {
    // Everything in `slots` is written back as a hand-entered row, so an
    // imported event sitting there would be copied into a manual one on every
    // save, and multiply.
    const result = await load([free, calendarEvent]);

    expect(result.current.availability['2026-09-10']?.slots).toHaveLength(0);
  });

  it('leaves a day declared busy declared busy', async () => {
    // Busy all day already covers the event. Nothing is being hidden, so the
    // declaration stands rather than being rewritten as custom hours.
    const busy = { ...free, type: 'busy' };

    const result = await load([busy, calendarEvent]);

    expect(result.current.availability['2026-09-10']?.mode).toBe('busy');
    expect(result.current.availability['2026-09-10']?.importedSlots).toHaveLength(1);
  });

  it('separates a rehearsal from the hours the user typed', async () => {
    const rehearsal = { ...calendarEvent, source: 'rehearsal' };
    const own = {
      startsAt: '2026-09-10T08:00:00.000Z',
      endsAt: '2026-09-10T10:00:00.000Z',
      type: 'busy',
      isAllDay: false,
      source: 'manual',
    };

    const result = await load([own, rehearsal]);

    const day = result.current.availability['2026-09-10'];
    expect(day?.slots).toHaveLength(1);
    expect(day?.importedSlots?.[0]).toMatchObject({ source: 'rehearsal' });
  });

  it('leaves an ordinary free day alone', async () => {
    const result = await load([free]);

    expect(result.current.availability['2026-09-10']?.mode).toBe('free');
    expect(result.current.availability['2026-09-10']?.importedSlots).toHaveLength(0);
  });
});
