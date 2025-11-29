import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../../../shared/constants/colors';
import { DayMode } from '../../types';

interface ModeInfoProps {
  mode: DayMode;
}

export const ModeInfo: React.FC<ModeInfoProps> = ({ mode }) => {
  if (mode !== 'free' && mode !== 'busy') {
    return null;
  }

  return (
    <View style={styles.modeInfo}>
      <Ionicons
        name="information-circle"
        size={20}
        color={mode === 'free' ? Colors.accent.green : Colors.accent.red}
      />
      <Text style={styles.modeInfoText}>
        {mode === 'free'
          ? 'Вы доступны весь день для репетиций'
          : 'Вы недоступны в этот день'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modeInfoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
});
