/**
 * Onboarding's last step says where things are, in the app's own labels
 * (T-022), and writes the week's first day as the phone's region has it — the
 * step that asked for it is gone (HIG: "Respect people's systemwide settings").
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { getCalendars } from 'expo-localization';
import WhatWhereScreen from '../WhatWhereScreen';
import { translations } from '../../../../i18n/translations';
import { typeset } from '../../../../shared/utils/typeset';

// The real button, without the rest of the components' index.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
}));
const mockLanguage = { current: 'en' };
const mockUpdateUser = jest.fn().mockResolvedValue(undefined);
const mockComplete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ updateUser: mockUpdateUser }) }));
jest.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({ completeOnboarding: mockComplete, skipOnboarding: jest.fn(), isCompleting: false }),
}));

const calendars = getCalendars as jest.Mock;
const DEFAULT_CALENDARS = calendars.getMockImplementation();

afterEach(() => {
  mockLanguage.current = 'en';
  calendars.mockImplementation(DEFAULT_CALENDARS);
  jest.clearAllMocks();
});

const open = () => render(<WhatWhereScreen navigation={{ goBack: jest.fn() } as any} route={{} as any} />);

it.each(['ru', 'en', 'es', 'de'] as const)('names each place by the label the app shows there (%s)', (language) => {
  mockLanguage.current = language;
  const t = translations[language];
  const view = open();
  const text = (id: string) => [view.getByTestId(`what-where-${id}`)].flatMap(function all(node: any): string[] {
    return typeof node === 'string' ? [node] : (node.children ?? []).flatMap(all);
  }).join(' ');

  // Typeset, as every text of the steps is (T-412), and whole where the
  // native speaker said so (T-417): every space of the label a no-break one.
  // Russian "Присоединиться по коду" is not whole, only typeset.
  const label = (words: string) => typeset(words, language);
  const whole = (words: string) => words.replace(/ /g, '\u00a0');
  const project = text('project');
  expect(project).toContain(whole(t.actionSheet.createProject));
  expect(project).toContain(label(t.nav.projects));
  expect(project).toContain(language === 'ru' ? label(t.projects.haveInvite) : whole(t.projects.haveInvite));
  expect(text('rehearsal')).toContain(whole(t.actionSheet.createRehearsal));
  expect(text('availability')).toContain(whole(t.actionSheet.markBusy));
  expect(text('planner')).toContain(whole(t.smartPlanner.title));
});

it('keeps Russian "Присоединиться по коду" not whole in "Что где": a large size breaks it before "по коду"', () => {
  mockLanguage.current = 'ru';
  const view = open();
  const where = view.getByTestId('what-where-project');
  const text = [where].flatMap(function all(node: any): string[] {
    return typeof node === 'string' ? [node] : (node.children ?? []).flatMap(all);
  }).join(' ');
  expect(text).toContain('«Присоединиться по\u00a0коду»');
});

it.each([
  [1, 'sunday'],
  [2, 'monday'],
  [7, 'monday'],
])('writes the week as the phone starts it (firstWeekday %s: %s), then ends onboarding', async (firstWeekday, weekStartDay) => {
  calendars.mockReturnValue([{ uses24hourClock: true, firstWeekday }]);
  const view = open();

  await act(async () => { fireEvent.press(view.getByText('Get Started')); });

  expect(mockUpdateUser).toHaveBeenCalledWith({ weekStartDay });
  expect(mockComplete).toHaveBeenCalled();
});
