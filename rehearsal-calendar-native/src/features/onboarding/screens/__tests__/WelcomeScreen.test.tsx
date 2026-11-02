/**
 * The greeting is one line with the name in it: "Welcome, Nina!" (T-022). It
 * was "Welcome!", then "Nina!", then "Rehearsly", each on a line of its own.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import WelcomeScreen from '../WelcomeScreen';

// Its native view is not in Jest; the buttons draw it.
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
// The real button, without the rest of the components' index.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
  UserAvatar: () => null,
}));
const mockLanguage = { current: 'en' };
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Nina', lastName: 'Newcomer' } }),
}));
jest.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));

afterEach(() => { mockLanguage.current = 'en'; });

const open = () => render(<WelcomeScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);

it('greets by name on one line', () => {
  const view = open();
  expect(view.getByText('Welcome, Nina!')).toBeTruthy();
  expect(view.queryByText('Welcome!')).toBeNull();
  expect(view.queryByText('Nina!')).toBeNull();
  expect(view.queryByText('Rehearsly')).toBeNull();
});

it('greets by name in Russian', () => {
  mockLanguage.current = 'ru';
  expect(open().getByText('Добро пожаловать, Nina!')).toBeTruthy();
});

// "Добро пожаловать, Нина!" is about 402 pt at the title's 32, wider than the
// 345 an iPhone 16 leaves: the line is made smaller to fit, never wrapped
// (T-022 review). Flow 60 measures it on screen.
it('keeps the greeting on one line, made smaller to fit', () => {
  mockLanguage.current = 'ru';
  const title = open().getByTestId('onboarding-title');
  expect(title.props.children).toBe('Добро пожаловать, Nina!');
  expect(title.props.numberOfLines).toBe(1);
  expect(title.props.adjustsFontSizeToFit).toBe(true);
});
