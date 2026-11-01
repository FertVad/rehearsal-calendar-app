import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TimeSlot, SlotCategory } from '../types';
import { SlotItem } from './SlotItem';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';

interface DayCardProps {
  date: string;
  slots: TimeSlot[];
  /** Absent for someone who may not put a rehearsal in the project (T-012). */
  onCreateRehearsal?: (slot: TimeSlot) => void;
}

export const DayCard: React.FC<DayCardProps> = React.memo(({ date, slots, onCreateRehearsal }) => {
  const { t, language } = useI18n();

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    };
    return d.toLocaleDateString(getDateLocale(language), options);
  };

  // Group slots by category: the best first
  const ordered: TimeSlot[] = useMemo(() => {
    const groups = new Map<SlotCategory, TimeSlot[]>();

    slots.forEach(slot => {
      if (!groups.has(slot.category)) {
        groups.set(slot.category, []);
      }
      groups.get(slot.category)!.push(slot);
    });

    const categoryOrder: SlotCategory[] = ['perfect', 'good', 'ok', 'bad'];

    return categoryOrder.flatMap(cat => groups.get(cat) ?? []);
  }, [slots]);

  // A header of 28 pt and a row of 56 a slot, no card around them: a day of
  // one slot took 167 pt, and a week four screens (owner, 30.10.2026; T-020).
  return (
    <View style={styles.day}>
      <View testID={`planner-day-${date}`} style={styles.dateHeader}>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        <Text style={styles.slotCount}>{t.smartPlanner.slotsCount(slots.length)}</Text>
      </View>

      {ordered.map((slot, index) => (
        <SlotItem
          key={`${slot.date}-${slot.startTime}-${index}`}
          slot={slot}
          onCreateRehearsal={onCreateRehearsal}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  day: {
    marginBottom: 12,
  },
  dateHeader: {
    height: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
    textTransform: 'capitalize',
  },
  slotCount: {
    fontSize: 13,
    color: '#9ca3af',
  },
});
