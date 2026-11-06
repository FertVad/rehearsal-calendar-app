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

  const project = text('project');
  expect(project).toContain(t.actionSheet.createProject);
  expect(project).toContain(t.nav.projects);
  expect(project).toContain(t.projects.haveInvite);
  expect(text('rehearsal')).toContain(t.actionSheet.createRehearsal);
  expect(text('availability')).toContain(t.actionSheet.markBusy);
  expect(text('planner')).toContain(t.smartPlanner.title);
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
