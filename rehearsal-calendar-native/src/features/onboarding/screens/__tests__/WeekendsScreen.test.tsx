/**
 * The onboarding asks about the weekends outright, right after the greeting
 * (T-406): "Mark all weekends (Fri and Sat) as busy?" with the days of the
 * country of the profile's zone — not of the language — and says where it is
 * turned on and off later. The answer is the profile's switch on the server.
 */
import React from 'react';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';
import WeekendsScreen from '../WeekendsScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { weekendDaysOf, weekendDayNames } from '../../../../shared/utils/weekends';
import { translations } from '../../../../i18n/translations';

const mockLanguage = { current: 'ru' };
const mockZone = { current: 'Asia/Jerusalem' };
jest.mock('../../../../shared/services/api', () => ({ availabilityAPI: { setWeekends: jest.fn() } }));
jest.mock('../../../../shared/hooks/useClock', () => ({ useTimezone: () => mockZone.current }));
jest.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));
// The step's real frame, with the real button.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
}));
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

// The days and the path never break inside a line (T-408).
const NBSP = '\u00a0';

it('asks a Russian speaker in Israel about Friday and Saturday, and says where to change it later', () => {
  const view = openStep();
  expect(view.getByTestId('onboarding-title').props.children).toBe(`Отметить все выходные\n(пт${NBSP}и${NBSP}сб)\nкак занятые?`);
  expect(view.getByTestId('onboarding-weekends-note').props.children)
    .toBe(`Это можно включить${NBSP}или${NBSP}выключить позже: Профиль${NBSP}→${NBSP}Выходные${NBSP}заняты`);
});

it('asks about Saturday and Sunday in Moscow, and in a zone of no country', () => {
  mockZone.current = 'Europe/Moscow';
  expect(openStep().getByTestId('onboarding-title').props.children).toBe(`Отметить все выходные\n(сб${NBSP}и${NBSP}вс)\nкак занятые?`);
  mockZone.current = 'UTC';
  mockLanguage.current = 'en';
  expect(openStep().getByTestId('onboarding-title').props.children).toBe(`Mark all weekends\n(Sat${NBSP}and${NBSP}Sun)\nas busy?`);
});

// T-408: on the phone the question was squeezed into one line — about 14.5 pt
// in Russian, smaller than the text under it, cut with "…" at 375 pt. T-412:
// it is three lines by their sense, the days on one of their own, at 32 pt
// made smaller until the longest fits whole — never below 26.
it('gives the question its three lines, the days on one of their own, 32 pt down to 26', () => {
  // At 32 pt, made a point smaller while laid out in more than three lines,
  // down to 26 (OnboardingStep.test.tsx), never cut.
  const question = openStep().getByTestId('onboarding-title');
  for (let i = 0; i < 10; i += 1) fireEvent(question, 'textLayout', { nativeEvent: { lines: Array(4).fill({}) } });
  expect(question.props.numberOfLines).toBeUndefined();
  expect(Object.assign({}, ...[question.props.style].flat(Infinity).filter(Boolean)).fontSize).toBe(26);
  const lines = (language: 'ru' | 'en' | 'es' | 'de', zone: string) => {
    mockLanguage.current = language;
    mockZone.current = zone;
    const view = openStep();
    const text: string = view.getByTestId('onboarding-title').props.children;
    view.unmount();
    return text.split('\n');
  };
  expect(lines('ru', 'Asia/Jerusalem')).toEqual(['Отметить все выходные', `(пт${NBSP}и${NBSP}сб)`, 'как занятые?']);
  expect(lines('ru', 'Asia/Kolkata')).toEqual(['Отметить все выходные', '(вс)', 'как занятые?']);
  expect(lines('en', 'Europe/London')).toEqual(['Mark all weekends', `(Sat${NBSP}and${NBSP}Sun)`, 'as busy?']);
  expect(lines('es', 'Europe/Madrid')).toEqual(['¿Marcar como ocupados', 'todos los fines de semana', `(sáb${NBSP}y${NBSP}dom)?`]);
  expect(lines('de', 'Europe/Berlin')).toEqual(['Alle Wochenenden', `(Sa${NBSP}und${NBSP}So)`, 'als belegt markieren?']);
});

// T-408: iOS names a day alone with a capital ("Пт", Foundation's standalone
// form), Node in lower case: the question said "(Пт и Сб)" on the phone.
it('writes the days inside the question in lower case whatever case iOS gives them', () => {
  const spy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function mock(this: Date) {
    return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][(this.getDay() + 6) % 7];
  });
  try {
    expect(openStep().getByTestId('onboarding-title').props.children).toBe(`Отметить все выходные\n(пт${NBSP}и${NBSP}сб)\nкак занятые?`);
  } finally {
    spy.mockRestore();
  }
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

// Both at the bottom, "Yes" over "No" (T-412); while one is saved, neither
// is taken — "No" only did nothing then, silently.
it('puts "Yes" over "No" at the bottom, and takes neither while an answer is saved', async () => {
  let save: (value: unknown) => void = () => undefined;
  (availabilityAPI.setWeekends as jest.Mock).mockImplementation(() => new Promise((resolve) => { save = resolve; }));
  const view = openStep();
  const footer = view.getByTestId('onboarding-footer');
  expect(within(footer).getByText('Да, отметить')).toBeTruthy();
  expect(within(footer).getByText('Нет, оставить свободными')).toBeTruthy();
  expect(within(view.getByTestId('onboarding-content')).queryByText('Нет, оставить свободными')).toBeNull();

  fireEvent.press(view.getByText('Да, отметить'));
  expect(view.getByTestId('onboarding-answer').props.disabled).toBe(true);
  expect(view.getByTestId('onboarding-second-answer').props.disabled).toBe(true);
  fireEvent.press(view.getByText('Нет, оставить свободными'));
  fireEvent.press(view.getByText('Да, отметить'));
  expect(availabilityAPI.setWeekends).toHaveBeenCalledTimes(1);

  await act(async () => { save({ data: { enabled: true, days: [5, 6] } }); });
  expect(navigation.navigate).toHaveBeenCalledWith('CalendarSync');
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
  expect(names('Asia/Jerusalem', 'ru')).toBe(`пт${NBSP}и${NBSP}сб`);
  expect(names('Asia/Jerusalem', 'en')).toBe(`Fri${NBSP}and${NBSP}Sat`);
  expect(names('Europe/Berlin', 'de')).toBe(`Sa${NBSP}und${NBSP}So`);
  expect(names('Europe/Madrid', 'es')).toBe(`sáb${NBSP}y${NBSP}dom`);
  expect(names('Asia/Kolkata', 'en')).toBe('Sun');
  expect(names('Asia/Kabul', 'ru')).toBe(`чт${NBSP}и${NBSP}пт`);
});
