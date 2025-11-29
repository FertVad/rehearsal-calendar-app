import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../../../../shared/constants/colors';

interface EditorHeaderProps {
  selectedCount: number;
  selectedDate: string | null;
  onClear: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  selectedCount,
  selectedDate,
  onClear,
}) => {
  return (
    <View style={styles.bottomSheetHeader}>
      <View style={styles.bottomSheetHeaderLeft}>
        <Text style={styles.bottomSheetTitle}>
          {selectedCount === 1 && selectedDate
            ? new Date(selectedDate).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })
            : `Выбрано: ${selectedCount}`}
        </Text>
        {selectedCount > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Очистить</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onClear}>
        <Ionicons name="chevron-down" size={24} color={Colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  bottomSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bottomSheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  clearButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearButtonText: {
    fontSize: FontSize.sm,
    color: Colors.accent.purple,
    fontWeight: FontWeight.medium,
  },
});
