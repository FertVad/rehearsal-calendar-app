/**
 * The form's members are the members of the project it is on (DP02, CLAUDE.md 11).
 *
 * The list used to stay the previous project's until the new one arrived, and
 * a late answer for a project the form had left replaced the right one. The
 * form picks its participants from this list once per project, so either would
 * put one project's people on another's rehearsal.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRehearsalMembers } from '../useRehearsalMembers';
import { projectsAPI } from '../../../../shared/services/api';
import { requestErrorMessage } from '../../../../shared/utils/requestError';
import { en } from '../../../../i18n/translations';

jest.mock('../../../../shared/services/api', () => ({ projectsAPI: { getMembers: jest.fn() } }));

const project = (id: string) => ({ id, name: id }) as any;
const member = (userId: string) => ({ userId }) as any;

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

it('hands out no list while the new project\'s is in flight', async () => {
  (projectsAPI.getMembers as jest.Mock).mockResolvedValueOnce({ data: { members: [member('1')] } });
  const second = deferred();
  (projectsAPI.getMembers as jest.Mock).mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook(({ p }: { p: ReturnType<typeof project> }) => useRehearsalMembers(p), { initialProps: { p: project('A') } });
  await waitFor(() => expect(result.current.members).toEqual([member('1')]));

  rerender({ p: project('B') });

  expect(result.current.members).toEqual([]);
  expect(result.current.loading).toBe(true);
  await act(async () => { second.resolve({ data: { members: [member('2')] } }); });
  expect(result.current.members).toEqual([member('2')]);
});

// The form's alert and its participants row say why from this: kept as
// `failed: true` only, both said "Failed to load project members" offline and
// with the server down alike (T-228, review 2). Saving stays blocked.
it.each([
  ['no connection', { isAxiosError: true, code: 'ERR_NETWORK', request: {} }, en.common.noConnection],
  ['the server down', { isAxiosError: true, response: { status: 503, data: {} } }, en.common.serverUnavailable],
])('keeps what the load failed with, %s', async (_, error, said) => {
  (projectsAPI.getMembers as jest.Mock).mockRejectedValueOnce(error);
  const { result } = renderHook(() => useRehearsalMembers(project('A')));

  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.ready).toBe(false);
  expect(requestErrorMessage(en, result.current.error, en.rehearsals.loadMembersError)).toBe(said);
});

it('drops a late answer for a project the form has left', async () => {
  const first = deferred();
  (projectsAPI.getMembers as jest.Mock).mockReturnValueOnce(first.promise);
  (projectsAPI.getMembers as jest.Mock).mockResolvedValueOnce({ data: { members: [member('2')] } });
  const { result, rerender } = renderHook(({ p }: { p: ReturnType<typeof project> }) => useRehearsalMembers(p), { initialProps: { p: project('A') } });

  rerender({ p: project('B') });
  await waitFor(() => expect(result.current.members).toEqual([member('2')]));
  await act(async () => { first.resolve({ data: { members: [member('1')] } }); });

  expect(result.current.members).toEqual([member('2')]);
});
