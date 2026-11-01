import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { Colors } from '../constants/colors';
import { useI18n } from '../../contexts/I18nContext';
import { getDateLocale } from '../utils/locale';
import { formatDateToString, parseDateString } from '../utils/time';
import { useToday } from '../hooks/useClock';
import { useWeekStart } from '../../hooks/useWeekStart';
import { calendarTheme, profileDay, withToday } from './profileCalendar';

interface DayCalendarProps {
  /** The chosen day, 'YYYY-MM-DD'. */
  value: string;
  onChange: (value: string) => void;
  /**
   * A day before today that can still be chosen: an edited rehearsal's own,
   * which stays shown and chosen when it is past (T-018).
   */
  allowedPast?: string;
  /**
   * The days before today take a tap as any other: the calendar's month,
   * which is for looking back as well as ahead (T-019).
   */
  pastOpen?: boolean;
  /** Days drawn with a dot: the ones with a rehearsal (T-019). */
  dotted?: ReadonlySet<string>;
  /** The first and last day it offers. */
  minDate?: string;
  maxDate?: string;
  testID?: string;
}

/** 'YYYY-MM-DD' `days` days after `day`. */
function addDays(day: string, days: number): string {
  const date = parseDateString(day);
  date.setDate(date.getDate() + days);
  return formatDateToString(date);
}

/**
 * One day picked on a month calendar, in the form itself (T-018): the week
 * begins on the profile's day and today is the profile's, as in the period
 * picker (DateRangePicker). The days before today are shown and take no tap,
 * but for `allowedPast`.
 */
export function DayCalendar({
  value, onChange, allowedPast, pastOpen, dotted, minDate, maxDate, testID,
}: DayCalendarProps) {
  const { t, language } = useI18n();
  const weekStart = useWeekStart();
  const today = useToday();
  // The phone's date, which is all the library knows as today.
  const phoneToday = formatDateToString(new Date());
  LocaleConfig.defaultLocale = language;

  // The month on screen, for the past days it shows: the library's `minDate`
  // would refuse the edited rehearsal's own day too, and leave the days before
  // it looking as if they took a tap.
  const [month, setMonth] = useState(value.slice(0, 7));
  useEffect(() => setMonth(value.slice(0, 7)), [value]);

  const markedDates = useMemo(() => {
    const marked: { [key: string]: any } = {};
    // The month and the days of the months beside it in its first and last week.
    const first = addDays(`${month}-01`, -7);
    const last = addDays(`${month}-01`, 31 + 7);
    for (let day = first; !pastOpen && day < last && day < today; day = addDays(day, 1)) {
      if (day !== allowedPast) marked[day] = { disabled: true, disableTouchEvent: true };
    }
    dotted?.forEach((day) => {
      if (day >= first && day < last) marked[day] = { ...marked[day], marked: true, dotColor: Colors.accent.purple };
    });
    marked[value] = {
      ...marked[value],
      startingDay: true,
      endingDay: true,
      color: Colors.accent.purple,
      textColor: 'white',
      ...(marked[value]?.marked ? { dotColor: 'white' } : {}),
    };
    return withToday(marked, today, phoneToday, undefined);
  }, [month, today, phoneToday, value, allowedPast, pastOpen, dotted]);

  const dayComponent = useMemo(
    () => profileDay(today, t.common.today, getDateLocale(language)),
    [today, t.common.today, language]
  );

  return (
    <Calendar
      testID={testID}
      initialDate={value}
      firstDay={weekStart === 'monday' ? 1 : 0}
      onDayPress={(day: DateData) => onChange(day.dateString)}
      onMonthChange={(day: DateData) => setMonth(day.dateString.slice(0, 7))}
      minDate={minDate}
      maxDate={maxDate}
      markingType={'period'}
      dayComponent={dayComponent}
      markedDates={markedDates}
      // On whatever it is put on.
      theme={{ ...calendarTheme, backgroundColor: 'transparent', calendarBackground: 'transparent' }}
    />
  );
}
