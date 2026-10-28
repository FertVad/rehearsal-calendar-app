/**
 * Today's suggestions follow the clock (review DP04).
 *
 * The slots were worked out when the data arrived and never again, so a
 * planner left open from 10:05 still offered 10:30 at noon — and "create"
 * carried that start into the form.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSmartPlanner } from '../useSmartPlanner';
import { projectsAPI } from '../../../../shared/services/api';
import * as generator from '../../utils/slotGenerator';
import type { SlotCategory } from '../../types';

jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: {
    getProject: jest.fn(),
    getMembers: jest.fn(),
    getMembersAvailabilityRange: jest.fn(),
  },
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', timezone: 'UTC' } }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: jest.requireActual('../../../../i18n/translations').en }),
}));
jest.mock('../../../../shared/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn() },
}));

const generation = jest.spyOn(generator, 'generateTimeSlots');
const nowOfLastRun = () => generation.mock.calls.at(-1)?.[7] as Date | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  (projectsAPI.getProject as jest.Mock).mockResolvedValue({ data: { project: { id: '1', name: 'Project' } } });
  (projectsAPI.getMembers as jest.Mock).mockResolvedValue({ data: { members: [{ userId: '1', firstName: 'One' }] } });
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockResolvedValue({
    data: { availability: [{ userId: '1', firstName: 'One', hasData: true, dates: [] }] },
  });
});

afterEach(() => jest.useRealTimers());

// What is offered, not only what is passed: a start that begins this minute is
// still offered (the generator's contract), and gone the minute after — the
// clock moved in half-hours and kept 10:30 on offer until 11:00 (review R6-04).
it('offers today only starts still ahead, as the clock moves on, with nothing reloaded', async () => {
  jest.useFakeTimers({ now: new Date(2026, 0, 1, 10, 5) });
  const props = { projectId: '1', startDate: '2026-01-01', endDate: '2026-01-07',
    selectedCategories: ['perfect'] as SlotCategory[], selectedMemberIds: [] };
  const { result } = renderHook(() => useSmartPlanner(props));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const firstStart = () => result.current.allSlots[0]?.startTime;
  const loads = (projectsAPI.getMembersAvailabilityRange as jest.Mock).mock.calls.length;
  expect(firstStart()).toBe('10:30');

  // Land in the given minute and let one poll of the clock run, staying in it.
  const moveTo = (minutes: number) => act(() => {
    jest.setSystemTime(new Date(2026, 0, 1, 10, minutes));
    jest.advanceTimersByTime(30 * 1000);
  });

  moveTo(30);
  expect(firstStart()).toBe('10:30');
  moveTo(31);
  expect(firstStart()).toBe('11:00');
  moveTo(45);
  expect(firstStart()).toBe('11:00');
  expect(nowOfLastRun()?.getMinutes()).toBeGreaterThanOrEqual(45);
  expect((projectsAPI.getMembersAvailabilityRange as jest.Mock).mock.calls.length).toBe(loads);
});
