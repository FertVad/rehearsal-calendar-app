import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../../shared/constants/colors';
import { DayMode } from '../../types';

interface ModeSelectorProps {
  mode: DayMode;
  onModeChange: (mode: DayMode) => void;
  disabled?: boolean;
}

export default function ModeSelector({ mode, onModeChange, disabled = false }: ModeSelectorProps) {
  return (
    <View style={styles.modeSelector}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          mode === 'free' && styles.modeButtonActive,
          mode === 'free' && styles.modeButtonFree,
        ]}
        onPress={() => onModeChange('free')}
        disabled={disabled}
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={mode === 'free' ? Colors.accent.green : Colors.text.tertiary}
        />
        <Text style={[
          styles.modeButtonText,
          mode === 'free' && styles.modeButtonTextActive,
        ]}>
          Свободен
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          mode === 'custom' && styles.modeButtonActive,
          mode === 'custom' && styles.modeButtonCustom,
        ]}
        onPress={() => onModeChange('custom')}
        disabled={disabled}
      >
        <Ionicons
          name="time"
          size={20}
          color={mode === 'custom' ? Colors.accent.yellow : Colors.text.tertiary}
        />
        <Text style={[
          styles.modeButtonText,
          mode === 'custom' && styles.modeButtonTextActive,
        ]}>
          Частично
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          mode === 'busy' && styles.modeButtonActive,
          mode === 'busy' && styles.modeButtonBusy,
        ]}
        onPress={() => onModeChange('busy')}
        disabled={disabled}
      >
        <Ionicons
          name="close-circle"
          size={20}
          color={mode === 'busy' ? Colors.accent.red : Colors.text.tertiary}
        />
        <Text style={[
          styles.modeButtonText,
          mode === 'busy' && styles.modeButtonTextActive,
        ]}>
          Занят
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    gap: Spacing.xs,
  },
  modeButtonActive: {
    borderWidth: 2,
  },
  modeButtonFree: {
    borderColor: Colors.accent.green,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  modeButtonCustom: {
    borderColor: Colors.accent.yellow,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  modeButtonBusy: {
    borderColor: Colors.accent.red,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  modeButtonText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  modeButtonTextActive: {
    color: Colors.text.primary,
  },
});
