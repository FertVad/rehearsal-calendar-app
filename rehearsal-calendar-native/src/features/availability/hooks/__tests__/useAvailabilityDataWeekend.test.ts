/**
 * A weekend busy by default (T-406): the server's row of source 'weekend',
 * one whole day, shown as the day's busy and known to be the default — not a
 * read-only calendar event the person cannot change, and not the person's
 * own mark. Any edit makes the day theirs and drops the default.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAvailabilityData } from '../useAvailabilityData';
import { availabilityAPI } from '../../../../shared/services/api';
import { applyToSelectedDates } from '../../utils/slotHelpers';
import { getDayStatus } from '../../utils';

jest.mock('../../../../shared/services/api');
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ language: 'ru', setLanguage: jest.fn(), t: jest.requireActual('../../../../i18n/translations').ru }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', timezone: 'Asia/Jerusalem' }, isAuthenticated: true, loading: false }),
}));

const weekend = (date: string) => ({
  startsAt: `${date}T00:00:00.000Z`, endsAt: `${date}T23:59:59.999Z`, type: 'busy', isAllDay: true, source: 'weekend',
  externalEventId: `weekend:${date}`,
});

const load = async (data: unknown[]) => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data });
  const { result } = renderHook(() => useAvailabilityData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
};

it('shows the default as the day\'s busy, known as the default, with nothing to save or keep read-only', async () => {
  const result = await load([weekend('2026-12-04')]);
  expect(result.current.availability['2026-12-04']).toEqual({ mode: 'busy', slots: [], importedSlots: [], weekendDefault: true });
  expect(getDayStatus('2026-12-04', result.current.availability, '2026-11-25')).toBe('busy');
  expect(result.current.hasChanges).toBe(false);
});

it('keeps a calendar event on the day shown with it', async () => {
  const result = await load([
    weekend('2026-12-05'),
    { startsAt: '2026-12-05T00:00:00.000Z', endsAt: '2026-12-05T23:59:59.999Z', type: 'busy', isAllDay: true,
      source: 'apple_calendar', externalEventId: 'cal:x|e1' },
  ]);
  const day = result.current.availability['2026-12-05'];
  expect(day.mode).toBe('busy');
  expect(day.weekendDefault).toBe(true);
  expect(day.importedSlots).toEqual([{ start: '00:00', end: '23:59', source: 'apple_calendar', isAllDay: true }]);
});

it('gives way to a mark of the person\'s own on the day', async () => {
  const result = await load([
    weekend('2026-12-11'),
    { startsAt: '2026-12-11T00:00:00.000Z', endsAt: '2026-12-11T23:59:59.999Z', type: 'available', isAllDay: true, source: 'manual' },
  ]);
  expect(result.current.availability['2026-12-11']).toEqual({ mode: 'free', slots: [], importedSlots: [] });
});

it('is dropped by any edit of the day: it is the person\'s own from then on', () => {
  const before = { '2026-12-04': { mode: 'busy' as const, slots: [], importedSlots: [], weekendDefault: true } };
  const after = applyToSelectedDates(before, ['2026-12-04'], (date) => before[date as '2026-12-04'],
    (state) => ({ ...state, mode: 'free' }));
  expect(after['2026-12-04']).toEqual({ mode: 'free', slots: [], importedSlots: [] });
});
