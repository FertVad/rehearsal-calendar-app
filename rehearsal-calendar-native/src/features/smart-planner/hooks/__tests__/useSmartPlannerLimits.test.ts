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

const props = {
  projectId: '1', startDate: '2026-01-01', endDate: '2026-01-07',
  selectedCategories: ['perfect'] as SlotCategory[], selectedMemberIds: [],
};
const generation = jest.spyOn(generator, 'generateTimeSlots');

beforeEach(() => {
  jest.clearAllMocks();
  (projectsAPI.getProject as jest.Mock).mockResolvedValue({ data: { project: { id: '1', name: 'Project' } } });
  (projectsAPI.getMembers as jest.Mock).mockResolvedValue({
    data: { members: [{ userId: '1', firstName: 'One' }] },
  });
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockResolvedValue({
    data: { availability: [{ userId: '1', firstName: 'One', hasData: true, dates: [] }] },
  });
  generation.mockImplementation((startDate) => [{
    date: startDate, startTime: '10:00', endTime: '12:00', category: 'perfect',
    totalMembers: 1, freeMembers: 1, busyMembers: [],
  }]);
});

it.each(['2026-01-07', '2026-01-30', '2026-03-31'])(
  'keeps the week/month presets and 90-day boundary available (%s)', async (endDate) => {
    const { result } = renderHook(() => useSmartPlanner({ ...props, endDate }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(projectsAPI.getMembersAvailabilityRange).toHaveBeenCalledWith('1', props.startDate, endDate);
    expect(result.current.filteredSlots).toHaveLength(1);
  }
);

it.each([
  ['2026-01-01', '2026-04-01', '90 days'],
  ['0001-01-01', '9999-12-31', '90 days'],
  ['2026-02-30', '2026-03-01', 'valid start and end dates'],
  ['2026-02-02', '2026-02-01', 'valid start and end dates'],
])('rejects %s to %s before requests or date expansion', (startDate, endDate, message) => {
  const { result } = renderHook(() => useSmartPlanner({ ...props, startDate, endDate }));
  expect(result.current.error).toContain(message);
  expect(result.current.loading).toBe(false);
  expect(projectsAPI.getMembersAvailabilityRange).not.toHaveBeenCalled();
  expect(generation).not.toHaveBeenCalled();
  expect(result.current.filteredSlots).toEqual([]);
});

it('clears previous recommendations immediately when a new range exceeds the budget', async () => {
  const { result, rerender } = renderHook((range: { startDate: string; endDate: string }) => useSmartPlanner({ ...props, ...range }), {
    initialProps: { startDate: props.startDate, endDate: props.endDate },
  });
  await waitFor(() => expect(result.current.filteredSlots).toHaveLength(1));
  generation.mockClear();
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockClear();
  rerender({ startDate: '0001-01-01', endDate: '9999-12-31' });
  expect(result.current.error).toContain('90 days');
  expect(result.current.filteredSlots).toEqual([]);
  expect(result.current.slotsByDate.size).toBe(0);
  expect(generation).not.toHaveBeenCalled();
  expect(projectsAPI.getMembersAvailabilityRange).not.toHaveBeenCalled();
});

it('does not generate recommendations from old availability while the new range is pending or rejected', async () => {
  const { result, rerender } = renderHook((range: { endDate: string }) => useSmartPlanner({ ...props, ...range }), {
    initialProps: { endDate: props.endDate },
  });
  await waitFor(() => expect(result.current.filteredSlots).toHaveLength(1));
  generation.mockClear();
  let reject!: (error: unknown) => void;
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockImplementationOnce(() =>
    new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  rerender({ endDate: '2026-01-30' });
  expect(result.current.filteredSlots).toEqual([]);
  expect(generation).not.toHaveBeenCalled();
  await act(async () => reject({ response: { status: 422, data: {
    error: 'Availability exceeds the response budget. Choose a shorter range.',
    code: 'AVAILABILITY_BUDGET_EXCEEDED',
  } } }));
  expect(result.current.error).toContain('Choose a shorter range');
  expect(result.current.filteredSlots).toEqual([]);
  expect(generation).not.toHaveBeenCalled();
});
