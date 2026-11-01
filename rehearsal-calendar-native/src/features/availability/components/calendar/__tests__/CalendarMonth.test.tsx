/**
 * The month says where today's week begins, as it was drawn (T-021): the
 * grid's place in the month and today's row in the grid. The screen scrolls
 * there on opening; offsets added up from font sizes missed the real text
 * heights.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CalendarMonth } from '../CalendarMonth';

jest.mock('../../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));

const layout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 40, height: 40 } } });

const month = (onTodayLayout?: (y: number) => void) => render(
  <CalendarMonth
    year={2026}
    month={9}
    selectedDates={[]}
    availability={{}}
    today="2026-10-29"
    onDayPress={jest.fn()}
    getDayStatus={() => 'none'}
    onTodayLayout={onTodayLayout}
  />
);

it('reports today\'s week from the top of the month, once both are laid out', () => {
  const onTodayLayout = jest.fn();
  const screen = month(onTodayLayout);
  const today = screen.getByTestId('day-2026-10-29');
  let grid = today.parent;
  while (grid && !(grid.props.onLayout && grid.props.testID === undefined)) grid = grid.parent;

  fireEvent(today, 'layout', layout(176));
  expect(onTodayLayout).not.toHaveBeenCalled();

  fireEvent(grid!, 'layout', layout(52));
  expect(onTodayLayout).toHaveBeenCalledWith(228);
});

it('another day, or a month asked for nothing, reports nothing', () => {
  const screen = month();
  expect(screen.getByTestId('day-2026-10-29').props.onLayout).toBeUndefined();

  const asked = month(jest.fn());
  expect(asked.getByTestId('day-2026-10-28').props.onLayout).toBeUndefined();
});
