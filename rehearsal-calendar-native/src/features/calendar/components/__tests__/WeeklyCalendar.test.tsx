/**
 * "Today" in the week strip selects today, not only today's week (cause fix
 * 22: DD03). The strip scrolled back and left the day picked before selected,
 * so the list under it went on showing that day. The owner of the selection is
 * written as CalendarScreen holds it: until a day is picked, the day is today.
 */
import React, { useState } from 'react';
import { Text, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import WeeklyCalendar from '../WeeklyCalendar';
import { Spacing, TouchTarget } from '../../../../shared/constants/colors';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2030-01-10' }));
jest.mock('../../../../hooks/useWeekStart', () => ({
  ...jest.requireActual('../../../../hooks/useWeekStart'),
  useWeekStart: () => 'monday',
}));

function Calendar() {
  const [picked, setPicked] = useState<string | null>(null);
  const selectedDate = picked ?? '2030-01-10';
  return (
    <>
      <Text testID="selected">{selectedDate}</Text>
      {/* A day tapped in the strip, two days on. */}
      <TouchableOpacity testID="pick" onPress={() => setPicked('2030-01-12')} />
      <WeeklyCalendar
        rehearsals={[]}
        onDaySelect={setPicked}
        onShowToday={() => setPicked(null)}
        selectedDate={selectedDate}
      />
    </>
  );
}

it('selects today when "Today" is pressed after another day was picked', () => {
  const screen = render(<Calendar />);
  fireEvent.press(screen.getByTestId('pick'));
  expect(screen.getByTestId('selected').props.children).toBe('2030-01-12');

  fireEvent.press(screen.getByText('Today'));

  expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
});

// The count of a day's rehearsals sat in the cell's top right corner, absolute,
// over the day's name: on an iPhone the cells are 42-46 pt wide, and "Fri",
// "Sat" and "Sun" ran under it (T-011). It is in the cell's column now, under
// the date, in a slot every cell keeps so the cells stay one height.
it('puts a day\'s count under its date, not over its name', () => {
  const rehearsal = (id: string, day: string) => ({
    id, projectId: 'p', date: day, time: '10:00', endTime: '12:00',
    startsAt: `${day}T15:00:00.000Z`, endsAt: `${day}T17:00:00.000Z`,
  }) as any;
  const screen = render(
    <WeeklyCalendar
      rehearsals={[rehearsal('a', '2030-01-11'), rehearsal('b', '2030-01-11')]}
      onDaySelect={jest.fn()}
      onShowToday={jest.fn()}
      selectedDate="2030-01-10"
    />
  );
  const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

  const count = screen.getByTestId('calendar-day-count-2030-01-11');
  expect(count).toHaveTextContent('2');
  expect(flat(count.props.style).position).not.toBe('absolute');

  // A day with none keeps the slot, empty, so every cell is one height.
  const none = screen.getByTestId('calendar-day-count-2030-01-12');
  expect(none).not.toHaveTextContent(/\d/);
  expect(flat(none.props.style).height).toBe(flat(count.props.style).height);
});

// Seven days of 44 pt want 308 (T-014). On a 320 pt screen — an SE with
// Display Zoom — the strip was given 252 and paged by 256: the days at the
// ends left their page and were cut or lay under the next week's (T-014
// review). The calendar sits in the screen's margin of Spacing.xl.
it('fits seven days of 44 pt on a 320 pt screen, and pages by the page it has', () => {
  const dimensions = jest.spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
  try {
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    const screen = render(
      <WeeklyCalendar rehearsals={[]} onDaySelect={jest.fn()} onShowToday={jest.fn()} selectedDate="2030-01-10" />
    );

    const card = flat((screen.toJSON() as any).props.style);
    const margin = Spacing.xl + (card.marginHorizontal ?? card.marginLeft ?? 0);
    const inset = (card.borderWidth ?? 0) + (card.paddingHorizontal ?? card.padding ?? 0);
    expect(margin).toBeGreaterThanOrEqual(0); // on the screen still
    const strip = 320 - 2 * margin - 2 * inset;
    expect(strip).toBeGreaterThanOrEqual(7 * TouchTarget);

    const list = screen.UNSAFE_getByType(FlatList);
    fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: strip, height: 80 } } });

    const weeks = screen.UNSAFE_getByType(FlatList);
    const page = weeks.props.renderItem({ item: weeks.props.data[0], index: 0 });
    expect(flat(page.props.style).width).toBe(strip);
    expect(weeks.props.getItemLayout(weeks.props.data, 1)).toMatchObject({ length: strip, offset: strip });
    // The days take the page between them and no more.
    expect(flat(page.props.style).paddingHorizontal ?? 0).toBe(0);
  } finally {
    dimensions.mockRestore();
  }
});
