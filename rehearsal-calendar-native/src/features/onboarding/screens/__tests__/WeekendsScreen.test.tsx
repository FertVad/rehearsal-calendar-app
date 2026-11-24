/**
 * The onboarding asks about the weekends outright, right after the greeting
 * (T-406): "Mark all weekends (Fri and Sat) as busy?" with the days of the
 * country of the profile's zone — not of the language — and says where it is
 * turned on and off later. The answer is the profile's switch on the server.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WeekendsScreen from '../WeekendsScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { weekendDaysOf, weekendDayNames } from '../../../../shared/utils/weekends';
import { translations } from '../../../../i18n/translations';

const mockLanguage = { current: 'ru' };
const mockZone = { current: 'Asia/Jerusalem' };
jest.mock('../../../../shared/services/api', () => ({ availabilityAPI: { setWeekends: jest.fn() } }));
jest.mock('../../../../shared/hooks/useClock', () => ({ useTimezone: () => mockZone.current }));
jest.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));
jest.mock('../../components', () => {
  const { Text } = require('react-native');
  return {
    OnboardingStep: ({ title, description, children, onNext, nextButtonTitle, secondaryAction }: any) => (
      <>
        <Text testID="title">{title}</Text>
        <Text>{description}</Text>
        {children}
        <Text onPress={secondaryAction.onPress}>{secondaryAction.title}</Text>
        <Text onPress={onNext}>{nextButtonTitle}</Text>
      </>
    ),
  };
});
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const openStep = () => render(<WeekendsScreen navigation={navigation as any} route={{} as any} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage.current = 'ru';
  mockZone.current = 'Asia/Jerusalem';
});

it('asks a Russian speaker in Israel about Friday and Saturday, and says where to change it later', () => {
  const view = openStep();
  expect(view.getByTestId('title').props.children).toBe('Отметить все выходные (пт и сб) как занятые?');
  expect(view.getByTestId('onboarding-weekends-note').props.children)
    .toBe('Это можно включить и выключить позже: Профиль → Выходные заняты');
});

it('asks about Saturday and Sunday in Moscow, and in a zone of no country', () => {
  mockZone.current = 'Europe/Moscow';
  expect(openStep().getByTestId('title').props.children).toBe('Отметить все выходные (сб и вс) как занятые?');
  mockZone.current = 'UTC';
  mockLanguage.current = 'en';
  expect(openStep().getByTestId('title').props.children).toBe('Mark all weekends (Sat and Sun) as busy?');
});

it('"Yes" keeps the switch on, "No" turns it off, each saved before the next step', async () => {
  (availabilityAPI.setWeekends as jest.Mock).mockResolvedValue({ data: { enabled: true, days: [5, 6] } });
  const yes = openStep();
  fireEvent.press(yes.getByText('Да, отметить'));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CalendarSync'));
  expect(availabilityAPI.setWeekends).toHaveBeenCalledWith(true);

  jest.clearAllMocks();
  const no = openStep();
  fireEvent.press(no.getByText('Нет, оставить свободными'));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CalendarSync'));
  expect(availabilityAPI.setWeekends).toHaveBeenCalledWith(false);
});

it('stays on the step when the answer could not be saved', async () => {
  (availabilityAPI.setWeekends as jest.Mock).mockRejectedValue(new Error('down'));
  const view = openStep();
  fireEvent.press(view.getByText('Нет, оставить свободными'));
  await waitFor(() => expect(availabilityAPI.setWeekends).toHaveBeenCalledWith(false));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

it('names the days in each language from the date formats (T-028)', () => {
  const names = (zone: string, language: 'ru' | 'en' | 'es' | 'de') =>
    weekendDayNames(weekendDaysOf(zone), language, translations[language].profile.weekendDaysJoin);
  expect(names('Asia/Jerusalem', 'ru')).toBe('пт и сб');
  expect(names('Asia/Jerusalem', 'en')).toBe('Fri and Sat');
  expect(names('Europe/Berlin', 'de')).toBe('Sa und So');
  expect(names('Europe/Madrid', 'es')).toBe('sáb y dom');
  expect(names('Asia/Kolkata', 'en')).toBe('Sun');
  expect(names('Asia/Kabul', 'ru')).toBe('чт и пт');
});
