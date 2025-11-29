import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../../../../shared/constants/colors';
import { AvailabilityData } from '../../types';
import { getDaysInMonth, formatDate } from '../../utils';
import { WEEKDAYS, MONTHS_RU, DAY_SIZE } from '../../constants';

interface CalendarMonthProps {
  year: number;
  month: number;
  selectedDates: string[];
  availability: AvailabilityData;
  today: string;
  onDayPress: (year: number, month: number, day: number) => void;
  getDayStatus: (date: string) => 'free' | 'busy' | 'partial' | 'none';
}

export const CalendarMonth: React.FC<CalendarMonthProps> = ({
  year,
  month,
  selectedDates,
  availability,
  today,
  onDayPress,
  getDayStatus,
}) => {
  const days = getDaysInMonth(year, month);

  return (
    <View style={styles.monthContainer}>
      <Text style={styles.monthTitle}>
        {MONTHS_RU[month]} {year}
      </Text>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <Text key={day} style={styles.weekdayLabel}>{day}</Text>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.daysGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const date = formatDate(year, month, day);
          const status = getDayStatus(date);
          const isToday = date === today;
          const isPast = date < today;
          const isSelected = selectedDates.includes(date);

          return (
            <TouchableOpacity
              key={date}
              style={[
                styles.dayCell,
                isToday && styles.dayCellToday,
                isPast && styles.dayCellPast,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => onDayPress(year, month, day)}
              disabled={false}
            >
              <Text style={[
                styles.dayText,
                isToday && styles.dayTextToday,
                isPast && styles.dayTextPast,
                isSelected && styles.dayTextSelected,
              ]}>
                {day}
              </Text>
              {status !== 'none' && (
                <View style={[
                  styles.statusDot,
                  status === 'free' && styles.statusDotFree,
                  status === 'busy' && styles.statusDotBusy,
                  status === 'partial' && styles.statusDotPartial,
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  monthContainer: {
    marginBottom: Spacing.xl,
  },
  monthTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dayCellToday: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    borderRadius: DAY_SIZE / 2,
  },
  dayCellPast: {
    opacity: 0.3,
  },
  dayCellSelected: {
    backgroundColor: Colors.accent.purple,
    borderRadius: DAY_SIZE / 2,
  },
  dayText: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  dayTextToday: {
    fontWeight: FontWeight.bold,
    color: Colors.accent.purple,
  },
  dayTextPast: {
    color: Colors.text.tertiary,
  },
  dayTextSelected: {
    color: Colors.text.inverse,
    fontWeight: FontWeight.bold,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  statusDotFree: {
    backgroundColor: Colors.accent.green,
  },
  statusDotBusy: {
    backgroundColor: Colors.accent.red,
  },
  statusDotPartial: {
    backgroundColor: Colors.accent.yellow,
  },
});
