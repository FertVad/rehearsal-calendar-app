/**
 * The role is the server's as it is now (T-229).
 *
 * The owner made someone an admin of a project they had already joined, and
 * on that person's phone nothing changed: the planner offered no project and
 * the rehearsal form none, until the app was restarted. The list of projects
 * — where every screen reads the role from — was read at sign-in, after a
 * join and after a delete, and never again. A push about the role, coming
 * back to the app and a pull on the projects screen now read it again.
 */
import React from 'react';
import { AppState } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { ProjectProvider } from '../ProjectContext';
import ProjectsScreen from '../../features/projects/screens/ProjectsScreen';
import { useNotifications } from '../../shared/hooks/useNotifications';
import { emitDataChanged } from '../../shared/utils/dataChanged';
import { resetSessionForTests, restoreOwner } from '../../shared/services/session';

const mockGetUserProjects = jest.fn();
jest.mock('../../shared/services/api', () => ({
  projectsAPI: { getUserProjects: (...args: any[]) => mockGetUserProjects(...args) },
}));
const mockAuth = { user: { id: 1 } };
jest.mock('../AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../UnreadContext', () => {
  const refresh = jest.fn();
  const markRead = jest.fn();
  return { useUnread: () => ({ refresh, markRead }) };
});
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ runAutoSync: jest.fn(() => Promise.resolve()) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../I18nContext', () => ({
  useI18n: () => ({ t: require('../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../shared/components', () => ({ SkeletonLoader: () => null }));

const HAMLET = { id: 'p1', name: 'Hamlet', is_admin: false };
const answer = (...list: any[]) => ({ data: { projects: list } });
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

function App() {
  useNotifications();
  return <ProjectsScreen />;
}

const received = (type: string) => {
  const listener = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls.at(-1)[0];
  listener({ request: { content: { data: { type } } } });
};
const tapped = (type: string) => {
  const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls.at(-1)[0];
  listener({ notification: { request: { content: { data: { type, notificationId: 9 } } } } });
};

async function signedInAsMember() {
  mockGetUserProjects.mockResolvedValue(answer(HAMLET));
  const screen = render(<ProjectProvider><App /></ProjectProvider>);
  await waitFor(() => expect(screen.getByText('Hamlet')).toBeTruthy());
  expect(screen.queryByText('Admin')).toBeNull();
  // On the server, the owner makes them an admin.
  mockGetUserProjects.mockResolvedValue(answer({ ...HAMLET, is_admin: true }));
  return screen;
}

beforeEach(() => {
  mockGetUserProjects.mockReset();
  (AppState as any).__reset();
  (Notifications.addNotificationReceivedListener as jest.Mock).mockClear();
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockClear();
  resetSessionForTests();
  restoreOwner(1);
});

it('gives the admin role when its push arrives in the app', async () => {
  const screen = await signedInAsMember();
  await act(async () => { received('role_changed'); });
  await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy());
});

it('gives the admin role when its push is opened by a tap', async () => {
  const screen = await signedInAsMember();
  await act(async () => { tapped('role_changed'); });
  await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy());
});

it('reads a push about a rehearsal as no reason to read the projects', async () => {
  await signedInAsMember();
  const reads = mockGetUserProjects.mock.calls.length;
  await act(async () => { received('rehearsal_created'); });
  expect(mockGetUserProjects).toHaveBeenCalledTimes(reads);
});

it('takes away a project its member was removed from, by its push', async () => {
  mockGetUserProjects.mockResolvedValue(answer(HAMLET));
  const screen = render(<ProjectProvider><App /></ProjectProvider>);
  await waitFor(() => expect(screen.getByText('Hamlet')).toBeTruthy());

  mockGetUserProjects.mockResolvedValue(answer());
  await act(async () => { received('member_removed'); });
  await waitFor(() => expect(screen.queryByText('Hamlet')).toBeNull());
});

it('gives the admin role when the app comes back to the foreground, without a push', async () => {
  const screen = await signedInAsMember();
  await act(async () => { await (AppState as any).__emit('background'); });
  await act(async () => { await (AppState as any).__emit('active'); });
  await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy());
});

it('gives the admin role on a pull on the projects screen', async () => {
  const screen = await signedInAsMember();
  const pull = screen.getByTestId('projects-scroll').props.refreshControl.props.onRefresh;
  await act(async () => { await pull(); });
  expect(screen.getByText('Admin')).toBeTruthy();
});

it('takes the admin role away when the server refused an admin action', async () => {
  mockGetUserProjects.mockResolvedValue(answer({ ...HAMLET, is_admin: true }));
  const screen = render(<ProjectProvider><App /></ProjectProvider>);
  await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy());

  mockGetUserProjects.mockResolvedValue(answer(HAMLET));
  // What the API client says on a 403 (api.forbidden.test.ts).
  await act(async () => { emitDataChanged('projects'); });
  await waitFor(() => expect(screen.queryByText('Admin')).toBeNull());
});

it('keeps the list on screen while it is read again, and when that read fails', async () => {
  const screen = await signedInAsMember();
  const later = held<any>();
  mockGetUserProjects.mockReturnValueOnce(later.promise);
  await act(async () => { await (AppState as any).__emit('active'); });
  expect(screen.getByText('Hamlet')).toBeTruthy();

  await act(async () => { later.resolve(Promise.reject(new Error('Network Error'))); });
  expect(screen.getByText('Hamlet')).toBeTruthy();
  expect(screen.queryByText('Network Error')).toBeNull();
});

it('keeps the newer answer when the older read answers last (rule 11)', async () => {
  const screen = await signedInAsMember();
  const older = held<any>();
  mockGetUserProjects.mockReturnValueOnce(older.promise);
  await act(async () => { await (AppState as any).__emit('active'); });

  await act(async () => { received('role_changed'); });
  await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy());

  await act(async () => { older.resolve(answer(HAMLET)); });
  expect(screen.getByText('Admin')).toBeTruthy();
});
