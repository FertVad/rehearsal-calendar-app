/**
 * A list and a tap, in the order they happened (cause fix 12: HN02, review).
 *
 * A refresh says "not seen" for every rehearsal it covers, so a mark taken
 * back elsewhere comes off. But a list asked for before a tap and answered
 * after it is older than the tap: it said "not seen" and took off the mark the
 * person had just put on, with the server holding it. A read now begins in the
 * seen store, and its answer lands only for rehearsals nobody toggled since.
 */
import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useRehearsals } from '../useRehearsals';
import { SeenProvider, useSeen } from '../../../../contexts/SeenContext';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { formatDateToString } from '../../../../shared/utils/time';

jest.mock('../../../../shared/services/api', () => ({
  rehearsalsAPI: { getBatch: jest.fn(), respond: jest.fn() },
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: { common: { error: 'Error' }, rehearsals: { seenError: 'Could not save' } } }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', timezone: 'UTC' } }),
}));

const day = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatDateToString(d);
})();
const rehearsal = (userResponse: string | null) => ({
  id: 'r1', projectId: '1', startsAt: `${day}T10:00:00Z`, endsAt: `${day}T12:00:00Z`, userResponse,
});
const projects = [{ id: '1', name: 'The Seagull', is_admin: false, timezone: 'UTC' }] as any;

const wrapper = ({ children }: { children: ReactNode }) => <SeenProvider>{children}</SeenProvider>;
const render = () => renderHook(() => ({ list: useRehearsals(projects, null), seen: useSeen() }), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  (rehearsalsAPI.respond as jest.Mock).mockResolvedValue({ data: { confirmed: 1, invited: 2 } });
});

it('keeps a mark put on after the list was asked for (HN02)', async () => {
  let answer!: (value: unknown) => void;
  (rehearsalsAPI.getBatch as jest.Mock).mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  const { result } = render();

  let load!: Promise<void>;
  act(() => { load = result.current.list.fetchRehearsals(true); });
  await act(async () => { await result.current.seen.toggleSeen('r1'); });
  expect(result.current.seen.responseFor('r1')).toBe('yes');

  await act(async () => { answer({ data: { rehearsals: [rehearsal(null)] } }); await load; });

  expect(result.current.seen.responseFor('r1')).toBe('yes');
});

it('keeps a mark put on while the list was out and the tap was on its way', async () => {
  let answer!: (value: unknown) => void;
  let respond!: (value: unknown) => void;
  (rehearsalsAPI.respond as jest.Mock).mockReturnValue(new Promise((resolve) => { respond = resolve; }));
  const { result } = render();

  let toggling!: Promise<void>;
  act(() => { toggling = result.current.seen.toggleSeen('r1'); });
  // The list is asked for after the tap but answered before the server took it.
  (rehearsalsAPI.getBatch as jest.Mock).mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  let load!: Promise<void>;
  act(() => { load = result.current.list.fetchRehearsals(true); });
  await act(async () => { respond({ data: { confirmed: 1, invited: 2 } }); await toggling; });
  await act(async () => { answer({ data: { rehearsals: [rehearsal(null)] } }); await load; });

  expect(result.current.seen.responseFor('r1')).toBe('yes');
});

// The whole time the tap is on its way counts (review): the list asked for
// after the tap began and answered before the server took it said "not seen",
// and the tap's own success then wrote only the counts.
it('keeps a mark when the list answers while the tap is still on its way', async () => {
  let respond!: (value: unknown) => void;
  (rehearsalsAPI.respond as jest.Mock).mockReturnValue(new Promise((resolve) => { respond = resolve; }));
  (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({ data: { rehearsals: [rehearsal(null)] } });
  const { result } = render();

  let toggling!: Promise<void>;
  act(() => { toggling = result.current.seen.toggleSeen('r1'); });
  await act(async () => { await result.current.list.fetchRehearsals(true); });
  expect(result.current.seen.responseFor('r1')).toBe('yes');

  await act(async () => { respond({ data: { confirmed: 1, invited: 2 } }); await toggling; });

  expect(result.current.seen.responseFor('r1')).toBe('yes');
  expect(result.current.seen.statsFor('r1')).toEqual({ confirmed: 1, invited: 2 });
});

it('takes off a mark taken back elsewhere when nothing was tapped here', async () => {
  (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValueOnce({ data: { rehearsals: [rehearsal('yes')] } });
  const { result } = render();
  await act(async () => { await result.current.list.fetchRehearsals(true); });
  expect(result.current.seen.responseFor('r1')).toBe('yes');

  (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValueOnce({ data: { rehearsals: [rehearsal(null)] } });
  await act(async () => { await result.current.list.fetchRehearsals(true); });

  expect(result.current.seen.responseFor('r1')).toBeNull();
});
