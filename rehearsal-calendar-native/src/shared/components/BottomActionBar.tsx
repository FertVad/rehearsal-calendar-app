/**
 * The bar a screen's main action sits in, pinned to the bottom of the screen.
 *
 * It owns the bottom edge: clear of the home indicator when the keyboard is
 * down, on top of the keyboard when it is up. Screens used to leave this to
 * their own padding and a KeyboardAvoidingView tuned per screen, and each got
 * it wrong its own way: Save in the availability sheet half inside the
 * home-indicator zone, where a finger reaching for it starts the go-home
 * gesture; the rehearsal form's Create under the keyboard (T-009).
 *
 * The bar must end at the bottom of the screen — outside any SafeAreaView,
 * not inside a KeyboardAvoidingView — because it measures from there: the
 * home indicator's inset and the keyboard's height are both counted from the
 * screen's bottom edge, which is also where a modal sheet ends.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
} from 'react-native';
import type { KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/colors';

/** Above the home indicator, or above the keyboard, by this much. */
export const BOTTOM_ACTION_GAP = Spacing.sm;
export const BOTTOM_ACTION_HEIGHT = 50;

/**
 * How much of the screen's bottom the keyboard covers, 0 when it is down.
 * iOS says before it moves, so the bar moves with it; Android only after.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const follow = (event: KeyboardEvent, next: number) => {
      if (ios && event?.duration) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { duration: event.duration, type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next);
    };
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      follow(event, event.endCoordinates.height));
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) =>
      follow(event, 0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

type BarProps = {
  children: React.ReactNode;
  testID?: string;
};

export function BottomActionBar({ children, testID }: BarProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // The keyboard covers the home indicator, so with it up the inset is in it.
  const below = keyboard > 0 ? keyboard : insets.bottom;

  return (
    <View testID={testID} style={[styles.bar, { paddingBottom: below + BOTTOM_ACTION_GAP }]}>
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** The screen's main action, or a quieter one beside it (Cancel). */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function BottomActionButton({
  label,
  onPress,
  testID,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const primary = variant === 'primary';
  const color = primary ? Colors.text.inverse : Colors.text.secondary;

  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.button, primary ? styles.primary : styles.secondary, (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={color} />}
          <Text style={[styles.label, { color }, primary && styles.primaryLabel]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
    backgroundColor: Colors.bg.secondary,
  },
  button: {
    flex: 1,
    height: BOTTOM_ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  primary: {
    backgroundColor: Colors.accent.purple,
  },
  secondary: {
    backgroundColor: Colors.bg.tertiary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  primaryLabel: {
    fontWeight: FontWeight.semibold,
  },
});
