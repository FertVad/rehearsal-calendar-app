/**
 * The profile's About section (T-011). "Help" had no onPress: a row with a
 * chevron that did nothing. And "Version" was "1.0.0" written into the screen,
 * whatever was built. Help opens the support page, served by the app's own
 * server, in the app's language; the version is the build's.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';

const mockLanguage = { current: 'ru' };
const mockOpenURL = jest.fn((_url: string) => Promise.resolve());
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.4.1' } },
}));
jest.mock('../../../../shared/services/api', () => ({
  // The weekends switch (T-406) reads its state on focus.
  availabilityAPI: { getWeekends: () => Promise.resolve({ data: { enabled: true, days: [6, 7] } }), setWeekends: jest.fn() },
  authAPI: { registerPushToken: jest.fn(), unregisterPushToken: jest.fn(() => Promise.resolve()) },
  supportPageUrl: (language: string) => `http://127.0.0.1:3001/support?lang=${language}`,
  privacyPageUrl: (language: string) => `http://127.0.0.1:3001/privacy?lang=${language}`,
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Masha', email: 'm@example.com' }, loading: false }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations[mockLanguage.current],
    language: mockLanguage.current,
    setLanguage: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../../../shared/components', () => ({
  GlassButton: () => null,
  SkeletonLoader: () => null,
  UserAvatar: () => null,
}));
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  return Object.assign(Object.create(RN), {
    Switch: (props: any) => React.createElement(RN.View, props),
    Linking: { openURL: (url: string) => mockOpenURL(url) },
  });
});
jest.mock('../../../../shared/components/AppModal', () => ({ AppModal: () => null }));
const mockWarn = jest.fn();
jest.mock('../../../../shared/utils/logger', () => ({
  ...jest.requireActual('../../../../shared/utils/logger'),
  logger: { ...jest.requireActual('../../../../shared/utils/logger').logger, warn: (...args: unknown[]) => mockWarn(...args) },
}));

async function profile() {
  const view = render(<ProfileScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'p', name: 'ProfileMain' } as any} />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  mockOpenURL.mockClear();
  mockWarn.mockClear();
});

it('opens the support page in the app’s language from Help', async () => {
  mockLanguage.current = 'ru';
  const view = await profile();
  fireEvent.press(view.getByText('Помощь'));
  expect(mockOpenURL).toHaveBeenCalledWith('http://127.0.0.1:3001/support?lang=ru');
});

// T-039: the policy was reachable only from the foot of the support page;
// App Review 5.1.1 wants it opened from the app itself.
it.each([
  ['en', 'Privacy Policy'],
  ['ru', 'Политика конфиденциальности'],
  ['es', 'Política de privacidad'],
  ['de', 'Datenschutzerklärung'],
])('opens the privacy policy in the app’s language (%s)', async (language, label) => {
  mockLanguage.current = language;
  const view = await profile();
  fireEvent.press(view.getByText(label));
  expect(mockOpenURL).toHaveBeenCalledWith(`http://127.0.0.1:3001/privacy?lang=${language}`);
});

it('puts the policy between Help and Report a Bug', async () => {
  mockLanguage.current = 'en';
  const view = await profile();
  // In the tree's order, the screen's from the top.
  const ids = view
    .getAllByTestId(/^profile-(help|privacy|report-bug)$/)
    .map((row) => row.props.testID);
  expect(ids).toEqual(['profile-help', 'profile-privacy', 'profile-report-bug']);
});

it('shows the version the app was built as, not one written into the screen', async () => {
  mockLanguage.current = 'en';
  const view = await profile();
  expect(view.getByText('2.4.1')).toBeTruthy();
  expect(view.queryByText('1.0.0')).toBeNull();
});

// T-414: "Rate Rehearsly" (T-410) opened the review page with no catch, so an
// iOS refusal was a rejection nobody handled. Now it is caught and logged, as
// the update screen does.
describe('Rate Rehearsly', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => { process.off('unhandledRejection', onUnhandled); });

  it('opens the App Store’s review page', async () => {
    mockLanguage.current = 'en';
    const view = await profile();
    fireEvent.press(view.getByTestId('profile-rate-app'));
    expect(mockOpenURL).toHaveBeenCalledWith('https://apps.apple.com/app/id6830809401?action=write-review');
  });

  it('when iOS refuses to open it, the refusal is logged, not left unhandled', async () => {
    mockLanguage.current = 'en';
    const refused = new Error('Unable to open URL');
    mockOpenURL.mockImplementationOnce(() => Promise.reject(refused));
    const view = await profile();

    fireEvent.press(view.getByTestId('profile-rate-app'));
    // Node reports an unhandled rejection after the microtasks, on a macrotask.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('review'), refused);
  });
});
