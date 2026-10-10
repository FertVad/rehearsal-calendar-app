/**
 * The profile form edits the name; the address has its own screen (R3).
 *
 * Before: the address was a field of this form. The server stopped taking a
 * new one in PUT /me (it needs a code to each address, HP01), so a changed
 * address made "Save" fail with the server's English, and a cleared last name
 * was sent as `undefined` — "leave it" — so it came back after saving (HP02).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import EditProfileScreen from '../EditProfileScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockAuth: any = {};
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
    UserAvatar: () => null,
  };
});

const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
const form = () => render(<EditProfileScreen navigation={navigation} route={{ key: 'e', name: 'EditProfile' } as any} />);

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  navigation.navigate.mockReset();
  Object.assign(mockAuth, {
    user: { id: 7, email: 'anna@example.com', firstName: 'Anna', lastName: 'Ivanova', createdAt: '2026-09-26T00:00:00Z' },
    updateUser: jest.fn(() => Promise.resolve()),
  });
});

it('shows the address without a field for it, and opens the change screen (HP01)', () => {
  const view = form();
  expect(view.getByText('anna@example.com')).toBeTruthy();
  expect(view.queryByDisplayValue('anna@example.com')).toBeNull();
  fireEvent.press(view.getByText(t.profile.changeEmail));
  expect(navigation.navigate).toHaveBeenCalledWith('ChangeEmail');
});

it('clears a last name with an empty string and never sends the address (HP02, HP01)', async () => {
  const view = form();
  fireEvent.changeText(view.getByDisplayValue('Ivanova'), '  ');
  await act(async () => { fireEvent.press(view.getByText(t.profile.saveChanges)); });
  expect(mockAuth.updateUser).toHaveBeenCalledWith({ firstName: 'Anna', lastName: '' });
});
