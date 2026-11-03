import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/colors';

interface DeleteButtonProps {
  title: string;
  onPress: () => void;
  testID?: string;
}

/**
 * The button that deletes something whole — a project, the account. One look
 * for both, last on its screen (T-024): the account's was a red row among
 * Help and the bug report, 8 pt from Help.
 */
export function DeleteButton({ title, onPress, testID }: DeleteButtonProps) {
  return (
    <TouchableOpacity style={styles.button} testID={testID} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: Colors.accent.red,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  text: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.red,
  },
});
