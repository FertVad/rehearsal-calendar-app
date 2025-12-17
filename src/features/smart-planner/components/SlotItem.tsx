import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TimeSlot } from '../types';
import { useI18n } from '../../../contexts/I18nContext';

interface SlotItemProps {
  slot: TimeSlot;
  onCreateRehearsal: (slot: TimeSlot) => void;
}

export const SlotItem: React.FC<SlotItemProps> = ({ slot, onCreateRehearsal }) => {
  const { t } = useI18n();

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

  const formatTimeRange = (): string => {
    // Check if entire workday (9:00-23:00)
    if (slot.startTime === '09:00' && slot.endTime === '23:00') {
      return t.smartPlanner.allDay;
    }
    return `${slot.startTime}-${slot.endTime}`;
  };

  const canCreateRehearsal = slot.busyMembers.length < slot.totalMembers;

  return (
    <View style={styles.slot}>
      <View style={[styles.indicator, { backgroundColor: getCategoryColor() }]} />
      <View style={styles.content}>
        <Text style={styles.time}>{formatTimeRange()}</Text>
        <Text style={styles.status}>{getStatusText()}</Text>
      </View>
      {canCreateRehearsal && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onCreateRehearsal(slot)}
        >
          <Text style={styles.addButtonText}>{t.smartPlanner.addButton}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  indicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#9ca3af',
  },
  addButton: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
