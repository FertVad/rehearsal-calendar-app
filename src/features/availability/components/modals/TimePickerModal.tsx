import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../../shared/constants/colors';

interface TimePickerModalProps {
  visible: boolean;
  value: Date;
  field: 'start' | 'end';
  onTimeChange: (event: any, date?: Date) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TimePickerModal({
  visible,
  value,
  field,
  onTimeChange,
  onConfirm,
  onCancel,
}: TimePickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.timePickerOverlay}
        onPress={onCancel}
      >
        <Pressable style={styles.timePickerContainer} onPress={e => e.stopPropagation()}>
          <View style={styles.timePickerHeader}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.timePickerCancel}>Отмена</Text>
            </TouchableOpacity>
            <Text style={styles.timePickerTitle}>
              {field === 'start' ? 'Время начала' : 'Время окончания'}
            </Text>
            <TouchableOpacity onPress={onConfirm}>
              <Text style={styles.timePickerDone}>Готово</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={value}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            locale="ru"
            textColor={Colors.text.primary}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timePickerContainer: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  timePickerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  timePickerCancel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  timePickerDone: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
});
