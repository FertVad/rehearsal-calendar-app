import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../../shared/constants/colors';

interface PastDateWarningProps {
  onDelete: () => void;
}

export default function PastDateWarning({ onDelete }: PastDateWarningProps) {
  return (
    <>
      <View style={styles.pastDateWarning}>
        <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
        <Text style={styles.pastDateWarningText}>
          Это прошедшая дата. Вы можете удалить данные, но не редактировать.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.deletePastDateButton}
        onPress={onDelete}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
        <Text style={styles.deletePastDateButtonText}>Удалить данные этой даты</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  pastDateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pastDateWarningText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.accent.yellow,
    fontWeight: FontWeight.medium,
  },
  deletePastDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  deletePastDateButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.red,
  },
});
