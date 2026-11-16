/**
 * T-265: the server may refuse this build as too old, and the app then shows
 * "update the app" instead of everything else, until the server answers it
 * again. The real API client (its interceptors) and the real root of the
 * navigation; axios answers as the server would. The flow shows it on the
 * phone (e2e/flows/97-update-required.yaml).
 */
import React from 'react';
import { AppState, Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const appJson = require('../../../app.json');

const mockStorage: Record<string, string> = { accessToken: 'access', refreshToken: 'refresh' };
const mockStorageWrites = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  multiSet: (...args: unknown[]) => { mockStorageWrites('multiSet', ...args); return Promise.resolve(); },
  removeItem: (...args: unknown[]) => { mockStorageWrites('removeItem', ...args); return Promise.resolve(); },
  multiRemove: (...args: unknown[]) => { mockStorageWrites('multiRemove', ...args); return Promise.resolve(); },
}));

// The server, as axios hands its answers to the client's interceptors.
const mockHandlers: Record<string, (value: any) => any> = {};
const mockSent: any[] = [];
let mockAnswer: { status: number; data: unknown } = { status: 200, data: { minIosBuild: 0 } };
jest.mock('axios', () => {
  const instance: any = jest.fn();
  const send = async (method: string, url: string) => {
    const config = await mockHandlers.request({ headers: {}, url, method });
    mockSent.push(config);
    const response = { ...mockAnswer, config };
    if (response.status < 400) return mockHandlers.fulfilled(response);
    return mockHandlers.rejected({ config, response });
  };
  instance.get = (url: string) => send('get', url);
  instance.interceptors = {
    request: { use: (fulfilled: any) => { mockHandlers.request = fulfilled; } },
    response: { use: (fulfilled: any, rejected: any) => { mockHandlers.fulfilled = fulfilled; mockHandlers.rejected = rejected; } },
  };
  return { create: () => instance, post: jest.fn() };
});

jest.mock('@react-navigation/native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useNavigationContainerRef: () => ({ current: null }),
    NavigationContainer: ({ children }: { children: React.ReactNode }) => <View testID="navigator">{children}</View>,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  };
});
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('expo-linking', () => ({
  createURL: () => 'rehearsalapp://',
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
}));

const mockAuth = { user: { id: 'u1', onboardingCompleted: true }, isAuthenticated: true, loading: false };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../contexts/ProjectContext', () => ({ useProjects: () => ({ projects: [] }) }));
jest.mock('../../shared/hooks/useNotifications', () => ({ useNotifications: () => undefined }));
jest.mock('../../shared/hooks/useAutoCalendarSync', () => ({ useAutoCalendarSync: () => undefined }));
jest.mock('../../shared/components/CreateActionSheet', () => ({ CreateActionSheet: () => null }));
jest.mock('../stacks', () => ({
  AuthNavigator: () => null,
  CalendarNavigator: () => null,
  ProjectsNavigator: () => null,
  PlannerNavigator: () => null,
  ProfileNavigator: () => null,
}));
jest.mock('../../features/onboarding', () => ({ OnboardingNavigator: () => null }));
function mockScreen() { return { __esModule: true, default: () => null }; }
jest.mock('../../features/projects/screens/JoinProjectScreen', mockScreen);
jest.mock('../../features/availability/screens/AvailabilityScreen', mockScreen);
jest.mock('../../features/projects/screens/CreateProjectScreen', mockScreen);
jest.mock('../../features/calendar/screens/AddRehearsalScreen', mockScreen);
jest.mock('../../features/calendar/screens/RehearsalDetailsScreen', mockScreen);
jest.mock('../../features/notifications/screens/NotificationsScreen', mockScreen);

import axios from 'axios';
import api from '../../shared/services/api';
import { resetSessionForTests, onSessionExpired } from '../../shared/services/session';
import Navigation from '..';

const UPDATE_REQUIRED = { status: 426, data: { error: 'Update required', code: 'UPDATE_REQUIRED' } };
const STILL_ANSWERED = { status: 200, data: { minIosBuild: 0 } };

// The react-native mock's AppState: __emit plays a move to that state.
const appState = AppState as unknown as { __emit: (state: string) => Promise<void>; __reset: () => void };

