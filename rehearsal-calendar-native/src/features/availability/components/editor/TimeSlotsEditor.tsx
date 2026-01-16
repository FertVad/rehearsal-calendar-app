import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../../shared/constants/colors';
import { TimeSlot } from '../../types';

interface TimeSlotsEditorProps {
  slots: TimeSlot[];
  validationError: string | null;
  onSlotChange: (index: number, field: 'start' | 'end', value: string) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onTimePickerOpen: (slotIndex: number, field: 'start' | 'end') => void;
}

export default function TimeSlotsEditor({
  slots,
  validationError,
  onSlotChange,
  onAddSlot,
  onRemoveSlot,
  onTimePickerOpen,
}: TimeSlotsEditorProps) {
  return (
    <View style={styles.slotsSection}>
      <Text style={styles.slotsTitle}>Время когда занят</Text>

      {/* Validation Error */}
      {validationError && (
        <View style={styles.validationError}>
          <Ionicons name="warning" size={18} color={Colors.accent.red} />
          <Text style={styles.validationErrorText}>{validationError}</Text>
        </View>
      )}

      {slots.map((slot, index) => (
        <View key={index} style={styles.slotRow}>
          <View style={styles.slotInputs}>
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>С</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => onTimePickerOpen(index, 'start')}
              >
                <Text style={styles.timeValue}>{slot.start}</Text>
                <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.timeSeparator}>
              <Ionicons name="arrow-forward" size={16} color={Colors.text.tertiary} />
            </View>
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>До</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => onTimePickerOpen(index, 'end')}
              >
                <Text style={styles.timeValue}>{slot.end}</Text>
                <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {slots.length > 1 && (
            <TouchableOpacity
              style={styles.removeSlotButton}
              onPress={() => onRemoveSlot(index)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.addSlotButton} onPress={onAddSlot}>
        <Ionicons name="add" size={20} color={Colors.accent.purple} />
        <Text style={styles.addSlotText}>Добавить слот</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  slotsSection: {
    marginBottom: Spacing.lg,
  },
  slotsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  slotInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
  },
  timeSeparator: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
  },
  timeLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  timeButton: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  removeSlotButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
    borderStyle: 'dashed',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  addSlotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  validationErrorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.accent.red,
    fontWeight: FontWeight.medium,
  },
});
