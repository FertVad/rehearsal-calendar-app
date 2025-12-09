import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TimeSlot } from '../types';

interface SlotItemProps {
  slot: TimeSlot;
  onCreateRehearsal: (slot: TimeSlot) => void;
}

export const SlotItem: React.FC<SlotItemProps> = ({ slot, onCreateRehearsal }) => {
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
      return 'Все свободны';
    }
    if (slot.busyMembers.length === slot.totalMembers) {
      return 'Все заняты';
    }
    const names = slot.busyMembers.map(m => m.name).join(', ');
    return `Заняты: ${names}`;
  };

  const formatTimeRange = (): string => {
    // Check if entire workday (9:00-23:00)
    if (slot.startTime === '09:00' && slot.endTime === '23:00') {
      return 'Весь день';
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
          <Text style={styles.addButtonText}>+ Добавить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    color: '#1f2937',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#6b7280',
  },
  addButton: {
    backgroundColor: '#3b82f6',
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
