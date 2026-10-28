/**
 * Finishing onboarding lands on the calendar (T-003, e2e/flows/09-onboarding).
 *
 * Signed out, onboarding and the app are three root navigators, and they shared
 * one NavigationContainer. The container keeps the state of the navigator it
 * held, and the next one mounted under it takes that state over, keeping every
 * route whose name it also has. Onboarding's steps are Welcome, CalendarSync,
 * Notifications, WeekStart; the app stack has a Notifications too — the inbox.
 * So whoever finished onboarding landed on an empty inbox, not the calendar.
 *
 * React Navigation is mocked in these tests, so what is held here is the
 * mechanism: each stage is given a container of its own, never one that held
 * another stage's navigator. The flow shows what a person sees.
 */
import React, { useEffect, useRef } from 'react';
import { render } from '@testing-library/react-native';
import Navigation from '..';

// Each container mounted is numbered, and remembers every stage it has held.
let containers: string[][] = [];
jest.mock('@react-navigation/native', () => ({
  useNavigationContainerRef: () => ({ current: null }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => {
    const held = useRef<string[] | null>(null);
    if (!held.current) {
      held.current = [];
      containers.push(held.current);
    }
    const stage = (children as React.ReactElement).type as { stage?: string };
    const list = held.current;
    useEffect(() => {
      if (stage.stage && list[list.length - 1] !== stage.stage) list.push(stage.stage);
    });
    return <>{children}</>;
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));

jest.mock('expo-linking', () => ({
  createURL: () => 'rehearsalapp://',
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
}));

let authState: {
  user: { id: string; onboardingCompleted: boolean } | null;
  isAuthenticated: boolean;
  loading: boolean;
} = { user: null, isAuthenticated: false, loading: false };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));
jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../i18n/translations').translations.en,
    language: 'en',
  }),
}));

jest.mock('../../shared/hooks/useNotifications', () => ({ useNotifications: () => undefined }));
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ useAutoCalendarSync: () => undefined }));
jest.mock('../../shared/components/BetaBanner', () => ({ BetaBanner: () => null }));
jest.mock('../../shared/components/CreateActionSheet', () => ({ CreateActionSheet: () => null }));
jest.mock('../../shared/services/api', () => ({ rehearsalsAPI: {}, projectsAPI: {} }));

// The three root navigators, each naming its stage. The app stack is the one
// navigator index.tsx draws itself; it is told apart as whatever is neither.
jest.mock('../stacks', () => ({
  AuthNavigator: Object.assign(() => null, { stage: 'auth' }),
  CalendarNavigator: () => null,
  ProjectsNavigator: () => null,
  PlannerNavigator: () => null,
  ProfileNavigator: () => null,
}));
jest.mock('../../features/onboarding', () => ({
  OnboardingNavigator: Object.assign(() => null, { stage: 'onboarding' }),
}));

function mockScreen() { return { __esModule: true, default: () => null }; }
jest.mock('../../features/projects/screens/JoinProjectScreen', mockScreen);
jest.mock('../../features/availability/screens/AvailabilityScreen', mockScreen);
jest.mock('../../features/projects/screens/CreateProjectScreen', mockScreen);
jest.mock('../../features/calendar/screens/AddRehearsalScreen', mockScreen);
jest.mock('../../features/calendar/screens/RehearsalDetailsScreen', mockScreen);
jest.mock('../../features/notifications/screens/NotificationsScreen', mockScreen);

const signedIn = (onboardingCompleted: boolean) => ({
  user: { id: 'u1', onboardingCompleted }, isAuthenticated: true, loading: false,
});

beforeEach(() => {
  containers = [];
});

it('gives the app a container onboarding never held (T-003)', () => {
  authState = signedIn(false);
  const { rerender } = render(<Navigation />);
  expect(containers).toEqual([['onboarding']]);

  // The last step saves onboarding as done; the app stack takes its place —
  // in a container of its own, with none of onboarding's routes.
  authState = signedIn(true);
  rerender(<Navigation />);

  expect(containers).toHaveLength(2);
  expect(containers[0]).toEqual(['onboarding']);
  expect(containers[1]).toEqual([]);
});

it('gives each stage its own container, from sign-in to the app (T-003)', () => {
  authState = { user: null, isAuthenticated: false, loading: false };
  const { rerender } = render(<Navigation />);
  authState = signedIn(false);
  rerender(<Navigation />);
  authState = signedIn(true);
  rerender(<Navigation />);

  expect(containers).toEqual([['auth'], ['onboarding'], []]);
});
