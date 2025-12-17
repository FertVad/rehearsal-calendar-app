import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
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
  label: string;
  color: string;
}

export const DayCard: React.FC<DayCardProps> = ({ date, slots, onCreateRehearsal }) => {
  const { t, language } = useI18n();

  // Track which categories are expanded (default: all expanded)
  const [expandedCategories, setExpandedCategories] = useState<Set<SlotCategory>>(
    new Set(['perfect', 'good', 'ok', 'bad'])
  );

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
    const categoryLabels: Record<SlotCategory, string> = {
      perfect: t.smartPlanner.perfect,
      good: t.smartPlanner.good,
      ok: t.smartPlanner.possible,
      bad: t.smartPlanner.difficult,
    };
    const categoryColors: Record<SlotCategory, string> = {
      perfect: '#10b981',
      good: '#f59e0b',
      ok: '#f97316',
      bad: '#ef4444',
    };

    return categoryOrder
      .filter(cat => groups.has(cat))
      .map(cat => ({
        category: cat,
        slots: groups.get(cat)!,
        label: categoryLabels[cat],
        color: categoryColors[cat],
      }));
  }, [slots, t]);

  const toggleCategory = (category: SlotCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        <Text style={styles.slotCount}>{slots.length} {t.smartPlanner.slots}</Text>
      </View>

      {categoryGroups.map(group => {
        const isExpanded = expandedCategories.has(group.category);

        return (
          <View key={group.category} style={styles.categorySection}>
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory(group.category)}
            >
              <View style={styles.categoryHeaderLeft}>
                <View style={[styles.categoryDot, { backgroundColor: group.color }]} />
                <Text style={styles.categoryLabel}>{group.label}</Text>
                <Text style={styles.categoryCount}>({group.slots.length})</Text>
              </View>
              {isExpanded ? (
                <ChevronDown size={20} color="#6b7280" />
              ) : (
                <ChevronRight size={20} color="#6b7280" />
              )}
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.categorySlots}>
                {group.slots.map((slot, index) => (
                  <SlotItem
                    key={`${slot.date}-${slot.startTime}-${index}`}
                    slot={slot}
                    onCreateRehearsal={onCreateRehearsal}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
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
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d1d5db',
  },
  categoryCount: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 4,
  },
  categorySlots: {
    marginTop: 4,
  },
});
