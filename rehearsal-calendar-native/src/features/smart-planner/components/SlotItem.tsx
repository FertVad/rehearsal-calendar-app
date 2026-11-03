import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TimeSlot } from '../types';
import { useI18n } from '../../../contexts/I18nContext';
import { WORKDAY_START, WORKDAY_END } from '../../../shared/utils/availability';
import { Colors, TouchTarget } from '../../../shared/constants/colors';
import { formatTimeRange, usePhoneUses24HourClock } from '../../../shared/utils/clockFormat';
import { getDateLocale } from '../../../shared/utils/locale';

interface SlotItemProps {
  slot: TimeSlot;
  /** Absent: no "+ Add" — hidden, not dimmed, for someone who may not use it (T-012). */
  onCreateRehearsal?: (slot: TimeSlot) => void;
}

export const SlotItem: React.FC<SlotItemProps> = React.memo(({ slot, onCreateRehearsal }) => {
  const { t, language } = useI18n();
  const uses24 = usePhoneUses24HourClock();

  const getCategoryColor = (): string => {
    switch (slot.category) {
      case 'perfect':
        return '#10b981'; // green
      case 'good':
        return '#f59e0b'; // yellow
      case 'ok':
        return '#f97316'; // orange
      case 'bad':
        return '#ef4444'; // red
    }
  };

  const getStatusText = (): string => {
    if (slot.category === 'perfect') {
      return t.smartPlanner.allAvailable;
    }
    if (slot.busyMembers.length === slot.totalMembers) {
      return t.smartPlanner.allBusy;
    }
    const names = slot.busyMembers.map(m => m.name).join(', ');
    return `${t.smartPlanner.busyPrefix}: ${names}`;
  };

  const timeText = (): string => {
    // Check if entire workday
    if (slot.startTime === WORKDAY_START && slot.endTime === WORKDAY_END) {
      return t.smartPlanner.allDay;
    }
    return formatTimeRange(slot.startTime, slot.endTime, getDateLocale(language), uses24);
  };

  const canCreateRehearsal = slot.busyMembers.length < slot.totalMembers;

  return (
    <View testID={`planner-row-${slot.date}-${slot.startTime}`} style={styles.slot}>
      <View style={[styles.indicator, { backgroundColor: getCategoryColor() }]} />
      <View style={styles.content}>
        <Text style={styles.time} numberOfLines={1}>{timeText()}</Text>
        <Text testID={`planner-slot-${slot.date}`} style={styles.status} numberOfLines={1}>{getStatusText()}</Text>
      </View>
      {canCreateRehearsal && onCreateRehearsal && (
        <TouchableOpacity
          testID={`planner-add-${slot.date}-${slot.startTime}`}
          style={styles.addButton}
          onPress={() => onCreateRehearsal(slot)}
        >
          <Text style={styles.addButtonText}>{t.smartPlanner.addButton}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// 52 pt a slot, "+ Add" 44 inside it (owner, 02.11.2026; T-026; 56 in T-020).
const styles = StyleSheet.create({
  slot: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  indicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 2,
  },
  status: {
    fontSize: 13,
    color: '#9ca3af',
  },
  addButton: {
    backgroundColor: Colors.accent.purpleFill,
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
