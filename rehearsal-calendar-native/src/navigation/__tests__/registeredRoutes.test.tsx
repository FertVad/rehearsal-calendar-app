/**
 * What the types say is reachable is what the navigators have (review R9-03).
 *
 * The type check refuses a navigate() to a route the param lists do not name
 * (typedNavigation.test.ts keeps it from being switched off). That is only
 * worth something if the param lists are true: a route declared and never
 * registered would compile and do nothing when tapped, which is how "Create
 * project" in the rehearsal form behaved. So the real navigators are rendered
 * — with their navigator factories recording the screens each one registers —
 * and every navigator must register exactly what its param list declares.
 * Then the form's own action goes through React Navigation's real stack
 * router, as the review asked.
 */
import React from 'react';
import { render, renderHook, act } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { StackRouter, CommonActions, type StackNavigationState, type ParamListBase } from '@react-navigation/routers';
import Navigation from '..';
import { AuthNavigator } from '../stacks';
import { OnboardingNavigator, type OnboardingStackParamList } from '../../features/onboarding';
import { useAddRehearsalForm } from '../../features/calendar/hooks/useAddRehearsalForm';
import type {
  AppStackParamList,
  AuthStackParamList,
  CalendarStackParamList,
  PlannerStackParamList,
  ProfileStackParamList,
  ProjectsStackParamList,
  TabParamList,
} from '../types';

// Each navigator rendered adds the names of the screens it registers, and
// renders each screen, so a screen that is itself a navigator adds its own.
const mockRegistered = new Set<string>();
type MockScreen = React.ReactElement<{ name: string; children?: React.ReactNode }>;
function mockNavigator() {
  const R: typeof React = require('react');
  const names = (children: React.ReactNode): string[] => (R.Children.toArray(children) as MockScreen[]).flatMap((child) =>
    child.type === R.Fragment ? names(child.props.children) : [child.props.name]);
  return {
    Navigator: ({ children }: { children: React.ReactNode }) => {
      mockRegistered.add(names(children).sort().join(', '));
      return R.createElement(R.Fragment, null, children);
    },
    Screen: ({ component: Component }: { component: React.ComponentType }) => R.createElement(Component),
  };
}
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => mockNavigator() }));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => mockNavigator() }));

// What a screen shows plays no part in what is registered.
function mockScreen() { return { __esModule: true, default: () => null }; }
jest.mock('../../features/auth/screens/LoginScreen', mockScreen);
jest.mock('../../features/auth/screens/RegisterScreen', mockScreen);
jest.mock('../../features/auth/screens/VerifyEmailScreen', mockScreen);
jest.mock('../../features/auth/screens/ResetPasswordScreen', mockScreen);
jest.mock('../../features/calendar/screens/CalendarScreen', mockScreen);
jest.mock('../../features/calendar/screens/AddRehearsalScreen', mockScreen);
jest.mock('../../features/calendar/screens/RehearsalDetailsScreen', mockScreen);
jest.mock('../../features/projects/screens/ProjectsScreen', mockScreen);
jest.mock('../../features/projects/screens/ProjectDetailScreen', mockScreen);
jest.mock('../../features/projects/screens/JoinProjectScreen', mockScreen);
jest.mock('../../features/projects/screens/CreateProjectScreen', mockScreen);
jest.mock('../../features/profile/screens/ProfileScreen', mockScreen);
jest.mock('../../features/profile/screens/CalendarSyncSettingsScreen', mockScreen);
jest.mock('../../features/profile/screens/EditProfileScreen', mockScreen);
jest.mock('../../features/profile/screens/ChangeEmailScreen', mockScreen);
jest.mock('../../features/smart-planner/screens/SmartPlannerScreen', mockScreen);
jest.mock('../../features/smart-planner/screens/SmartPlannerTabScreen', mockScreen);
jest.mock('../../features/availability/screens/AvailabilityScreen', mockScreen);
jest.mock('../../features/notifications/screens/NotificationsScreen', mockScreen);
jest.mock('../../features/onboarding/screens', () => ({
  WelcomeScreen: () => null, WeekStartScreen: () => null, CalendarSyncScreen: () => null, NotificationsScreen: () => null,
}));
jest.mock('../../features/onboarding/components', () => ({}));

jest.mock('expo-linking', () => ({
  createURL: () => 'rehearsalapp://',
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => undefined }),
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', onboardingCompleted: true }, isAuthenticated: true, loading: false }),
}));
jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../shared/hooks/useNotifications', () => ({ useNotifications: () => undefined }));
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ useAutoCalendarSync: () => undefined }));
jest.mock('../../shared/components/BetaBanner', () => ({ BetaBanner: () => null }));
jest.mock('../../shared/components/CreateActionSheet', () => ({ CreateActionSheet: () => null }));
jest.mock('../../shared/services/api', () => ({ rehearsalsAPI: {}, projectsAPI: {} }));

// Each param list, key for key; the type check refuses a missing or extra one.
const DECLARED = [
  { Login: true, Register: true, VerifyEmail: true, ResetPassword: true } satisfies Record<keyof AuthStackParamList, true>,
  { Welcome: true, CalendarSync: true, Notifications: true, WeekStart: true } satisfies Record<keyof OnboardingStackParamList, true>,
  { MainTabs: true, Notifications: true, RehearsalDetails: true, JoinProject: true, MarkBusy: true, CreateProject: true,
    AddRehearsal: true } satisfies Record<keyof AppStackParamList, true>,
  { Calendar: true, Projects: true, Create: true, Planner: true, Profile: true } satisfies Record<keyof TabParamList, true>,
  { CalendarMain: true } satisfies Record<keyof CalendarStackParamList, true>,
  { ProjectsMain: true, ProjectDetail: true } satisfies Record<keyof ProjectsStackParamList, true>,
  { PlannerMain: true, SmartPlanner: true } satisfies Record<keyof PlannerStackParamList, true>,
  { ProfileMain: true, CalendarSyncSettings: true, EditProfile: true, ChangeEmail: true } satisfies Record<keyof ProfileStackParamList, true>,
].map((list) => Object.keys(list).sort().join(', '));

beforeAll(() => {
  render(<Navigation />);
  render(<AuthNavigator />);
  render(<OnboardingNavigator />);
});

it('every navigator registers exactly the screens its param list declares', () => {
  expect([...mockRegistered].sort()).toEqual([...DECLARED].sort());
});

it('"Create project" in the rehearsal form opens a screen the app stack has (R9-03)', () => {
  const navigate = jest.fn();
  (useNavigation as jest.Mock).mockReturnValue({ navigate, goBack: jest.fn() });
  const { result } = renderHook(() =>
    useAddRehearsalForm({ projects: [], selectedProject: null, setSelectedProject: jest.fn() }));

  act(() => { result.current.handleCreateProject(); });

  const appStack = [...mockRegistered].map((names) => names.split(', ')).find((names) => names.includes('AddRehearsal')) ?? [];
  const options = { routeNames: appStack, routeParamList: {}, routeGetIdList: {} };
  const router = StackRouter({});
  const onForm = router.getStateForAction(
    router.getInitialState(options), CommonActions.navigate('AddRehearsal', {}), options) as StackNavigationState<ParamListBase>;
  const [name, params] = navigate.mock.calls[0];
  const after = router.getStateForAction(onForm, CommonActions.navigate(name, params), options);

  // null is the router saying no screen of this navigator handles the action.
  expect(after).not.toBeNull();
  expect((after as StackNavigationState<ParamListBase>).routes.at(-1)?.name).toBe('CreateProject');
});
