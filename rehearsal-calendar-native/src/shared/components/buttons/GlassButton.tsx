import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight } from '../../constants/colors';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'glass' | 'purple';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** For end-to-end flows (e2e/flows), which find the button by it. */
  testID?: string;
}

export default function GlassButton({
  title,
  onPress,
  variant = 'glass',
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID,
}: GlassButtonProps) {
  if (variant === 'purple') {
    return (
      <TouchableOpacity
        style={[styles.purpleButton, disabled && styles.disabled, style]}
        testID={testID}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <View style={styles.purpleContent}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.purpleText, textStyle]}>{title}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[styles.glassContainer, disabled && styles.disabled, style]}
    >
      <View style={styles.glassButton}>
        {loading ? (
          <ActivityIndicator color={Colors.text.primary} />
        ) : (
          <Text style={[styles.glassText, textStyle]}>{title}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  glassButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassText: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  purpleButton: {
    borderRadius: 6,
    overflow: 'hidden',
    minHeight: 44,
    backgroundColor: Colors.accent.purpleFill,
  },
  purpleContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  purpleText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  disabled: {
    opacity: 0.5,
  },
});
