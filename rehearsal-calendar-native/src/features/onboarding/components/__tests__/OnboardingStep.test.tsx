/**
 * The bar at the bottom of an onboarding step is the same on every step
 * (T-022). The notifications step put "Not now" under Back and Next, inside
 * the bar, and lifted the pair about 44 pt on that step alone; a quieter way
 * past a step now ends the step's content instead. And "Skip" and "Next" were
 * written in English into the frame, whatever the app's language.
 */
import React from 'react';
import { render, within, fireEvent } from '@testing-library/react-native';
import OnboardingStep from '../OnboardingStep';

// Its native view is not in Jest; the buttons draw it.
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
// The real button, without the rest of the components' index.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
}));
const mockLanguage = { current: 'en' };
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

afterEach(() => { mockLanguage.current = 'en'; });

const step = (extra: Partial<React.ComponentProps<typeof OnboardingStep>> = {}) =>
  render(
    <OnboardingStep title="Step" currentStep={1} totalSteps={4} onBack={jest.fn()} onNext={jest.fn()} onSkip={jest.fn()} {...extra}>
      {null}
    </OnboardingStep>
  );

it('keeps a step\'s quieter way past it out of the bottom bar', () => {
  const onPress = jest.fn();
  const view = step({ secondaryAction: { title: 'Not now', onPress, note: 'Later, in Profile' } });

  const footer = view.getByTestId('onboarding-footer');
  expect(within(footer).queryByText('Not now')).toBeNull();
  expect(within(footer).getByText('Back')).toBeTruthy();
  expect(within(footer).getByText('Next')).toBeTruthy();
  expect(view.getByText('Later, in Profile')).toBeTruthy();
  fireEvent.press(view.getByText('Not now'));
  expect(onPress).toHaveBeenCalled();
});

it('has the same bottom bar with a quieter way past the step and without one', () => {
  const footerOf = (view: ReturnType<typeof step>) => view.getByTestId('onboarding-footer').props.children;
  const plain = step();
  const withAction = step({ secondaryAction: { title: 'Not now', onPress: jest.fn() } });
  expect([footerOf(withAction)].flat().filter(Boolean)).toHaveLength([footerOf(plain)].flat().filter(Boolean).length);
});

it('says "Skip" and "Next" in the app\'s language', () => {
  mockLanguage.current = 'ru';
  const view = step();
  expect(view.getByText('Пропустить')).toBeTruthy();
  expect(view.getByText('Далее')).toBeTruthy();
  expect(view.queryByText('Skip')).toBeNull();
  expect(view.queryByText('Next')).toBeNull();
});
