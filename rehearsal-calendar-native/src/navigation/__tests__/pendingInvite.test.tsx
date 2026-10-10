/**
 * HN01 — pending invite survives onboarding (red before fix).
 *
 * When a user opens an invite URL before signing in, the code is stored as
 * pending. On unfixed code the effect that dispatches the pending invite checks
 * only isAuthenticated, not whether onboarding is still showing. So after login
 * the 500 ms timer fires, navigate('JoinProject') is called on the
 * OnboardingNavigator (which has no such screen and ignores it), and the code
 * is cleared. When onboarding finishes nothing happens.
 *
 * Red before: navigate is called while onboarding is still active — both for a
 * link queued before sign-in and for one that arrives during onboarding. After
 * the fix the code waits until the app stack is mounted, then opens once.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import Navigation from '..';

// -- expo-linking: controllable URL events --------------------------------
let urlListener: (e: { url: string }) => void = () => {};
jest.mock('expo-linking', () => ({
  createURL: () => 'rehearsalapp://',
  getInitialURL: async () => null,
  addEventListener: (_event: string, cb: (e: { url: string }) => void) => {
    urlListener = cb;
    return { remove: () => {} };
  },
}));

// -- @react-navigation/native: controlled ref with navigate spy -----------
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigationContainerRef: () => ({ current: { navigate: mockNavigate } }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {}, key: 'k', name: 'N' }),
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));

// -- navigators: render nothing -------------------------------------------
function noopNav() {
  return {
    Navigator: () => null,
    Screen: () => null,
  };
}
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: noopNav }));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: noopNav }));

// -- controllable auth context --------------------------------------------
let authState: {
  user: { id: string; onboardingCompleted: boolean } | null;
  isAuthenticated: boolean;
  loading: boolean;
} = {
  user: null, isAuthenticated: false, loading: false,
};
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../i18n/translations').translations.en,
    language: 'en',
  }),
}));

// -- dependencies that must not throw when rendered -----------------------
jest.mock('../../shared/hooks/useNotifications', () => ({ useNotifications: () => undefined }));
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ useAutoCalendarSync: () => undefined }));
jest.mock('../../shared/components/BetaBanner', () => ({ BetaBanner: () => null }));
jest.mock('../../shared/components/CreateActionSheet', () => ({ CreateActionSheet: () => null }));
jest.mock('../../shared/services/api', () => ({ rehearsalsAPI: {}, projectsAPI: {} }));

jest.mock('../../features/onboarding', () => ({
  OnboardingNavigator: () => null,
}));

function mockScreen() { return { __esModule: true, default: () => null }; }
jest.mock('../../features/auth/screens/LoginScreen', mockScreen);
jest.mock('../../features/auth/screens/RegisterScreen', mockScreen);
jest.mock('../../features/auth/screens/VerifyEmailScreen', mockScreen);
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
jest.mock('../../features/smart-planner/screens/SmartPlannerScreen', mockScreen);
jest.mock('../../features/smart-planner/screens/SmartPlannerTabScreen', mockScreen);
jest.mock('../../features/availability/screens/AvailabilityScreen', mockScreen);
jest.mock('../../features/notifications/screens/NotificationsScreen', mockScreen);

// -------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockClear();
  authState = { user: null, isAuthenticated: false, loading: false };
});

it('holds the invite code until onboarding completes, then navigates (HN01)', () => {
  jest.useFakeTimers();
  try {
    // 1. Render with user not yet signed in.
    const { rerender } = render(<Navigation />);

    // 2. Invite URL arrives while unauthenticated → stored as pendingInviteCode.
    act(() => { urlListener({ url: 'rehearsalapp://invite/deadbeef' }); });

    // 3. User signs in; onboarding not yet complete.
    authState = { user: { id: 'u1', onboardingCompleted: false }, isAuthenticated: true, loading: false };
    rerender(<Navigation />);

    // 4. Advance past the 500 ms dispatch timer.
    act(() => { jest.advanceTimersByTime(600); });

    // On unfixed code navigate is called here (invite consumed while onboarding
    // is still active). This assertion is RED before the fix.
    expect(mockNavigate).not.toHaveBeenCalled();

    // 5. User finishes onboarding.
    authState = { user: { id: 'u1', onboardingCompleted: true }, isAuthenticated: true, loading: false };
    rerender(<Navigation />);

    // 6. Advance again: now the invite must be dispatched.
    act(() => { jest.advanceTimersByTime(600); });

    expect(mockNavigate).toHaveBeenCalledWith('JoinProject', { code: 'deadbeef' });
  } finally {
    jest.useRealTimers();
  }
});

it('holds an invite that arrives while onboarding is already showing (HN01)', () => {
  jest.useFakeTimers();
  try {
    // Signed in, onboarding on screen.
    authState = { user: { id: 'u1', onboardingCompleted: false }, isAuthenticated: true, loading: false };
    const { rerender } = render(<Navigation />);

    // The link arrives now. On unfixed code it is navigated straight into the
    // onboarding stack, which has no JoinProject, and dropped.
    act(() => { urlListener({ url: 'rehearsalapp://invite/cafe01' }); });
    act(() => { jest.advanceTimersByTime(600); });
    expect(mockNavigate).not.toHaveBeenCalled();

    authState = { user: { id: 'u1', onboardingCompleted: true }, isAuthenticated: true, loading: false };
    rerender(<Navigation />);
    act(() => { jest.advanceTimersByTime(600); });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('JoinProject', { code: 'cafe01' });
  } finally {
    jest.useRealTimers();
  }
});
