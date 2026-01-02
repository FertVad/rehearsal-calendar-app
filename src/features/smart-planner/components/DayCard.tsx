import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TimeSlot, SlotCategory } from '../types';
import { SlotItem } from './SlotItem';
import { useI18n } from '../../../contexts/I18nContext';

interface DayCardProps {
  date: string;
  slots: TimeSlot[];
  onCreateRehearsal: (slot: TimeSlot) => void;
}

interface CategoryGroup {
  category: SlotCategory;
  slots: TimeSlot[];
}

export const DayCard: React.FC<DayCardProps> = ({ date, slots, onCreateRehearsal }) => {
  const { t, language } = useI18n();

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    };
    return d.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', options);
  };

  // Group slots by category
  const categoryGroups: CategoryGroup[] = useMemo(() => {
    const groups = new Map<SlotCategory, TimeSlot[]>();

    slots.forEach(slot => {
      if (!groups.has(slot.category)) {
        groups.set(slot.category, []);
      }
      groups.get(slot.category)!.push(slot);
    });

    const categoryOrder: SlotCategory[] = ['perfect', 'good', 'ok', 'bad'];

    return categoryOrder
      .filter(cat => groups.has(cat))
      .map(cat => ({
        category: cat,
        slots: groups.get(cat)!,
      }));
  }, [slots]);

  return (
    <View style={styles.card}>
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        <Text style={styles.slotCount}>{slots.length} {t.smartPlanner.slots}</Text>
      </View>

      {categoryGroups.map(group => (
        <View key={group.category} style={styles.categorySection}>
          <View style={styles.categorySlots}>
            {group.slots.map((slot, index) => (
              <SlotItem
                key={`${slot.date}-${slot.startTime}-${index}`}
                slot={slot}
                onCreateRehearsal={onCreateRehearsal}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    textTransform: 'capitalize',
  },
  slotCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  categorySection: {
    marginBottom: 8,
  },
  categorySlots: {
    marginTop: 4,
  },
});
