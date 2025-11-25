import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';

interface AvailabilityEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (availability: AvailabilityData) => void;
  initialData?: AvailabilityData;
}

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface AvailabilityData {
  [key: string]: DayAvailability;
}

const DAYS = [
  { key: 'monday', label: 'Понедельник', short: 'Пн' },
  { key: 'tuesday', label: 'Вторник', short: 'Вт' },
  { key: 'wednesday', label: 'Среда', short: 'Ср' },
  { key: 'thursday', label: 'Четверг', short: 'Чт' },
  { key: 'friday', label: 'Пятница', short: 'Пт' },
  { key: 'saturday', label: 'Суббота', short: 'Сб' },
  { key: 'sunday', label: 'Воскресенье', short: 'Вс' },
];

const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };

const getDefaultAvailability = (): AvailabilityData => {
  const data: AvailabilityData = {};
  DAYS.forEach(day => {
    data[day.key] = {
      enabled: day.key !== 'sunday',
      slots: [{ ...DEFAULT_SLOT }],
    };
  });
  return data;
};

export default function AvailabilityEditor({
  visible,
  onClose,
  onSave,
  initialData,
}: AvailabilityEditorProps) {
  const [availability, setAvailability] = useState<AvailabilityData>(
    initialData || getDefaultAvailability()
  );
  const [selectedDay, setSelectedDay] = useState<string>('monday');

  const toggleDay = (dayKey: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey].enabled,
      },
    }));
  };

  const addSlot = (dayKey: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: [...prev[dayKey].slots, { ...DEFAULT_SLOT }],
      },
    }));
  };

  const removeSlot = (dayKey: string, index: number) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.filter((_, i) => i !== index),
      },
    }));
  };

  const updateSlot = (dayKey: string, index: number, field: 'start' | 'end', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    }));
  };

  const handleSave = () => {
    onSave?.(availability);
    onClose();
  };

  const selectedDayData = availability[selectedDay];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <View style={styles.headerContent}>
              <Text style={styles.title}>Моя доступность</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Day Selector */}
            <View style={styles.daySelector}>
              {DAYS.map(day => {
                const isSelected = selectedDay === day.key;
                const isEnabled = availability[day.key].enabled;

                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                      !isEnabled && styles.dayButtonDisabled,
                    ]}
                    onPress={() => setSelectedDay(day.key)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextSelected,
                      !isEnabled && styles.dayButtonTextDisabled,
                    ]}>
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Day Details */}
            <View style={styles.dayDetails}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>
                  {DAYS.find(d => d.key === selectedDay)?.label}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    selectedDayData.enabled && styles.toggleButtonActive,
                  ]}
                  onPress={() => toggleDay(selectedDay)}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    selectedDayData.enabled && styles.toggleButtonTextActive,
                  ]}>
                    {selectedDayData.enabled ? 'Доступен' : 'Недоступен'}
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedDayData.enabled && (
                <View style={styles.slotsContainer}>
                  <Text style={styles.slotsLabel}>Временные слоты</Text>

                  {selectedDayData.slots.map((slot, index) => (
                    <View key={index} style={styles.slotRow}>
                      <View style={styles.slotInputs}>
                        <View style={styles.timeInput}>
                          <Text style={styles.timeLabel}>С</Text>
                          <TouchableOpacity style={styles.timeButton}>
                            <Text style={styles.timeValue}>{slot.start}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.timeInput}>
                          <Text style={styles.timeLabel}>До</Text>
                          <TouchableOpacity style={styles.timeButton}>
                            <Text style={styles.timeValue}>{slot.end}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {selectedDayData.slots.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeSlotButton}
                          onPress={() => removeSlot(selectedDay, index)}
                        >
                          <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addSlotButton}
                    onPress={() => addSlot(selectedDay)}
                  >
                    <Ionicons name="add" size={20} color={Colors.accent.purple} />
                    <Text style={styles.addSlotText}>Добавить слот</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.glass.border,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
    width: '100%',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
    padding: Spacing.xl,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glass.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  dayButtonSelected: {
    backgroundColor: Colors.accent.purple,
    borderColor: Colors.accent.purple,
  },
  dayButtonDisabled: {
    opacity: 0.5,
  },
  dayButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  dayButtonTextSelected: {
    color: Colors.text.inverse,
  },
  dayButtonTextDisabled: {
    color: Colors.text.tertiary,
  },
  dayDetails: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  dayLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  toggleButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg.tertiary,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  toggleButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  toggleButtonTextActive: {
    color: Colors.accent.green,
  },
  slotsContainer: {
    marginTop: Spacing.md,
  },
  slotsLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  slotInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  timeButton: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
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
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
    borderStyle: 'dashed',
    gap: Spacing.xs,
  },
  addSlotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  saveButton: {
    backgroundColor: Colors.accent.purple,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
});
