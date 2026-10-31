import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import PeriodDay, { PeriodDayProps } from 'react-native-calendars/src/calendar/day/period';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, TouchTarget } from '../constants/colors';
import { useI18n } from '../../contexts/I18nContext';
import { getDateLocale } from '../../shared/utils/locale';
import { formatDateToString, parseDateString } from '../utils/time';
import { calendarRangeDays } from '../utils/memberAvailabilityLimits';
import { useToday } from '../hooks/useClock';
import { useWeekStart } from '../../hooks/useWeekStart';
import { AppModal } from './AppModal';
import { ModalSheet } from './ModalSheet';

interface DateRangePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
  minDate?: Date;
  maxDays?: number;
}

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
function withToday(
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

/**
 * Seven days of 44 side by side want 308 pt: the calendar runs to the sheet's
 * edges, and the sheet's margin to the screen's is what is left over, up to
 * the usual. On a 320 pt screen a day had 39.
 */
const SHEET_MARGIN_X = Math.min(
  Spacing.lg,
  (Dimensions.get('window').width - 7 * TouchTarget) / 2,
);

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
function profileDay(today: string, todayLabel: string, locale: string) {
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

export function DateRangePicker({
  visible,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  minDate,
  maxDays,
}: DateRangePickerProps) {
  const { t, language } = useI18n();
  // The week begins on the profile's day, as in the availability calendar
  // (CalendarMonth): without `firstDay` the library began it on Sunday.
  const weekStart = useWeekStart();
  const today = useToday();
  // The phone's date, which is all the library knows as today.
  const phoneToday = formatDateToString(new Date());

  // Set calendar locale
  LocaleConfig.defaultLocale = language;
  // The calendar speaks 'YYYY-MM-DD' in the user's own days, so every crossing
  // between a Date and one of these strings goes through the local-time helpers.
  // toISOString() would answer in UTC, which for a date-only value is a
  // different day for part of every night.
  const [startDate, setStartDate] = useState<string | null>(
    initialStartDate ? formatDateToString(initialStartDate) : null
  );
  const [endDate, setEndDate] = useState<string | null>(
    initialEndDate ? formatDateToString(initialEndDate) : null
  );

  const minDateStr = minDate ? formatDateToString(minDate) : undefined;
  const rangeDays = startDate && endDate ? calendarRangeDays(startDate, endDate) : null;
  const rangeError = startDate && endDate
    ? rangeDays === null
      ? t.common.invalidDateRange
      : maxDays !== undefined && rangeDays > maxDays
        ? t.common.dateRangeTooLong(maxDays)
        : null
    : null;

  const markedDates = useMemo(() => {
    const marked: { [key: string]: any } = {};

    // A rejected selection must never enter the day-by-day marking loop.
    if (!startDate || rangeError) return marked;

    // Mark start date
    marked[startDate] = {
      startingDay: true,
      color: Colors.accent.purple,
      textColor: 'white',
    };

    // Mark end date
    if (endDate) {
      marked[endDate] = {
        endingDay: true,
        color: Colors.accent.purple,
        textColor: 'white',
      };

      // Mark range between start and end
      const start = parseDateString(startDate);
      const end = parseDateString(endDate);
      const current = new Date(start);
      current.setDate(current.getDate() + 1);

      while (current < end) {
        const dateStr = formatDateToString(current);
        marked[dateStr] = {
          color: Colors.accent.purple + '40', // 25% opacity
          textColor: Colors.text.primary,
        };
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Only start date selected
      marked[startDate] = {
        startingDay: true,
        endingDay: true,
        color: Colors.accent.purple,
        textColor: 'white',
      };
    }

    return marked;
  }, [startDate, endDate, rangeError]);

  const calendarMarks = withToday(markedDates, today, phoneToday, minDateStr);
  const dayComponent = useMemo(
    () => profileDay(today, t.common.today, getDateLocale(language)),
    [today, t.common.today, language]
  );

  const handleDayPress = (day: DateData) => {
    if (!startDate || (startDate && endDate)) {
      // First selection or resetting selection
      setStartDate(day.dateString);
      setEndDate(null);
    } else {
      // Second selection
      const selectedDate = new Date(day.dateString);
      const start = new Date(startDate);

      if (selectedDate < start) {
        // If selected date is before start, swap them
        setEndDate(startDate);
        setStartDate(day.dateString);
      } else {
        setEndDate(day.dateString);
      }
    }
  };

  const handleConfirm = () => {
    if (startDate && endDate && !rangeError) {
      onConfirm(parseDateString(startDate), parseDateString(endDate));
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset to initial values
    setStartDate(initialStartDate ? formatDateToString(initialStartDate) : null);
    setEndDate(initialEndDate ? formatDateToString(initialEndDate) : null);
    onClose();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    // A calendar date, not an instant: new Date('2026-09-10') is the 9th west of UTC.
    const date = parseDateString(dateStr);
    const locale = getDateLocale(language);
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <AppModal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <ModalSheet overlayStyle={styles.overlay} onClose={handleCancel}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.common.selectPeriod}</Text>
          </View>

          <View style={styles.selectedRange}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>{t.common.from}</Text>
              <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>{t.common.to}</Text>
              <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
            </View>
          </View>

          {rangeError && <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>{rangeError}</Text>}

          <Calendar
            testID="date-range-calendar"
            current={startDate ?? today}
            firstDay={weekStart === 'monday' ? 1 : 0}
            onDayPress={handleDayPress}
            markingType={'period'}
            dayComponent={dayComponent}
            markedDates={calendarMarks}
            minDate={minDateStr}
            style={styles.calendar}
            theme={{
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
            }}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              testID="date-range-cancel"
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, (!endDate || !!rangeError) && styles.disabledButton]}
              onPress={handleConfirm}
              disabled={!endDate || !!rangeError}
            >
              <Text style={[styles.confirmButtonText, !endDate && styles.disabledButtonText]}>
                {t.common.done}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalSheet>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: SHEET_MARGIN_X,
  },
  calendar: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  container: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  selectedRange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dateBox: {
    alignItems: 'center',
    minWidth: 80,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  arrow: {
    paddingHorizontal: Spacing.sm,
  },
  arrowText: {
    fontSize: FontSize.xl,
    color: Colors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  button: {
    flex: 1,
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  confirmButton: {
    backgroundColor: Colors.accent.purple,
  },
  confirmButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  disabledButton: {
    backgroundColor: Colors.glass.bg,
    opacity: 0.5,
  },
  disabledButtonText: {
    color: Colors.text.tertiary,
  },
});
