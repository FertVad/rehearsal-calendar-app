/**
 * The registration form and the real AuthProvider together (review R3-28).
 *
 * The form's "already have an account" button used navigate('Login'); in
 * React Navigation 7 that pushes Login and keeps the form mounted, so leaving
 * through it never reached the unmount cleanup, and a registration answered
 * afterwards opened the code screen over wherever the person had gone. Here
 * the answer is held, the button pressed, then the answer released.
 */
import React from 'react';
import { TextInput } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import RegisterScreen from '../RegisterScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockRegister = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  authAPI: {
    getMe: jest.fn(),
    register: (...args: any[]) => mockRegister(...args),
    updateMe: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockStorage[key] ?? null),
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../shared/services/notifications', () => ({
  unregisterPushToken: jest.fn(() => Promise.resolve()),
  keepPushRegistered: jest.fn(() => () => undefined),
}));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
  };
});

const navigation: any = { navigate: jest.fn(), popTo: jest.fn() };
let auth: ReturnType<typeof useAuth>;
function Capture() { auth = useAuth(); return null; }

it('a registration answered after leaving through the form button opens nothing', async () => {
  let answer!: (value: any) => void;
  mockRegister.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  const view = render(<AuthProvider><Capture /><RegisterScreen navigation={navigation} route={{ key: 'r', name: 'Register' } as any} /></AuthProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  // By their place in the form: first name, last name, address, password, repeat.
  const [first, , email, password, confirm] = view.UNSAFE_getAllByType(TextInput);
  fireEvent.changeText(first, 'Anna');
  fireEvent.changeText(email, 'anna@example.com');
  fireEvent.changeText(password, 'long-enough-1');
  fireEvent.changeText(confirm, 'long-enough-1');
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  await act(async () => { fireEvent.press(view.getByText(t.auth.alreadyHaveAccount)); });
  expect(navigation.popTo).toHaveBeenCalledWith('Login');
  await act(async () => { answer({ data: { status: 'verification_required', email: 'anna@example.com', delivery: 'sent' } }); });
  expect(navigation.navigate).not.toHaveBeenCalledWith('VerifyEmail', expect.anything());
  expect(auth.pendingEmail).toBeNull();
});
