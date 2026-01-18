import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  backgroundColor?: string;
  size?: number;
  bottom?: number;
  right?: number;
  style?: ViewStyle;
}

export function FloatingActionButton({
  onPress,
  icon = 'add',
  color = 'rgba(255, 255, 255, 0.9)',
  backgroundColor = Colors.accent.purple,
  size = 56,
  bottom = 20,
  right = 20,
  style,
}: FloatingActionButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor,
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom,
          right,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={28} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});
