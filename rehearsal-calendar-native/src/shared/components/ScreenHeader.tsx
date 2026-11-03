/**
 * The bar at the top of a screen — one for every screen (T-029).
 *
 * Each screen drew its own, and they came out four ways: a 24 pt bold title
 * with a cross on its right (the rehearsal form, "Busy"), a 18 pt title
 * between a back arrow and an empty box (new project, profile edit), a 24 pt
 * title after an arrow (a project, calendar sync, the inbox), and a 24 pt
 * title alone (the tabs). The way out was a cross, a chevron or an arrow,
 * on either side, depending on who wrote the screen.
 *
 * Now there are three kinds, as iOS has them, and sizes, gaps and type come
 * from here only:
 * - `modal` — a sheet: "Cancel" on the left, the title in the middle, the
 *   screen's action on the right if it has one there (HIG sheets.md). Where
 *   the main action sits in the bar at the bottom (T-009), it is not repeated
 *   up here. Cancel leaves the way a swipe down does, through the leave guard
 *   of a screen with changes (T-013).
 * - `stack` — a screen pushed in a tab: "‹" with the name of the screen
 *   under it, then the title.
 * - `root` — the first screen of a tab: a large title, nothing to go back to.
 *
 * Inside the rehearsal details' `formSheet` the bar is a row in the sheet's
 * one scroll view: its `flex` is only along the row, never a height.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, Spacing, TouchTarget } from '../constants/colors';

/** iOS's own: the inline title and its buttons 17 pt, the large title 34. */
const BAR_TEXT = 17;
const LARGE_TITLE = 34;

type Common = {
  title: string;
  /** What sits at the right end: the screen's action, a count, a spinner. */
  right?: React.ReactNode;
  /** Lines the title may take before it is cut (the rehearsal's name: 2). */
  titleLines?: number;
  /** The side its buttons take a tap in, where iOS draws the screen smaller
   *  (the details sheet at three quarters). Never less than 44. */
  target?: number;
};

export type ScreenHeaderProps =
  | (Common & {
      kind: 'modal';
      /** Left out where there is nothing to go back to. */
      onCancel?: () => void;
      /** "Cancel"; "Close" on a sheet that only shows. */
      cancelLabel: string;
    })
  | (Common & {
      kind: 'stack';
      onBack: () => void;
      /** The title of the screen "‹" goes back to. */
      backTitle: string;
    })
  | (Common & { kind: 'root' });

export function ScreenHeader(props: ScreenHeaderProps) {
  const { title, right, titleLines = 1 } = props;
  const tall = { minHeight: Math.max(TouchTarget, props.target ?? TouchTarget) };

  if (props.kind === 'root') {
    return (
      <View style={styles.root} testID="screen-header-root">
        <Text style={styles.largeTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right ? <View style={styles.rootRight}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.bar} testID={`screen-header-${props.kind}`}>
      <View style={[styles.side, styles.left]}>
        {props.kind === 'modal' ? (
          props.onCancel ? (
            <TouchableOpacity
              testID="header-cancel"
              accessibilityRole="button"
              style={[styles.textButton, tall]}
              onPress={props.onCancel}
            >
              <Text style={styles.buttonText} numberOfLines={1}>{props.cancelLabel}</Text>
            </TouchableOpacity>
          ) : null
        ) : (
          <TouchableOpacity
            testID="header-back"
            accessibilityRole="button"
            style={[styles.backButton, tall]}
            onPress={props.onBack}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.accent.purple} style={styles.chevron} />
            <Text style={styles.buttonText} numberOfLines={1}>{props.backTitle}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text
        style={styles.title}
        numberOfLines={titleLines}
        accessibilityRole="header"
        testID="header-title"
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

/** A text button for the right end of a modal's bar: "Save", "Edit". */
export function HeaderTextButton({ label, onPress, disabled, testID, target }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** As ScreenHeader's `target`. */
  target?: number;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.textButton, { minHeight: Math.max(TouchTarget, target ?? TouchTarget) }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[styles.buttonText, styles.actionText, disabled && styles.disabledText]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  // Both ends take the same share of the row, so the title is in the middle
  // of the screen whatever stands beside it. Along the row only.
  side: {
    flexGrow: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  title: {
    flexShrink: 1,
    maxWidth: '50%',
    fontSize: BAR_TEXT,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  textButton: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  backButton: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.sm,
    flexShrink: 1,
  },
  chevron: {
    marginRight: -Spacing.xs,
  },
  buttonText: {
    fontSize: BAR_TEXT,
    color: Colors.accent.purple,
    flexShrink: 1,
  },
  actionText: {
    fontWeight: FontWeight.semibold,
  },
  disabledText: {
    color: Colors.text.tertiary,
  },
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  largeTitle: {
    flexShrink: 1,
    fontSize: LARGE_TITLE,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  rootRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
