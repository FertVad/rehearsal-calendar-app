import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';

interface WeekPreviewProps {
  weekStart: 'monday' | 'sunday';
}

export default function WeekPreview({ weekStart }: WeekPreviewProps) {
  const { t } = useI18n();

  // Get short day names
  const days = [
    t.days.short.monday,
    t.days.short.tuesday,
    t.days.short.wednesday,
    t.days.short.thursday,
    t.days.short.friday,
    t.days.short.saturday,
    t.days.short.sunday,
  ];

  // Reorder days based on week start
  const orderedDays = weekStart === 'sunday' ? [days[6], ...days.slice(0, 6)] : days;

  return (
    <View style={styles.container}>
      {orderedDays.map((day, index) => (
        <View key={index} style={styles.dayContainer}>
          <Text style={styles.dayText}>{day}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    marginVertical: 16,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  dayText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
});
