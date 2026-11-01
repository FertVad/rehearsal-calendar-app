/**
 * What every react-native-calendars calendar of the app shares: its words,
 * the profile's today, a day of 44×44 and its colours. The period picker
 * (DateRangePicker) and the rehearsal form's date (DayCalendar) both draw
 * their days with these.
 */
import React from 'react';
import { DateData, LocaleConfig } from 'react-native-calendars';
import PeriodDay, { PeriodDayProps } from 'react-native-calendars/src/calendar/day/period';
import { Colors, FontSize, FontWeight, TouchTarget } from '../constants/colors';
import { parseDateString } from '../utils/time';

// Configure locales for react-native-calendars. Its word for "today" is not
// used: the library's today is the phone's date, and the picker's days name
// the profile's themselves (dayComponent below).
LocaleConfig.locales['ru'] = {
  monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: ''
};

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  today: ''
};

/**
 * Today is the profile's (CLAUDE.md, dates). react-native-calendars marks the
 * phone's date as today, which it takes from the device clock and has no prop
 * for: in Honolulu with a profile in Europe it marked the 28th while the first
 * day it would take was the 29th. A day's marking overrides it, so the phone's
 * date is unmarked — and, before `minDate`, shown as the past it is — and the
 * profile's date is marked.
 */
export function withToday(
  marked: { [key: string]: any },
  today: string,
  phoneToday: string,
  minDate: string | undefined,
): { [key: string]: any } {
  const result = { ...marked };
  if (phoneToday !== today) {
    result[phoneToday] = {
      ...result[phoneToday],
      today: false,
      ...(minDate && phoneToday < minDate ? { disabled: true, disableTouchEvent: true } : {}),
    };
  }
  result[today] = { ...result[today], today: true };
  return result;
}

/**
 * A day takes the tap on 44×44 pt (T-014 review). The library draws it 38×34
 * and takes the tap on exactly that; the drawn day and its period band stay
 * as they were, with the room for the finger as padding around them. A row
 * is as tall as before: the week's margin gives back what the padding takes.
 */
const DAY_DRAWN_WIDTH = 38;
const DAY_DRAWN_HEIGHT = 34;
const DAY_PAD_X = (TouchTarget - DAY_DRAWN_WIDTH) / 2;
const DAY_PAD_Y = (TouchTarget - DAY_DRAWN_HEIGHT) / 2;
const dayTheme = {
  weekVerticalMargin: 7 - DAY_PAD_Y,
  'stylesheet.day.period': {
    container: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingHorizontal: DAY_PAD_X,
      paddingVertical: DAY_PAD_Y,
    },
    fillers: {
      position: 'absolute',
      top: DAY_PAD_Y,
      height: DAY_DRAWN_HEIGHT,
      flexDirection: 'row',
      left: 0,
      right: 0,
    },
  },
};

/** The calendar's colours and type, on the sheet's background. */
export const calendarTheme = {
  ...dayTheme,
  backgroundColor: Colors.bg.secondary,
  calendarBackground: Colors.bg.secondary,
  textSectionTitleColor: Colors.text.secondary,
  selectedDayBackgroundColor: Colors.accent.purple,
  selectedDayTextColor: '#ffffff',
  todayTextColor: Colors.accent.purple,
  dayTextColor: Colors.text.primary,
  textDisabledColor: Colors.text.tertiary,
  monthTextColor: Colors.text.primary,
  textMonthFontWeight: FontWeight.semibold,
  textDayFontSize: FontSize.base,
  textMonthFontSize: FontSize.lg,
  textDayHeaderFontSize: FontSize.sm,
};

interface DayComponentProps extends Omit<PeriodDayProps, 'date'> {
  date?: DateData;
  children?: React.ReactNode;
}

/**
 * The library's day, named by the picker. The library's own name for a day
 * begins with its word for today on the phone's date, whatever the marking
 * says, and an empty word is read as 'today': VoiceOver called both the
 * phone's date and the profile's "today" (T-012 review). Here only the
 * profile's date is.
 */
export function profileDay(today: string, todayLabel: string, locale: string) {
  return function ProfileDay({ date, marking, children, ...props }: DayComponentProps) {
    const dateString = date?.dateString;
    const label = [
      dateString === today && todayLabel,
      dateString && parseDateString(dateString).toLocaleDateString(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
      marking?.startingDay && 'period start',
      marking?.endingDay && 'period end',
      (marking?.disabled || props.state === 'disabled') && 'disabled',
    ].filter(Boolean).join(', ');
    return (
      <PeriodDay {...props} marking={marking} date={dateString} accessibilityLabel={label}>
        {children}
      </PeriodDay>
    );
  };
}
