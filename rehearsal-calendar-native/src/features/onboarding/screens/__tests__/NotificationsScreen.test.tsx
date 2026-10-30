/**
 * The notifications step shows what a notification says (T-011). Its two
 * examples were the labels of the form's buttons, "Add Rehearsal" and "Save
 * Changes", drawn in bordered boxes like buttons: they read as things to tap,
 * and said nothing a notification would. Now: two notifications, in a list.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';

const mockLanguage = { current: 'en' };
jest.mock('../../../../shared/services/notifications', () => ({ askAndRegisterPush: jest.fn() }));
jest.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));
jest.mock('../../components', () => ({ OnboardingStep: ({ children }: any) => children }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

const openStep = () =>
  render(<NotificationsScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} route={{} as any} />);

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

it('gives notifications as examples, not the form’s buttons', () => {
  const view = openStep();
  expect(view.queryByText('Add Rehearsal')).toBeNull();
  expect(view.queryByText('Save Changes')).toBeNull();
  expect(view.getByText('You were added to a rehearsal')).toBeTruthy();
  expect(view.getByText('A rehearsal’s time changed')).toBeTruthy();
});

it('draws them as a list, without a button’s frame', () => {
  const view = openStep();
  for (const id of ['notification-example-added', 'notification-example-time']) {
    const style = flat(StyleSheet.flatten(view.getByTestId(id).props.style));
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.backgroundColor).toBeUndefined();
  }
});

it('says them in Russian to a Russian app', () => {
  mockLanguage.current = 'ru';
  const view = openStep();
  expect(view.getByText('Вас добавили в репетицию')).toBeTruthy();
  expect(view.getByText('Время репетиции изменилось')).toBeTruthy();
  mockLanguage.current = 'en';
});
