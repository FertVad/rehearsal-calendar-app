/**
 * The month calendars' days as they are drawn (T-031 review): the day picked
 * is filled with purpleFill under its white digit, and today is ringed in
 * purple with a digit of the text's colour — told apart from the day picked
 * by the fill, and its digit at 4.5:1 at least (T-027). The rehearsal form's
 * month (DayCalendar) and the period picker (DateRangePicker) draw the
 * library's period day, which fills a marked day with the marking's colour,
 * not the theme's; the availability month (CalendarMonth) draws its own.
 * The library's arrows, its own blue unless told, are purple.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Colors } from '../../constants/colors';

jest.mock('react-native-calendars', () => ({
  Calendar: jest.requireActual('react-native-calendars/src/calendar/index.js').default,
  LocaleConfig: jest.requireActual('xdate'),
}));
jest.mock('react-native-calendars/src/calendar/img/previous.png', () => 1);
jest.mock('react-native-calendars/src/calendar/img/next.png', () => 2);
jest.mock('react-native-swipe-gestures', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
});
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    TouchableWithoutFeedback: actual.TouchableOpacity,
    I18nManager: { isRTL: false },
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
  };
});
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));
jest.mock('../../hooks/useClock', () => {
  const actual = jest.requireActual('../../hooks/useClock');
  return { ...actual, useToday: () => '2026-11-02' };
});

import { DayCalendar } from '../DayCalendar';
import { DateRangePicker } from '../DateRangePicker';
import { CalendarMonth } from '../../../features/availability/components/calendar/CalendarMonth';

/** WCAG 2.x relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Later entries win, as in React Native (the test mock's flatten does not). */
const flatten = (style: unknown): Record<string, any> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style as Record<string, any>) ?? {};

type Node = ReturnType<ReturnType<typeof render>['getByTestId']>;

/** What a day is drawn with: the fills, the rings, its digit's colour. */
function drawn(day: Node) {
  const hosts = [day, ...day.findAll((node) => typeof node.type === 'string')];
  const styles = hosts.map((node) => flatten(node.props.style));
  const text = hosts.find((node) => node.type === 'Text');
  return {
    fills: styles.map((style) => style.backgroundColor).filter((colour) => colour && colour !== 'rgba(0, 0, 0, 0)'),
    rings: styles.filter((style) => style.borderWidth > 0).map((style) => style.borderColor),
    digit: flatten(text?.props.style).color as string,
  };
}

function expectPicked(day: Node) {
  const { fills, digit } = drawn(day);
  expect(fills).toContain(Colors.accent.purpleFill);
  expect(fills).not.toContain(Colors.accent.purple);
  expect(contrast(digit, Colors.accent.purpleFill)).toBeGreaterThanOrEqual(4.5);
}

function expectToday(day: Node, background: string) {
  const { fills, rings, digit } = drawn(day);
  expect(rings).toContain(Colors.accent.purple);
  expect(fills).not.toContain(Colors.accent.purpleFill);
  expect(contrast(digit, background)).toBeGreaterThanOrEqual(4.5);
}

it('the rehearsal form\'s month: the day picked on purpleFill, today ringed', () => {
  const view = render(<DayCalendar value="2026-11-05" onChange={jest.fn()} testID="cal" />);
  expectPicked(view.getByTestId('cal.day_2026-11-05', { includeHiddenElements: true }));
  expectToday(view.getByTestId('cal.day_2026-11-02', { includeHiddenElements: true }), Colors.bg.secondary);
});

it("the month's arrows are purple, not the library's blue", () => {
  const view = render(<DayCalendar value="2026-11-05" onChange={jest.fn()} testID="cal" />);
  const arrows = view.UNSAFE_root.findAll((node) => node.type === 'Image');
  expect(arrows.length).toBeGreaterThan(0);
  arrows.forEach((arrow) => expect(flatten(arrow.props.style).tintColor).toBe(Colors.accent.purple));
});

it('the period picker: both ends on purpleFill, today ringed', () => {
  const view = render(
    <DateRangePicker
      visible
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      initialStartDate={new Date(2026, 10, 10)}
      initialEndDate={new Date(2026, 10, 12)}
    />,
  );
  expectPicked(view.getByTestId('date-range-calendar.day_2026-11-10', { includeHiddenElements: true }));
  expectPicked(view.getByTestId('date-range-calendar.day_2026-11-12', { includeHiddenElements: true }));
  expectToday(view.getByTestId('date-range-calendar.day_2026-11-02', { includeHiddenElements: true }), Colors.bg.secondary);
});

it('the availability month: the days picked on purpleFill, today ringed', () => {
  const view = render(
    <CalendarMonth
      year={2026}
      month={10}
      selectedDates={['2026-11-05']}
      availability={{}}
      today="2026-11-02"
      onDayPress={jest.fn()}
      getDayStatus={() => 'none'}
    />,
  );
  expectPicked(view.getByTestId('day-2026-11-05'));
  expectToday(view.getByTestId('day-2026-11-02'), Colors.bg.primary);
});
