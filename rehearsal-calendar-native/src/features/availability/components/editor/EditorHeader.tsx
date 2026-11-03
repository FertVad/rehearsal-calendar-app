import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconButton } from '../../../../shared/components/IconButton';
import { Colors, FontSize, FontWeight, Spacing, TouchTarget } from '../../../../shared/constants/colors';
import { useI18n } from '../../../../contexts/I18nContext';
import { formatDate } from '../../../../shared/utils/dateFormat';

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
  const { t, language } = useI18n();

  return (
    <View style={styles.bottomSheetHeader}>
      <View style={styles.bottomSheetHeaderLeft}>
        <Text style={styles.bottomSheetTitle}>
          {selectedCount === 1 && selectedDate
            ? formatDate(selectedDate, 'dayMonth', language)
            : t.availability.selectedDates(selectedCount)}
        </Text>
        {selectedCount > 0 && (
          <TouchableOpacity testID="availability-deselect" onPress={onClear} style={styles.clearButton}>
            {/* It lets go of the days picked and leaves what is on them: "Clear"
                read as emptying the day (T-021). */}
            <Text style={styles.clearButtonText}>{t.common.deselect}</Text>
          </TouchableOpacity>
        )}
      </View>
      <IconButton testID="availability-collapse" icon="chevron-down" accessibilityLabel={t.common.close} onPress={onClear} />
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
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  clearButtonText: {
    fontSize: FontSize.sm,
    color: Colors.accent.purple,
    fontWeight: FontWeight.medium,
  },
});
