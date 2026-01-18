import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../../shared/constants/colors';

interface OnboardingProgressProps {
  currentStep: number; // 0-based: 0, 1, 2
  totalSteps: number;
}

export default function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentStep ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.accent.purple,
  },
  dotInactive: {
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: 'transparent',
  },
});
