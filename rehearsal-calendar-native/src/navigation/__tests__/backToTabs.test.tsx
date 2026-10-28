/**
 * Leaving a modal screen for the tabs goes back to the tabs, not to a copy of
 * them (T-007, e2e/flows/46-create-project-closes-form).
 *
 * "Create" on the new-project form opened the project, and swiping it away
 * showed the form again, still filled in — a second "Create" made a second
 * project. The form is a modal of the app stack and opened the project with
 * navigate('MainTabs', …). In React Navigation 7 navigating to a route that is
 * lower in the stack but not on top does not go back to it unless asked to
 * (`pop: true`): a new MainTabs was pushed over the form, [MainTabs,
 * CreateProject, MainTabs]. A tapped push did the same over any open modal.
 *
 * The screens' navigate and goBack are given to React Navigation's own stack
 * router here, holding the app stack's state.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { CommonActions, StackRouter } from '@react-navigation/routers';
import CreateProjectScreen from '../../features/projects/screens/CreateProjectScreen';
import NotificationsScreen from '../../features/notifications/screens/NotificationsScreen';
import { useNotifications } from '../../shared/hooks/useNotifications';
import { translations } from '../../i18n/translations';

const t = translations.en;

const routeNames = ['MainTabs', 'JoinProject', 'MarkBusy', 'CreateProject', 'AddRehearsal', 'Notifications', 'RehearsalDetails'];
const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
const router = StackRouter({});

// The app stack, and a navigation that hands each call to its router.
let mockState: any;
const open = (...names: string[]) => {
  mockState = router.getRehydratedState({ stale: true, routes: names.map((name) => ({ name })) } as never, options);
};
const apply = (action: any) => {
  const next = router.getStateForAction(mockState, action, options);
  if (!next) throw new Error(`${action.type} was not handled`);
  mockState = next;
};
const mockNavigation: any = {
  navigate: (...args: any[]) => apply((CommonActions.navigate as any)(...args)),
  goBack: () => apply(CommonActions.goBack()),
};
const stack = () => mockState.routes.map((route: any) => route.name);
const top = () => mockState.routes[mockState.index];
const projectOpened = (projectId: string) => ({
  screen: 'Projects',
  // Over the projects list, even in a Projects tab not opened yet: back is the list.
  params: { screen: 'ProjectDetail', params: { projectId }, initial: false },
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: () => void) => { mockFocus.run = effect; },
}));
const mockFocus: { run?: () => void } = {};

jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, timezone: 'Europe/Berlin' } }),
}));
jest.mock('../../contexts/ProjectContext', () => ({
  useProjects: () => ({ createProject: jest.fn(async () => ({ id: '1' })) }),
}));
jest.mock('../../contexts/UnreadContext', () => ({
  useUnread: () => ({
    unreadCount: 1,
    refresh: jest.fn(),
    markRead: jest.fn(() => Promise.resolve(true)),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn(),
  }),
}));
const mockList = jest.fn();
jest.mock('../../shared/services/api', () => ({
  notificationsAPI: { list: (...args: any[]) => mockList(...args) },
}));
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ runAutoSync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return ({ children }: any) => R.createElement(View, null, children);
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});

it('opens the new project in the tabs it came from, with the form gone (T-007)', async () => {
  open('MainTabs', 'CreateProject');
  const view = render(<CreateProjectScreen navigation={mockNavigation} route={{ key: 'c', name: 'CreateProject' } as any} />);

  fireEvent.changeText(view.getByPlaceholderText(t.projects.namePlaceholder), 'Hamlet');
  await act(async () => { fireEvent.press(view.getByText(t.projects.create)); });

  // One MainTabs, showing the project: going back leaves the form behind.
  expect(stack()).toEqual(['MainTabs']);
  expect(top().params).toEqual(projectOpened('1'));
});

it('opens a project from the inbox in the tabs under it (T-007)', async () => {
  open('MainTabs', 'Notifications');
  mockList.mockResolvedValueOnce({
    data: {
      notifications: [{
        id: 5, type: 'project_invite', title: 'Welcome to Hamlet', body: '', data: { projectId: 3 },
        relatedType: 'project', relatedId: 3, read: false, createdAt: new Date().toISOString(),
      }],
      unreadCount: 1,
      nextCursor: null,
    },
  });
  const view = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  await act(async () => { fireEvent.press(await view.findByText('Welcome to Hamlet')); });

  expect(stack()).toEqual(['MainTabs']);
  expect(top().params).toEqual(projectOpened('3'));
});

describe('a tapped push, with a modal screen open (T-007)', () => {
  const tap = async (data: Record<string, unknown>) => {
    const listen = Notifications.addNotificationResponseReceivedListener as jest.Mock;
    listen.mockClear();
    const { renderHook } = require('@testing-library/react-native');
    renderHook(() => useNotifications());
    await act(async () => {});
    const onTap = listen.mock.calls[0][0];
    act(() => onTap({ notification: { request: { content: { data } } } }));
  };

  it('opens the project in the tabs under the modal', async () => {
    open('MainTabs', 'CreateProject');
    await tap({ type: 'rehearsal_deleted', projectId: 3 });

    expect(stack()).toEqual(['MainTabs']);
    expect(top().params).toEqual(projectOpened('3'));
  });

  it('opens the projects list in the tabs under the modal', async () => {
    open('MainTabs', 'MarkBusy');
    await tap({ type: 'project_deleted' });

    expect(stack()).toEqual(['MainTabs']);
    expect(top().params).toEqual({ screen: 'Projects' });
  });
});
