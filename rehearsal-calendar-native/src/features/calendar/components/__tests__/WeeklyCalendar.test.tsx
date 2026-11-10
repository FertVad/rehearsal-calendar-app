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

/** The strip stops with `day` under its frame, as a scroll's end does. */
const stopOn = (screen: ReturnType<typeof render>, day: string) => {
  const list = screen.UNSAFE_getByType(FlatList);
  const { length } = list.props.getItemLayout(list.props.data, 0);
  const index = list.props.data.findIndex((d: { date: string }) => d.date === day);
  act(() => {
    fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: index * length, y: 0 } } });
  });
};

it('selects today when "Today" is pressed after another day was picked', () => {
  const screen = render(<Calendar />);
  fireEvent.press(screen.getByTestId('pick'));
  stopOn(screen, '2030-01-12');
  expect(screen.getByTestId('selected').props.children).toBe('2030-01-12');

  fireEvent.press(screen.getByText('Today'));
  stopOn(screen, '2030-01-10');

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
    expect(dayInMiddle(list, lastScroll())).toBe('2030-01-13');
    stopOn(screen, '2030-01-13');

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-13');
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
    stopOn(screen, '2030-01-13');

    fireEvent.press(screen.getByText('Today'));
    expect(dayInMiddle(list, lastScroll())).toBe('2030-01-10');
    stopOn(screen, '2030-01-10');

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
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
 * T-035: the strip turns as the wheel of a time picker does (owner, 04.11).
 * A frame stands still in its middle and the day in it is the one selected:
 * while the strip moves the highlight does not ride away with its cell, the
 * next day comes under the frame. Every day crossing the middle gives a
 * selection tick, as the time wheel's; the list under the strip changes to
 * the day only where the strip stops. It stayed on the day picked before,
 * and the day was chosen, with a medium thump, only on stopping.
 */
describe('The day strip as a wheel', () => {
  const Haptics = require('expo-haptics');
  const WIDTH = 335;
  beforeEach(() => {
    mockScrolls.mockClear();
    Haptics.selectionAsync.mockClear();
    Haptics.impactAsync.mockClear();
  });

  const strip = (screen: ReturnType<typeof render>) => {
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 72 } } });
    });
    return screen.UNSAFE_getByType(FlatList);
  };
  const geometry = (list: any) => {
    const { length } = list.props.getItemLayout(list.props.data, 0);
    const indexOf = (day: string) => list.props.data.findIndex((d: { date: string }) => d.date === day);
    return { length, offsetOf: (day: string) => indexOf(day) * length };
  };
  const scrollTo = (list: any, x: number) => act(() => {
    fireEvent(list, 'scroll', { nativeEvent: { contentOffset: { x, y: 0 } } });
  });
  const highlighted = (screen: ReturnType<typeof render>, day: string) =>
    screen.getByTestId(`calendar-day-${day}`).props.accessibilityState?.selected;

  it('ticks once for every day crossing the middle, and selects only where it stops', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    const start = offsetOf('2030-01-10');

    // Under half a day: still the 10th, no tick.
    scrollTo(list, start + length * 0.4);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(0);
    // The 11th, the 12th, then the 13th under the frame.
    scrollTo(list, start + length * 0.6);
    scrollTo(list, start + length * 1.2);
    scrollTo(list, start + length * 1.7);
    scrollTo(list, start + length * 2.6);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);

    // The highlight is the day under the frame, not the cell that had it...
    expect(highlighted(screen, '2030-01-13')).toBe(true);
    expect(highlighted(screen, '2030-01-10')).toBe(false);
    // ...and the list under the strip has not moved yet.
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');

    // It stops on the 13th: the day is chosen, with no second tick or thump.
    act(() => {
      fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: offsetOf('2030-01-13'), y: 0 } } });
    });
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-13');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    // Chosen where it stands: not scrolled anywhere else.
    expect(mockScrolls).not.toHaveBeenCalled();
  });

  it('ticks back the same way, a day at a time', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    const start = offsetOf('2030-01-10');

    scrollTo(list, start - length * 0.6);
    scrollTo(list, start - length * 1.6);
    scrollTo(list, start - length * 0.9); // and back one
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(highlighted(screen, '2030-01-09')).toBe(true);
  });

  it('brings a tapped day under the frame with the same ticks, no thump', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    const start = offsetOf('2030-01-10');

    fireEvent.press(screen.getByTestId('calendar-day-2030-01-13'));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(mockScrolls).toHaveBeenLastCalledWith({ offset: offsetOf('2030-01-13'), animated: true });
    // Until the strip has moved, the frame still has the 10th.
    expect(highlighted(screen, '2030-01-10')).toBe(true);

    // The animation passes the 11th and the 12th to the 13th; the list stays.
    for (const step of [0.5, 1, 1.5, 2, 2.5, 3]) scrollTo(list, start + length * step);
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
    act(() => {
      fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: start + 3 * length, y: 0 } } });
    });
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(highlighted(screen, '2030-01-13')).toBe(true);
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-13');
  });

  it('brings today back with ticks, no thump', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    fireEvent.press(screen.getByTestId('calendar-day-2030-01-12'));
    for (const step of [1, 2]) scrollTo(list, offsetOf('2030-01-10') + length * step);
    Haptics.selectionAsync.mockClear();

    fireEvent.press(screen.getByText('Today'));
    for (const step of [1, 0]) scrollTo(list, offsetOf('2030-01-10') + length * step);

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
    expect(highlighted(screen, '2030-01-10')).toBe(true);
  });

  it('does not let an interrupted swipe take the day a tap sent it to', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { offsetOf } = geometry(list);

    fireEvent.press(screen.getByTestId('calendar-day-2030-01-14'));
    // A fling's end on the way, a day short.
    act(() => {
      fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: offsetOf('2030-01-13'), y: 0 } } });
    });
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
    stopOn(screen, '2030-01-14');
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-14');
  });

  // A tap, "Today" and the month chose their day at once: the list under the
  // strip showed the 13th while the frame still had the 10th (review, T-035).
  it('hands on a tapped day, "Today" and a month\'s day only where the strip stops on them', () => {
    const MonthGrid = require('react-native-calendars/src/calendar').default;
    const onDaySelect = jest.fn();
    const onShowToday = jest.fn();
    const screen = render(
      <WeeklyCalendar rehearsals={[]} onDaySelect={onDaySelect} onShowToday={onShowToday} selectedDate="2030-01-10" />
    );
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    const start = offsetOf('2030-01-10');

    // A tap: on its way, nothing handed on; stopped on the 13th, the 13th.
    fireEvent.press(screen.getByTestId('calendar-day-2030-01-13'));
    scrollTo(list, start + length);
    expect(onDaySelect).not.toHaveBeenCalled();
    stopOn(screen, '2030-01-13');
    expect(onDaySelect).toHaveBeenLastCalledWith('2030-01-13');
    screen.rerender(
      <WeeklyCalendar rehearsals={[]} onDaySelect={onDaySelect} onShowToday={onShowToday} selectedDate="2030-01-13" />
    );
    onDaySelect.mockClear();

    // "Today": today to follow, once the strip is back on it.
    fireEvent.press(screen.getByText('Today'));
    scrollTo(list, start + length);
    expect(onShowToday).not.toHaveBeenCalled();
    stopOn(screen, '2030-01-10');
    expect(onShowToday).toHaveBeenCalledTimes(1);
    expect(onDaySelect).not.toHaveBeenCalled();
    screen.rerender(
      <WeeklyCalendar rehearsals={[]} onDaySelect={onDaySelect} onShowToday={onShowToday} selectedDate="2030-01-10" />
    );

    // The month: the day picked, once the strip stops on it.
    fireEvent.press(screen.getByTestId('calendar-month'));
    act(() => screen.UNSAFE_getByType(MonthGrid).props.onDayPress({ dateString: '2030-01-24' }));
    scrollTo(list, start + 5 * length);
    expect(onDaySelect).not.toHaveBeenCalled();
    stopOn(screen, '2030-01-24');
    expect(onDaySelect).toHaveBeenLastCalledWith('2030-01-24');
  });

  it('hands on a day tapped where the frame already is, with no scroll to wait for', () => {
    const onShowToday = jest.fn();
    const screen = render(
      <WeeklyCalendar rehearsals={[]} onDaySelect={jest.fn()} onShowToday={onShowToday} selectedDate="2030-01-10" />
    );
    strip(screen);
    fireEvent.press(screen.getByText('Today'));
    expect(onShowToday).toHaveBeenCalledTimes(1);
  });

  // One tick for a change of day, not for each day crossed: a fling or the
  // long way to a month's day passes several days between two events.
  it('ticks for every day one event jumps over', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const { length, offsetOf } = geometry(list);
    const start = offsetOf('2030-01-10');

    scrollTo(list, start + 3 * length);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(highlighted(screen, '2030-01-13')).toBe(true);

    // Back four at once to the 9th, then two more seen only at the stop.
    scrollTo(list, start - length);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(7);
    stopOn(screen, '2030-01-07');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(9);
    expect(screen.getByTestId('selected').props.children).toBe('2030-01-07');
  });

  // A finger let go with speed just on a day's edge was taken as the stop:
  // the list changed to the 11th at once, then to the 14th where the strip
  // came to rest (review 2, T-035). The stop is where it rests.
  describe('let go by the finger', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const drag = (list: any, name: string, x: number, velocity = 0) => act(() => {
      fireEvent(list, name, { nativeEvent: { contentOffset: { x, y: 0 }, velocity: { x: velocity, y: 0 } } });
    });

    it('chooses nothing on a let-go with speed on a day\'s edge, then once where it rests', () => {
      const onDaySelect = jest.fn();
      const screen = render(
        <WeeklyCalendar rehearsals={[]} onDaySelect={onDaySelect} onShowToday={jest.fn()} selectedDate="2030-01-10" />
      );
      const list = strip(screen);
      const { offsetOf } = geometry(list);

      drag(list, 'scrollBeginDrag', offsetOf('2030-01-10'));
      scrollTo(list, offsetOf('2030-01-11'));
      drag(list, 'scrollEndDrag', offsetOf('2030-01-11'), 1.8);
      drag(list, 'momentumScrollBegin', offsetOf('2030-01-11'));
      act(() => { jest.advanceTimersByTime(1000); });
      expect(onDaySelect).not.toHaveBeenCalled();

      scrollTo(list, offsetOf('2030-01-13'));
      expect(onDaySelect).not.toHaveBeenCalled();
      drag(list, 'momentumScrollEnd', offsetOf('2030-01-14'));
      act(() => { jest.advanceTimersByTime(1000); });
      expect(onDaySelect).toHaveBeenCalledTimes(1);
      expect(onDaySelect).toHaveBeenCalledWith('2030-01-14');
    });

    it('chooses the day let go on when no momentum follows', () => {
      const onDaySelect = jest.fn();
      const screen = render(
        <WeeklyCalendar rehearsals={[]} onDaySelect={onDaySelect} onShowToday={jest.fn()} selectedDate="2030-01-10" />
      );
      const list = strip(screen);
      const { offsetOf } = geometry(list);

      drag(list, 'scrollBeginDrag', offsetOf('2030-01-10'));
      scrollTo(list, offsetOf('2030-01-12'));
      drag(list, 'scrollEndDrag', offsetOf('2030-01-12'));
      act(() => { jest.advanceTimersByTime(1000); });
      expect(onDaySelect).toHaveBeenCalledTimes(1);
      expect(onDaySelect).toHaveBeenCalledWith('2030-01-12');
    });
  });

  it('has a frame standing in its middle, as wide as a day', () => {
    const screen = render(<Calendar />);
    const list = strip(screen);
    const style = screen.getByTestId('calendar-strip-frame').props.style;
    const frame = Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    const { length } = geometry(list);

    expect(frame.position).toBe('absolute');
    expect(frame.left + frame.width / 2).toBeCloseTo(WIDTH / 2);
    expect(frame.width).toBeLessThanOrEqual(length);
    expect(screen.getByTestId('calendar-strip-frame').props.pointerEvents).toBe('none');
  });
});

/**
 * T-019: the month name opens the month under the header: the week from the
 * profile's day, today the profile's, the days with rehearsals marked. A day
 * picked in it is selected, the month closes, the strip brings the day to its
 * middle. The name again closes it.
 */
describe('The month', () => {
  const MonthGrid = require('react-native-calendars/src/calendar').default;
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

    expect(screen.UNSAFE_queryByType(MonthGrid)).toBeNull();
    const strip = screen.UNSAFE_getByType(FlatList);
    const { length } = strip.props.getItemLayout(strip.props.data, 0);
    const pad = StyleSheet.flatten(strip.props.contentContainerStyle).paddingHorizontal;
    const offset = scrolls.mock.calls[scrolls.mock.calls.length - 1][0].offset;
    expect(strip.props.data[Math.floor((offset + 335 / 2 - pad) / length)].date).toBe('2030-01-24');
    stopOn(screen, '2030-01-24');

    expect(screen.getByTestId('selected').props.children).toBe('2030-01-24');
  });
});
