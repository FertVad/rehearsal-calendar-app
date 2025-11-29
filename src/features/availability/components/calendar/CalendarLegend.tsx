import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../../../../shared/constants/colors';

export default function CalendarLegend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.statusDotFree]} />
        <Text style={styles.legendText}>Свободен</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.statusDotPartial]} />
        <Text style={styles.legendText}>Частично</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.statusDotBusy]} />
        <Text style={styles.legendText}>Занят</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  statusDotFree: {
    backgroundColor: Colors.accent.green,
  },
  statusDotPartial: {
    backgroundColor: Colors.accent.yellow,
  },
  statusDotBusy: {
    backgroundColor: Colors.accent.red,
  },
});
