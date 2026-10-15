/**
 * The availability the conflict check reads is for the day on the form
 * (cause fix 12: DF05; CLAUDE.md 10, 11).
 *
 * A slow answer for the day the form had left replaced the answer for the day
 * shown, and the save checked conflicts against the wrong day. While a load
 * was out, or after it failed, the previous answer — or none — stood in, and
 * "nobody busy" let the rehearsal be saved without a warning.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRehearsalAvailability } from '../useRehearsalAvailability';
import { projectsAPI } from '../../../../shared/services/api';

jest.mock('../../../../shared/services/api', () => ({ projectsAPI: { getMembersAvailability: jest.fn() } }));
jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: jest.fn() }));

const t = { common: { error: 'Error' }, rehearsals: { loadAvailabilityError: 'Could not load' } };
const project = { id: 'p1', name: 'Hamlet' } as any;
const MONDAY = new Date(2026, 9, 19);
const TUESDAY = new Date(2026, 9, 20);
const IDS = ['u1'];

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const busyOn = (date: string) => ({
  data: { availability: [{ userId: 'u1', dates: [{ date, timeRanges: [{ start: '10:00', end: '12:00', type: 'busy' }] }] }] },
});
const freeOn = (date: string) => ({ data: { availability: [{ userId: 'u1', dates: [{ date, timeRanges: [] }] }] } });

beforeEach(() => jest.clearAllMocks());

it('keeps the shown day\'s answer when the day left answers last', async () => {
  const monday = deferred();
  (projectsAPI.getMembersAvailability as jest.Mock)
    .mockReturnValueOnce(monday.promise)
    .mockResolvedValueOnce(busyOn('2026-10-20'));
  const { result, rerender } = renderHook(
    ({ date }: { date: Date }) => useRehearsalAvailability(project, date, IDS, t),
    { initialProps: { date: MONDAY } }
  );

  rerender({ date: TUESDAY });
  await waitFor(() => expect(result.current.memberAvailability.u1?.timeRanges).toHaveLength(1));
  await act(async () => { monday.resolve(freeOn('2026-10-19')); });

  expect(result.current.memberAvailability.u1.timeRanges).toHaveLength(1);
  expect(result.current.ready).toBe(true);
});

it('hands out nothing, and is not ready, while the shown day is loading', async () => {
  const tuesday = deferred();
  (projectsAPI.getMembersAvailability as jest.Mock)
    .mockResolvedValueOnce(busyOn('2026-10-19'))
    .mockReturnValueOnce(tuesday.promise);
  const { result, rerender } = renderHook(
    ({ date }: { date: Date }) => useRehearsalAvailability(project, date, IDS, t),
    { initialProps: { date: MONDAY } }
  );
  await waitFor(() => expect(result.current.memberAvailability.u1).toBeDefined());

  rerender({ date: TUESDAY });

  expect(result.current.memberAvailability).toEqual({});
  expect(result.current.ready).toBe(false);
});

it('says a failed load failed, rather than reading as nobody busy', async () => {
  (projectsAPI.getMembersAvailability as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useRehearsalAvailability(project, MONDAY, IDS, t));

  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.ready).toBe(false);
});
