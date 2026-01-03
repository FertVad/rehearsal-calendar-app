import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, FontSize, FontWeight } from '../../constants/colors';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'glass' | 'purple';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function GlassButton({
  title,
  onPress,
  variant = 'glass',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: GlassButtonProps) {
  if (variant === 'purple') {
    return (
      <TouchableOpacity
        style={[styles.purpleButton, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.accent.purple, Colors.accent.purpleDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.purpleGradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.purpleText, textStyle]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[styles.glassContainer, disabled && styles.disabled, style]}
    >
      <BlurView
        intensity={20}
        tint="dark"
        style={styles.glassButton}
      >
        {loading ? (
          <ActivityIndicator color={Colors.text.primary} />
        ) : (
          <Text style={[styles.glassText, textStyle]}>{title}</Text>
        )}
      </BlurView>
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
    backgroundColor: Colors.glass.bgLight,
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
  },
  purpleGradient: {
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
