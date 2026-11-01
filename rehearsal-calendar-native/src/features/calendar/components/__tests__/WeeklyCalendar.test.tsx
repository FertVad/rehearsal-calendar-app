/**
 * "Today" in the day strip selects today, not only today's week (cause fix
 * 22: DD03). The strip scrolled back and left the day picked before selected,
 * so the list under it went on showing that day. The owner of the selection is
 * written as CalendarScreen holds it: until a day is picked, the day is today.
 */
import React, { useState } from 'react';
import { Text, TouchableOpacity, Dimensions, FlatList, StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import WeeklyCalendar from '../WeeklyCalendar';
import { TouchTarget } from '../../../../shared/constants/colors';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2030-01-10' }));
jest.mock('../../../../hooks/useWeekStart', () => ({
  ...jest.requireActual('../../../../hooks/useWeekStart'),
  useWeekStart: () => 'monday',
}));
// The app's FlatList mock draws every item and holds no ref; this one also
// takes the strip's scrolls, to see where they put it.
const mockScrolls = jest.fn();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  const FlatList = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToOffset: (params: unknown) => mockScrolls(params),
      scrollToIndex: () => {},
    }));
    return React.createElement(actual.FlatList, props);
  });
  return { ...actual, FlatList };
});

const rehearsal = (id: string, day: string) => ({
  id, projectId: 'p', date: day, time: '10:00', endTime: '12:00',
  startsAt: `${day}T15:00:00.000Z`, endsAt: `${day}T17:00:00.000Z`,
}) as any;

function Calendar({ rehearsals = [] }: { rehearsals?: any[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const selectedDate = picked ?? '2030-01-10';
  return (
    <>
      <Text testID="selected">{selectedDate}</Text>
      {/* A day tapped in the strip, two days on. */}
      <TouchableOpacity testID="pick" onPress={() => setPicked('2030-01-12')} />
      <WeeklyCalendar
        rehearsals={rehearsals}
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

/**
 * T-019: the strip was a week to a page, and the day picked could stand at
 * its edge. It is a strip of days now, and the day in its middle is the one
 * selected: a tap brings the day to the middle, a swipe stops on a day and
 * selects it, "Today" brings today there. 72 pt tall, a day 44 or wider.
 */
describe('The day strip', () => {
  const WIDTH = 335; // the strip on an iPhone 16
  const scrolls = mockScrolls;
  beforeEach(() => scrolls.mockClear());

  const strip = (screen: ReturnType<typeof render>) => {
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 72 } } });
    });
    return screen.UNSAFE_getByType(FlatList);
  };
  /** The day under the strip's middle at an offset. */
  const dayInMiddle = (list: any, offset: number): string | undefined => {
    const pad = StyleSheet.flatten(list.props.contentContainerStyle)?.paddingHorizontal ?? 0;
    const { length } = list.props.getItemLayout(list.props.data, 0);
    const index = Math.floor((offset + WIDTH / 2 - pad) / length);
    return list.props.data[index]?.date;
  };
  const lastScroll = () => scrolls.mock.calls[scrolls.mock.calls.length - 1]?.[0]?.offset;

  it('is 72 pt tall, a day 44 pt wide or more', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);

    expect(StyleSheet.flatten(list.props.style)?.height).toBe(72);
    const day = StyleSheet.flatten(screen.getByTestId('calendar-day-2030-01-11').props.style);
    expect(day.width).toBeGreaterThanOrEqual(TouchTarget);
    expect(day.height).toBe(72);
  });

  it('opens with the day selected in its middle', () => {
    const list = strip(render(<Calendar />));
    expect(dayInMiddle(list, list.props.initialScrollIndex * list.props.getItemLayout(list.props.data, 0).length))
      .toBe('2030-01-10');
  });

  it('brings a day tapped at its edge to the middle, and selects it', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);

    fireEvent.press(screen.getByTestId('calendar-day-2030-01-13'));

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-13');
    expect(dayInMiddle(list, lastScroll())).toBe('2030-01-13');
  });

  it('selects the day a swipe stops on', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length } = list.props.getItemLayout(list.props.data, 0);
    const index = list.props.data.findIndex((d: { date: string }) => d.date === '2030-01-15');

    act(() => {
      fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: index * length, y: 0 } } });
    });

    expect(dayInMiddle(list, index * length)).toBe('2030-01-15');
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-15');
  });

  it('brings today to the middle on "Today"', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    fireEvent.press(screen.getByTestId('calendar-day-2030-01-13'));

    fireEvent.press(screen.getByText('Today'));

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
    expect(dayInMiddle(list, lastScroll())).toBe('2030-01-10');
  });

  it('keeps its days 44 pt wide on a 320 pt screen', () => {
    // The mock's own `get` is a jest.fn, which a spy's restore would empty.
    const get = Dimensions.get;
    Dimensions.get = () => ({ width: 320, height: 568, scale: 2, fontScale: 1 });
    try {
      const screen = render(<Calendar />);
      const day = StyleSheet.flatten(screen.getByTestId('calendar-day-2030-01-11').props.style);
      expect(day.width).toBeGreaterThanOrEqual(TouchTarget);
    } finally {
      Dimensions.get = get;
    }
  });
});

