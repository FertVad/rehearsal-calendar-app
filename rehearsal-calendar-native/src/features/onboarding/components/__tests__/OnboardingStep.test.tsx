/**
 * One design on every onboarding step (T-412, the owner, 25.11.2026). At the
 * top, "‹ Back" on the left — where there is a way back — and "Skip" on the
 * right. At the bottom, the step's answers together: the main one, purple, and
 * right under it the other, grey, then its note. No "Next": an answer goes on.
 * Before, the second answer stood mid-screen in the content, the main one
 * shared the bottom row with Back, and the calendar step had a "Next" that did
 * what "Set up later" did.
 *
 * And the frame's own words are the app's language, not English (T-022).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, within, fireEvent } from '@testing-library/react-native';
import OnboardingStep from '../OnboardingStep';
import GlassButton from '../../../../shared/components/buttons/GlassButton';

// The real button, without the rest of the components' index.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
}));
const mockLanguage = { current: 'en' };
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

afterEach(() => { mockLanguage.current = 'en'; });

const NBSP = ' ';
// A style as one object, whatever arrays it was given in.
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

const step = (extra: Partial<React.ComponentProps<typeof OnboardingStep>> = {}) =>
  render(
    <OnboardingStep title="Step" currentStep={1} totalSteps={5} onBack={jest.fn()} onSkip={jest.fn()} {...extra}>
      {null}
    </OnboardingStep>
  );

const twoAnswers = (onYes = jest.fn(), onNo = jest.fn()) => step({
  answer: { title: 'Yes, Mark Them', onPress: onYes },
  secondAnswer: { title: 'No, Leave Them Free', onPress: onNo, note: 'Later, in Profile' },
});

it('puts "‹ Back" at the top, opposite "Skip", and not at the bottom', () => {
  const onBack = jest.fn();
  const view = step({ onBack, answer: { title: 'Turn On', onPress: jest.fn() } });

  const header = view.getByTestId('onboarding-header');
  expect(within(header).getByText('Back')).toBeTruthy();
  expect(within(header).getByText('Skip')).toBeTruthy();
  expect(within(view.getByTestId('onboarding-footer')).queryByText('Back')).toBeNull();
  // A button with its label, as "Skip" is, at least 44 pt to tap.
  const back = view.getByTestId('onboarding-back');
  expect(back.props.accessibilityRole).toBe('button');
  expect(back.props.accessibilityLabel).toBe('Back');
  expect(StyleSheet.flatten(back.props.style).minHeight).toBeGreaterThanOrEqual(44);
  fireEvent.press(view.getByText('Back'));
  expect(onBack).toHaveBeenCalled();
});

it('has no "‹ Back" on a step with no way back', () => {
  const view = step({ onBack: undefined, answer: { title: 'Get Started', onPress: jest.fn() } });
  expect(view.queryByTestId('onboarding-back')).toBeNull();
  expect(view.queryByText('Back')).toBeNull();
  expect(within(view.getByTestId('onboarding-header')).getByText('Skip')).toBeTruthy();
});

it('puts both answers at the bottom, the main one above the other, the note under them', () => {
  const onYes = jest.fn();
  const onNo = jest.fn();
  const view = twoAnswers(onYes, onNo);

  const footer = view.getByTestId('onboarding-footer');
  const order = [footer].flatMap(function ids(node: any): string[] {
    if (typeof node === 'string') return [];
    return [...(node.props?.testID ? [node.props.testID] : []), ...(node.children ?? []).flatMap(ids)];
  }).filter((id, i, all) => id.startsWith('onboarding-') && all.indexOf(id) === i);
  expect(order).toEqual(['onboarding-footer', 'onboarding-answer', 'onboarding-second-answer', 'onboarding-answer-note']);
  expect(within(footer).getByText('Yes, Mark Them')).toBeTruthy();
  expect(within(footer).getByText('No, Leave Them Free')).toBeTruthy();
  expect(within(footer).getByText('Later, in Profile')).toBeTruthy();

  // The main one purple, the other grey.
  expect(view.UNSAFE_getAllByType(GlassButton).map((button) => [button.props.title, button.props.variant]))
    .toEqual([['Yes, Mark Them', 'purple'], ['No, Leave Them Free', 'glass']]);

  fireEvent.press(view.getByText('Yes, Mark Them'));
  fireEvent.press(view.getByText('No, Leave Them Free'));
  expect(onYes).toHaveBeenCalled();
  expect(onNo).toHaveBeenCalled();
});

it('leaves no answer in the content', () => {
  const view = twoAnswers();
  const content = view.getByTestId('onboarding-content');
  expect(within(content).queryByText('Yes, Mark Them')).toBeNull();
  expect(within(content).queryByText('No, Leave Them Free')).toBeNull();
  expect(within(content).queryByText('Later, in Profile')).toBeNull();
});

it('has no "Next" button, in any language', () => {
  for (const language of ['en', 'ru', 'es', 'de']) {
    mockLanguage.current = language;
    const view = twoAnswers();
    expect(view.queryByText(/^(Next|Далее|Siguiente|Weiter)$/)).toBeNull();
  }
});

it('takes no answer that is disabled', () => {
  const onYes = jest.fn();
  const onNo = jest.fn();
  const view = step({
    answer: { title: 'Yes', onPress: onYes, disabled: true },
    secondAnswer: { title: 'No', onPress: onNo, disabled: true },
  });
  fireEvent.press(view.getByText('Yes'));
  fireEvent.press(view.getByText('No'));
  expect(onYes).not.toHaveBeenCalled();
  expect(onNo).not.toHaveBeenCalled();
});

// T-408: one line made smaller suits the greeting (T-022), not a question. A
// step gives its title its lines, and how small it may be made to fit them.
it('keeps a greeting on one line, made smaller to fit', () => {
  expect(step().getByTestId('onboarding-title').props)
    .toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 });
});

// T-412: given numberOfLines 3 and iOS's own shrinking, the weekends' question
// was not made smaller on the phone: its lines wrapped inside, and «как
// занятые?» was cut off the screen. Its lines are counted as laid out: a point
// smaller while there are more than three, never below 26, never cut.
it('makes a question smaller a point at a time while it wraps past its lines, down to its least, never cut', () => {
  const view = step({ title: 'Отметить все выходные\n(пт)\nкак занятые?', titleLines: 3, titleMinimumScale: 26 / 32 });
  const title = () => view.getByTestId('onboarding-title');
  const size = () => flat(title().props.style).fontSize;
  const laidOut = (lines: number) => fireEvent(title(), 'textLayout', { nativeEvent: { lines: Array(lines).fill({}) } });

  expect(title().props.numberOfLines).toBeUndefined();
  expect(size()).toBe(32);
  laidOut(3);
  expect(size()).toBe(32);
  laidOut(4);
  expect(size()).toBe(31);
  for (let i = 0; i < 10; i += 1) laidOut(4);
  expect(size()).toBe(26);
  laidOut(3);
  expect(size()).toBe(26);
});

it('starts a new title at 32 again', () => {
  const view = step({ title: 'A\nB\nC', titleLines: 3, titleMinimumScale: 26 / 32 });
  fireEvent(view.getByTestId('onboarding-title'), 'textLayout', { nativeEvent: { lines: Array(5).fill({}) } });
  expect(flat(view.getByTestId('onboarding-title').props.style).fontSize).toBe(31);
  view.rerender(
    <OnboardingStep title={'D\nE\nF'} titleLines={3} titleMinimumScale={26 / 32} currentStep={1} totalSteps={5} onSkip={jest.fn()}>
      {null}
    </OnboardingStep>
  );
  expect(flat(view.getByTestId('onboarding-title').props.style).fontSize).toBe(32);
});

it('typesets its texts in the app\'s language, the last line never one word alone', () => {
  mockLanguage.current = 'ru';
  const view = step({
    title: `Отметить все выходные\n(пт${NBSP}и${NBSP}сб)\nкак занятые?`,
    description: 'Любой выходной можно отметить иначе\nв «Занятости».',
    answer: { title: 'Да, отметить', onPress: jest.fn() },
    secondAnswer: { title: 'Не сейчас', onPress: jest.fn(), note: 'Это можно сделать потом: Профиль → Синхронизация' },
  });
  expect(view.getByTestId('onboarding-title').props.children).toBe(`Отметить все выходные\n(пт${NBSP}и${NBSP}сб)\nкак занятые?`);
  expect(view.getByText(`Любой выходной можно отметить иначе\nв${NBSP}«Занятости».`).props.lineBreakStrategyIOS).toBe('push-out');
  expect(view.getByText(`Не${NBSP}сейчас`)).toBeTruthy();
  expect(view.getByText(`Это можно сделать потом: Профиль${NBSP}→ Синхронизация`)).toBeTruthy();
  expect(view.getByTestId('onboarding-title').props.lineBreakStrategyIOS).toBe('push-out');
});

it('says "Skip" and "Back" in the app\'s language', () => {
  mockLanguage.current = 'ru';
  const view = step();
  expect(view.getByText('Пропустить')).toBeTruthy();
  expect(view.getByText('Назад')).toBeTruthy();
  expect(view.queryByText('Skip')).toBeNull();
  expect(view.queryByText('Back')).toBeNull();
});
