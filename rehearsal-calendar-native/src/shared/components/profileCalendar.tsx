/**
 * What every react-native-calendars calendar of the app shares: its words,
 * the profile's today, a day of 44×44 and its colours. The period picker
 * (DateRangePicker) and the rehearsal form's date (DayCalendar) both draw
 * their days with these.
 */
import React from 'react';
import { Text } from 'react-native';
import { DateData, LocaleConfig } from 'react-native-calendars';
import PeriodDay, { PeriodDayProps } from 'react-native-calendars/src/calendar/day/period';
import { Colors, FontSize, FontWeight, TouchTarget } from '../constants/colors';
import { formatDate } from '../utils/dateFormat';
import type { Language } from '../../i18n/translations';

// Configure locales for react-native-calendars, one for every language of the
// app: the calendars set the app's language as the library's default, and a
// language it has no words for threw on opening (`dayNamesShort` of
// undefined; Spanish and German, T-018 review). Its word for "today" is not
// used: the library's today is the phone's date, and the picker's days name
// the profile's themselves (dayComponent below).
export const calendarLocales: Record<Language, {
  monthNames: string[];
  monthNamesShort: string[];
  dayNames: string[];
  dayNamesShort: string[];
  today: string;
}> = {
  ru: {
    monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    today: ''
  },
  en: {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    today: ''
  },
  es: {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    today: ''
  },
  de: {
    monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monthNamesShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    today: ''
  },
};
Object.assign(LocaleConfig.locales, calendarLocales);

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
    // Today is ringed in purple, its digit as any other's, as in the day
    // strip (T-031): a purple digit on the sheet is 4.37:1, under the 4.5:1
    // text needs, and a fill would read as the day picked.
    today: {
      borderWidth: 2,
      borderColor: Colors.accent.purple,
      borderRadius: 17,
    },
  },
};

/**
 * The day picked, as a period day's marking: the library draws a marked day
 * with the marking's `color` and `textColor`, never the theme's selected-day
 * colours. White text, so purpleFill under it (T-027, T-031).
 */
export const pickedDay = {
  color: Colors.accent.purpleFill,
  textColor: Colors.text.inverse,
} as const;

/** The calendar's colours and type, on the sheet's background. */
export const calendarTheme = {
  ...dayTheme,
  backgroundColor: Colors.bg.secondary,
  calendarBackground: Colors.bg.secondary,
  textSectionTitleColor: Colors.text.secondary,
  // The month's arrows are doing: purple. The library's own is a blue,
  // #00BBF2 (T-031 review).
  arrowColor: Colors.accent.purple,
  selectedDayBackgroundColor: pickedDay.color,
  selectedDayTextColor: pickedDay.textColor,
  todayTextColor: Colors.text.primary,
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
export function profileDay(today: string, todayLabel: string, language: string) {
  return function ProfileDay({ date, marking, children, ...props }: DayComponentProps) {
    const dateString = date?.dateString;
    const label = [
      dateString === today && todayLabel,
      dateString && formatDate(dateString, 'fullDate', language, { midSentence: true }),
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

const monthTitleStyle = {
  fontSize: calendarTheme.textMonthFontSize,
  fontWeight: calendarTheme.textMonthFontWeight,
  color: calendarTheme.monthTextColor,
  margin: 10,
} as const;

/**
 * The month over the days, named as every month in the app is (dateFormat.ts):
 * the library put "Ноябрь 2026" together from its own list of names, where
 * the strip's month read "октябрь 2026 г." (T-028). Drawn as the library's
 * own title is, with its testID.
 */
export function monthTitle(language: string) {
  return (month?: { getFullYear(): number; getMonth(): number }, info?: { testID?: string }) => (
    <Text allowFontScaling={false} style={monthTitleStyle} testID={info?.testID && `${info.testID}.title`}>
      {month ? formatDate(new Date(month.getFullYear(), month.getMonth(), 1), 'monthYear', language) : ''}
    </Text>
  );
}
