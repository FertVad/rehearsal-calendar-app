/**
 * The profile's layout (T-024, the owner's decisions of 02.11 on the audit of
 * 29.10). "Delete account" was a red row of About, 8 pt under Help; it is the
 * last thing on the screen, after "Sign out", in the look of a project's
 * delete. The language and timezone sheets ran their last row into the home
 * indicator; they end above it, as the bottom bar does (T-009). And the
 * timezone list is searched by city and zone name.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('../../../../shared/services/api', () => ({
  authAPI: { registerPushToken: jest.fn(), unregisterPushToken: jest.fn(() => Promise.resolve()) },
  supportPageUrl: () => 'http://127.0.0.1:3001/support',
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Masha', email: 'm@example.com', timezone: 'Europe/Berlin' }, loading: false }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en', setLanguage: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, testID, onPress }: any) =>
      React.createElement(TouchableOpacity, { testID, onPress }, React.createElement(Text, null, title)),
    SkeletonLoader: () => null,
    UserAvatar: () => null,
  };
});
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  return Object.assign(Object.create(RN), { Switch: (props: any) => React.createElement(RN.View, props) });
});
jest.mock('../../../../shared/components/AppModal', () => ({
  AppModal: ({ visible, children }: any) => (visible ? children : null),
}));

async function profile() {
  const view = render(<ProfileScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'p', name: 'ProfileMain' } as any} />);
  await act(async () => {});
  return view;
}

/** The testIDs of the screen, in the order they are drawn. */
function testIDs(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => testIDs(child, out));
    return out;
  }
  if (node.props?.testID) out.push(node.props.testID);
  (node.children ?? []).forEach((child: any) => testIDs(child, out));
  return out;
}

/** A style as one object; the shared mock's StyleSheet.flatten leaves arrays as they are. */
function flat(style: any): Record<string, any> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flat));
  return style && typeof style === 'object' ? style : {};
}

/** How far above the screen's bottom the sheet holding `element` stops its content. */
function sheetPaddingBottom(element: any): number | undefined {
  for (let node = element; node; node = node.parent) {
    const style = flat(node.props?.style);
    // The sheet: the view with the rounded top.
    if (style.borderTopLeftRadius) return style.paddingBottom ?? 0;
  }
  return undefined;
}

it('puts "Delete account" last, after "Sign out", in the look of a project’s delete', async () => {
  const view = await profile();
  const ids = testIDs(view.toJSON()).filter((id) => id.startsWith('profile-'));
  expect(ids.at(-1)).toBe('profile-delete-account');
  expect(ids.indexOf('profile-logout')).toBe(ids.length - 2);
  // No longer a row of About under Help and the bug report.
  expect(ids.indexOf('profile-report-bug')).toBeLessThan(ids.indexOf('profile-logout'));
});

it('opens the same confirmation from the new "Delete account"', async () => {
  const view = await profile();
  fireEvent.press(view.getByTestId('profile-delete-account'));
  expect(view.getByText('Delete Account?')).toBeTruthy();
});

it('ends the language sheet above the home indicator', async () => {
  const view = await profile();
  fireEvent.press(view.getByTestId('profile-language'));
  expect(sheetPaddingBottom(view.getByTestId('language-de'))).toBe(34);
});

it('ends the timezone sheet above the home indicator', async () => {
  const view = await profile();
  fireEvent.press(view.getByTestId('profile-timezone'));
  expect(sheetPaddingBottom(view.getByText('Tokyo (UTC+9)'))).toBe(34);
});

it('finds a zone by its city and by its name, and says when nothing is found', async () => {
  const view = await profile();
  fireEvent.press(view.getByTestId('profile-timezone'));

  fireEvent.changeText(view.getByTestId('timezone-search'), 'tok');
  expect(view.getByText('Tokyo (UTC+9)')).toBeTruthy();
  expect(view.queryByText(/^Sydney/)).toBeNull();

  fireEvent.changeText(view.getByTestId('timezone-search'), 'australia');
  expect(view.getByText(/^Sydney/)).toBeTruthy();
  expect(view.queryByText('Tokyo (UTC+9)')).toBeNull();

  fireEvent.changeText(view.getByTestId('timezone-search'), 'atlantis');
  expect(view.getByText('Nothing found')).toBeTruthy();
});

it('opens the timezone list whole again after a search', async () => {
  const view = await profile();
  fireEvent.press(view.getByTestId('profile-timezone'));
  fireEvent.changeText(view.getByTestId('timezone-search'), 'atlantis');
  fireEvent.press(view.getByLabelText('Close'));
  fireEvent.press(view.getByTestId('profile-timezone'));
  expect(view.getByText('Tokyo (UTC+9)')).toBeTruthy();
});