let expired: jest.Mock;
let offExpired: () => void;
beforeEach(() => {
  resetSessionForTests();
  appState.__reset();
  mockSent.length = 0;
  mockStorageWrites.mockClear();
  mockAnswer = STILL_ANSWERED;
  expired = jest.fn();
  offExpired = onSessionExpired(expired);
});
afterEach(async () => {
  offExpired();
  // Whatever a test left up comes down: the state outlives a render.
  mockAnswer = STILL_ANSWERED;
  await api.get('/native/app-version');
  jest.restoreAllMocks();
});

describe('every request names this build (api.ts)', () => {
  it('sets X-App-Version and X-App-Build from the app itself', async () => {
    await api.get('/native/projects');
    expect(mockSent[0].headers).toEqual(expect.objectContaining({
      'X-App-Version': appJson.expo.version,
      'X-App-Build': appJson.expo.ios.buildNumber,
    }));
  });

  it('a refresh, sent outside the client, names it too', async () => {
    const post = axios.post as jest.Mock;
    post.mockResolvedValueOnce({ data: { accessToken: 'new', refreshToken: 'next' } });
    post.mockClear();
    mockAnswer = { status: 200, data: {} };
    const config = await mockHandlers.request({ headers: {}, url: '/native/projects', method: 'get' });
    await mockHandlers.rejected({ config, response: { status: 401 } }).catch(() => undefined);
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/refresh$/), { refreshToken: 'refresh' },
      expect.objectContaining({ headers: expect.objectContaining({ 'X-App-Build': appJson.expo.ios.buildNumber }) }));
  });
});

describe('the update screen (navigation/index.tsx)', () => {
  it('asks on launch, and a 426 UPDATE_REQUIRED shows the screen instead of the navigator', async () => {
    mockAnswer = UPDATE_REQUIRED;
    const screen = render(<Navigation />);
    await waitFor(() => expect(screen.getByTestId('update-required')).toBeTruthy());
    expect(mockSent.map((config) => config.url)).toContain('/native/app-version');
    expect(screen.queryByTestId('navigator')).toBeNull();
    expect(screen.getByText('Update Required')).toBeTruthy();
    // Nobody is signed out: no tokens touched, no session ended.
    expect(mockStorageWrites).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it('a 426 of any request puts it up, not only the check', async () => {
    const screen = render(<Navigation />);
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    mockAnswer = UPDATE_REQUIRED;
    await act(async () => { await api.get('/native/projects').catch(() => undefined); });
    expect(screen.getByTestId('update-required')).toBeTruthy();
    expect(screen.queryByTestId('navigator')).toBeNull();
  });

  it('its button opens Rehearsly in the App Store', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockAnswer = UPDATE_REQUIRED;
    const screen = render(<Navigation />);
    await waitFor(() => expect(screen.getByTestId('update-required-open-store')).toBeTruthy());
    fireEvent.press(screen.getByTestId('update-required-open-store'));
    expect(open).toHaveBeenCalledWith('https://apps.apple.com/app/id6830809401');
  });

  it('a check that passes on the return to the foreground takes it down', async () => {
    mockAnswer = UPDATE_REQUIRED;
    const screen = render(<Navigation />);
    await waitFor(() => expect(screen.getByTestId('update-required')).toBeTruthy());

    mockAnswer = STILL_ANSWERED;
    mockSent.length = 0;
    await act(async () => { await appState.__emit('background'); await appState.__emit('active'); });
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(mockSent.map((config) => config.url)).toEqual(['/native/app-version']);
    expect(screen.queryByTestId('update-required')).toBeNull();
  });

  it('other refusals and no answer at all leave the app as it is', async () => {
    const screen = render(<Navigation />);
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    for (const answer of [{ status: 426, data: {} }, { status: 400, data: { code: 'UPDATE_REQUIRED' } }, { status: 503, data: {} }]) {
      mockAnswer = answer;
      await act(async () => { await api.get('/native/app-version').catch(() => undefined); });
      expect(screen.queryByTestId('update-required')).toBeNull();
    }
  });
});