/**
 * T-019: the month name opens the month under the header: the week from the
 * profile's day, today the profile's, the days with rehearsals marked. A day
 * picked in it is selected, the month closes, the strip brings the day to its
 * middle. The name again closes it.
 */
describe('The month', () => {
  const { Calendar: MonthGrid } = require('react-native-calendars');
  const scrolls = mockScrolls;
  beforeEach(() => scrolls.mockClear());

  it('opens on the month name, and the name closes it', () => {
    const screen = render(<Calendar />);
    expect(screen.UNSAFE_queryByType(MonthGrid)).toBeNull();

    fireEvent.press(screen.getByTestId('calendar-month'));
    expect(screen.UNSAFE_getByType(MonthGrid)).toBeTruthy();

    fireEvent.press(screen.getByTestId('calendar-month'));
    expect(screen.UNSAFE_queryByType(MonthGrid)).toBeNull();
  });

  it('begins the week on the profile\'s day, today the profile\'s, rehearsal days marked', () => {
    const screen = render(<Calendar rehearsals={[rehearsal('a', '2030-01-11'), rehearsal('b', '2030-01-22')]} />);
    fireEvent.press(screen.getByTestId('calendar-month'));
    const month = screen.UNSAFE_getByType(MonthGrid).props;

    expect(month.firstDay).toBe(1);
    expect(month.markedDates['2030-01-10']).toEqual(expect.objectContaining({ today: true }));
    expect(month.markedDates['2030-01-11']).toEqual(expect.objectContaining({ marked: true }));
    expect(month.markedDates['2030-01-22']).toEqual(expect.objectContaining({ marked: true }));
    expect(month.markedDates['2030-01-12']?.marked).toBeFalsy();
    // A day gone by is there to look at, as any other.
    expect(month.markedDates['2030-01-05']?.disabled).toBeFalsy();
  });

  it('selects a day picked in it, closes, and brings the day to the middle of the strip', () => {
    const screen = render(<Calendar />);
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 335, height: 72 } } });
    });
    fireEvent.press(screen.getByTestId('calendar-month'));

    act(() => screen.UNSAFE_getByType(MonthGrid).props.onDayPress({ dateString: '2030-01-24' }));

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-24');
    expect(screen.UNSAFE_queryByType(MonthGrid)).toBeNull();
    const strip = screen.UNSAFE_getByType(FlatList);
    const { length } = strip.props.getItemLayout(strip.props.data, 0);
    const pad = StyleSheet.flatten(strip.props.contentContainerStyle).paddingHorizontal;
    const offset = scrolls.mock.calls[scrolls.mock.calls.length - 1][0].offset;
    expect(strip.props.data[Math.floor((offset + 335 / 2 - pad) / length)].date).toBe('2030-01-24');
  });
});
