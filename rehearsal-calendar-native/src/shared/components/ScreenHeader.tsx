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
 *   of a screen with changes (T-013). Its buttons are always whole; the
 *   title gives way, over two lines (T-244, `ModalBar`).
 * - `stack` — a screen pushed in a tab: "‹" with the name of the screen
 *   under it, then the title. Where that name does not fit beside the
 *   title, "‹ Back"; where that does not either, "‹" alone — never a word
 *   cut short, as iOS's own `generic` back button (T-239: "‹ Проф…" beside
 *   the sync screen's title, "‹ My Pr…" beside a long project name).
 * - `root` — the first screen of a tab: a large title, nothing to go back to.
 *
 * Inside the rehearsal details' `formSheet` the bar is a row in the sheet's
 * one scroll view: its `flex` is only along the row, never a height.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, FontWeight, Spacing, TouchTarget } from '../constants/colors';
import { IconButton } from './IconButton';

/** iOS's own: the inline title and its buttons 17 pt, the large title 34. */
const BAR_TEXT = 17;
const LARGE_TITLE = 34;

type Common = {
  title: string;
  /** What sits at the right end: the screen's action, a count, a spinner. */
  right?: React.ReactNode;
  /** Lines the title may take before it is cut: a sheet's 2, others' 1. */
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
      /** "Back" in the app's language, for where `backTitle` does not fit. */
      backWord: string;
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

  if (props.kind === 'modal') {
    return (
      <ModalBar
        title={title}
        titleLines={props.titleLines ?? 2}
        left={props.onCancel ? (
          <TouchableOpacity
            testID="header-cancel"
            accessibilityRole="button"
            style={[styles.textButton, tall]}
            onPress={props.onCancel}
          >
            <Text style={styles.buttonText} numberOfLines={1}>{props.cancelLabel}</Text>
          </TouchableOpacity>
        ) : null}
        right={right}
      />
    );
  }

  return (
    <View style={styles.bar} testID={`screen-header-${props.kind}`}>
      <BackSide title={props.backTitle} word={props.backWord} onBack={props.onBack} tall={tall} />
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

/**
 * A sheet's bar: its buttons whole, the title what is left (T-244).
 *
 * The two ends took equal shares of the row beside a title of up to half of
 * it, so a button wider than its share was cut: «Закрыть · Прогон всей
 * программы · Измен…». As iOS's own bar, the buttons are never cut and the
 * title gives way — it wraps, up to two lines, and is cut only at the end of
 * the second. Each end is as wide as its button's words, measured where it
 * stands (it is never squeezed: it does not shrink); both are then as wide as
 * the wider, so the title stays in the middle of the screen.
 */
function ModalBar({ title, titleLines, left, right }: {
  title: string;
  titleLines: number;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [leftWidth, setLeftWidth] = React.useState<number>();
  const [rightWidth, setRightWidth] = React.useState<number>();
  const ends = leftWidth === undefined || rightWidth === undefined
    ? undefined
    : { minWidth: Math.ceil(Math.max(leftWidth, rightWidth)) };

  return (
    <View style={styles.bar} testID="screen-header-modal">
      <View style={[styles.end, styles.left, ends]} testID="header-left-end">
        <View style={styles.endContent} onLayout={(event) => setLeftWidth(event.nativeEvent.layout.width)}>
          {left}
        </View>
      </View>
      <Text
        style={styles.modalTitle}
        numberOfLines={titleLines}
        accessibilityRole="header"
        testID="header-title"
      >
        {title}
      </Text>
      <View style={[styles.end, styles.right, ends]} testID="header-right-end">
        <View style={styles.endContent} onLayout={(event) => setRightWidth(event.nativeEvent.layout.width)}>
          {right}
        </View>
      </View>
    </View>
  );
}

/** The chevron's glyph, drawn `Spacing.xs` into the words after it. */
const CHEVRON = 28;
/** What the back button takes besides its words: the chevron and the gap after them. */
const BACK_CHROME = CHEVRON - Spacing.xs + Spacing.sm;

/**
 * What "‹" says, as iOS's `generic` back button: the screen it goes back to
 * where that fits in `room`, else "Back", else nothing. `undefined` until
 * the room and the words are measured.
 */
export function backLabel(
  room: number | undefined,
  title: { text: string; width: number | undefined },
  word: { text: string; width: number | undefined },
): string | null | undefined {
  if (room === undefined || title.width === undefined || word.width === undefined) return undefined;
  const fits = (width: number) => Math.ceil(width) + BACK_CHROME <= room;
  if (fits(title.width)) return title.text;
  if (fits(word.width)) return word.text;
  return null;
}

/**
 * The left end of a pushed screen's bar. It is as wide as the right end
 * whatever stands in it, so its room is known before its words are chosen;
 * the words are measured once, at their size, out of sight.
 */
function BackSide({ title, word, onBack, tall }: {
  title: string;
  word: string;
  onBack: () => void;
  tall: { minHeight: number };
}) {
  const [room, setRoom] = React.useState<number>();
  const [titleWidth, setTitleWidth] = React.useState<number>();
  const [wordWidth, setWordWidth] = React.useState<number>();
  const label = backLabel(room, { text: title, width: titleWidth }, { text: word, width: wordWidth });

  return (
    <View
      testID="header-back-side"
      style={[styles.side, styles.left]}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
    >
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          testID="header-back-measure-title"
          style={styles.buttonText}
          onLayout={(event) => setTitleWidth(event.nativeEvent.layout.width)}
        >
          {title}
        </Text>
        <Text
          testID="header-back-measure-word"
          style={styles.buttonText}
          onLayout={(event) => setWordWidth(event.nativeEvent.layout.width)}
        >
          {word}
        </Text>
      </View>
      {label === null ? (
        // The chevron alone: an icon button, 44 a side, "Back" to VoiceOver.
        <IconButton
          testID="header-back"
          icon="chevron-back"
          size={CHEVRON}
          color={Colors.accent.purple}
          accessibilityLabel={word}
          minSize={tall.minHeight}
          onPress={onBack}
        />
      ) : (
        <TouchableOpacity
          testID="header-back"
          accessibilityRole="button"
          style={[styles.backButton, tall]}
          onPress={onBack}
        >
          <Ionicons name="chevron-back" size={CHEVRON} color={Colors.accent.purple} style={styles.chevron} />
          {/* Until the words are measured, the name takes its place unseen. */}
          <Text style={[styles.buttonText, label === undefined && styles.unmeasured]} numberOfLines={1}>
            {label ?? title}
          </Text>
        </TouchableOpacity>
      )}
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
  // A sheet's ends: as wide as what stands in them, never less (T-244).
  end: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  endContent: {
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
  // Between a sheet's ends, all that is left of the row.
  modalTitle: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
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
  // Wide enough that no word is wrapped or cut while it is measured.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
  unmeasured: {
    opacity: 0,
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
