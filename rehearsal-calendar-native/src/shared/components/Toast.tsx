/**
 * A short notice that something went through: "Saved", for two seconds, over
 * the bottom of the screen, taking no taps.
 *
 * Success used to be an alert the person had to dismiss, which the HIG asks
 * not to do for information alone (alerts.md: "Avoid using an alert merely to
 * provide information"); status belongs in the interface (feedback.md). The
 * screen stays where it was and nothing waits on a tap (T-021).
 *
 *   const toast = useToast();
 *   toast.show(t.common.saved);
 *   <Toast message={toast.message} />
 *
 * It sits above the screen's bottom action bar (BottomActionBar), where that
 * bar is or would be, so it covers neither the bar's button nor the home
 * indicator.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/colors';
import { BOTTOM_ACTION_GAP, BOTTOM_ACTION_HEIGHT } from './BottomActionBar';

/** How long a notice stays. */
export const TOAST_DURATION_MS = 2000;

/** The notice shown now, if any, and how to show one. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => {
      timer.current = null;
      setMessage(null);
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, show };
}

export function Toast({ message, testID = 'toast' }: { message: string | null; testID?: string }) {
  const insets = useSafeAreaInsets();
  if (!message) return null;

  // The bar's own height: its button, the gap under it and the padding above.
  const bar = insets.bottom + BOTTOM_ACTION_GAP + BOTTOM_ACTION_HEIGHT + Spacing.sm;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: bar + Spacing.md }]}>
      <View style={styles.toast}>
        <Ionicons name="checkmark-circle" size={18} color={Colors.accent.green} />
        <Text testID={testID} style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.bg.tertiary,
  },
  text: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
});
