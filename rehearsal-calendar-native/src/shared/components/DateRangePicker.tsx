import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../constants/colors';
import { useI18n } from '../../contexts/I18nContext';

interface DateRangePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
  minDate?: Date;
}

// Configure locales for react-native-calendars
LocaleConfig.locales['ru'] = {
  monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Сегодня'
};

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  today: 'Today'
};

export function DateRangePicker({
  visible,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  minDate,
}: DateRangePickerProps) {
  const { t, language } = useI18n();

  // Set calendar locale
  LocaleConfig.defaultLocale = language;
  const [startDate, setStartDate] = useState<string | null>(
    initialStartDate ? initialStartDate.toISOString().split('T')[0] : null
  );
  const [endDate, setEndDate] = useState<string | null>(
    initialEndDate ? initialEndDate.toISOString().split('T')[0] : null
  );

  const minDateStr = minDate ? minDate.toISOString().split('T')[0] : undefined;

  const markedDates = useMemo(() => {
    const marked: { [key: string]: any } = {};

    if (!startDate) return marked;

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
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      current.setDate(current.getDate() + 1);

      while (current < end) {
        const dateStr = current.toISOString().split('T')[0];
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
  }, [startDate, endDate]);

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
    if (startDate && endDate) {
      onConfirm(new Date(startDate), new Date(endDate));
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset to initial values
    setStartDate(initialStartDate ? initialStartDate.toISOString().split('T')[0] : null);
    setEndDate(initialEndDate ? initialEndDate.toISOString().split('T')[0] : null);
    onClose();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
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

          <Calendar
            onDayPress={handleDayPress}
            markingType={'period'}
            markedDates={markedDates}
            minDate={minDateStr}
            theme={{
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
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, !endDate && styles.disabledButton]}
              onPress={handleConfirm}
              disabled={!endDate}
            >
              <Text style={[styles.confirmButtonText, !endDate && styles.disabledButtonText]}>
                {t.common.done}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
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
