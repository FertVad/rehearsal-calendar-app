/**
 * The screens write a date one way in each language (T-028, owner's decision
 * 02.11.2026; audit, "Русский текст", screenshots 73 and 76). The same month
 * read "октябрь 2026 г." over the calendar's strip and "Ноябрь 2026" in the
 * availability's months, and `textTransform: 'capitalize'` made "Чт, 29 Окт."
 * of the planner's day and "Ближайшие События" of a section's title. Now the
 * first letter is a capital and the rest is as Intl writes it.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import WeeklyCalendar from '../../../features/calendar/components/WeeklyCalendar';
import { CalendarMonth } from '../../../features/availability/components/calendar/CalendarMonth';
import { DayCard } from '../../../features/smart-planner/components/DayCard';

let mockLanguage = 'ru';
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations[mockLanguage], language: mockLanguage }),
}));
jest.mock('../../hooks/useClock', () => ({ useToday: () => '2026-10-29' }));
jest.mock('../../../hooks/useWeekStart', () => ({
  ...jest.requireActual('../../../hooks/useWeekStart'),
  useWeekStart: () => 'monday',
}));

const LANGUAGES = [
  // The calendar's strip in October, the availability's November, the planner's Thursday.
  ['ru', 'Октябрь 2026 г.', 'Ноябрь 2026 г.', 'Чт, 29 окт.'],
  ['en', 'October 2026', 'November 2026', 'Thu, Oct 29'],
  ['es', 'Octubre de 2026', 'Noviembre de 2026', 'Jue, 29 oct'],
  ['de', 'Oktober 2026', 'November 2026', 'Do., 29. Okt.'],
] as const;

describe.each(LANGUAGES)('in %s', (language, october, november, thursday) => {
  beforeEach(() => { mockLanguage = language; });

  it('the calendar names the month over its strip', () => {
    const screen = render(
      <WeeklyCalendar rehearsals={[]} onDaySelect={jest.fn()} onShowToday={jest.fn()} selectedDate="2026-10-29" />,
    );
    expect(screen.getByTestId('calendar-month')).toContainElement(screen.getByText(october));
  });

  it('the availability names a month the same way', () => {
    const screen = render(
      <CalendarMonth year={2026} month={10} selectedDates={[]} availability={{}} today="2026-10-29"
        onDayPress={jest.fn()} getDayStatus={() => 'none'} />,
    );
    expect(screen.getByText(november)).toBeTruthy();
  });

  it('the planner names a day with a capital first letter only', () => {
    const screen = render(<DayCard date="2026-10-29" slots={[]} />);
    const day = screen.getByText(thursday);
    expect(StyleSheet.flatten(day.props.style).textTransform).toBeUndefined();
  });
});

it('no style capitalizes every word', () => {
  const src = path.resolve(__dirname, '../../..');
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
  const capitalizing = walk(src)
    .filter((file) => /textTransform:\s*['"]capitalize['"]/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(src, file));

  expect(capitalizing).toEqual([]);
});
