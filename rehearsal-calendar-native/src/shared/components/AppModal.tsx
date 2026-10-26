import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

interface AppModalProps {
  visible: boolean;
  /** Android's back button; iOS has none. */
  onRequestClose: () => void;
  /** How it comes in and goes away: up from the bottom, or fading. */
  animationType?: 'slide' | 'fade';
  children: ReactNode;
}

const DURATION_MS = 250;

/**
 * Every sheet and dialog of the app is shown in this, over everything, and
 * nothing calls React Native's `Modal` itself (modalBackdrops.test.ts).
 *
 * On iOS it is not that `Modal`. It presents a view controller from the screen
 * it is on, and from the second one a screen presents — a picker opened again,
 * the end time after the start, the timezone list after a look at it — nothing
 * is in the accessibility tree: the sheet is drawn, but XCTest finds neither
 * it nor what is behind it, and VoiceOver reads the same tree. The first one a
 * screen presents is whole, whatever was shown on another screen before
 * (T-208). A full-window overlay presents nothing: its content goes into the
 * window, marked modal, so VoiceOver stays on the sheet, the same every time.
 * Android keeps `Modal`, which also gives the back button `onRequestClose`.
 */
export function AppModal({ visible, onRequestClose, animationType = 'slide', children }: AppModalProps) {
  if (Platform.OS !== 'ios') {
    return (
      <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
        {children}
      </Modal>
    );
  }
  return <Overlay visible={visible} animationType={animationType}>{children}</Overlay>;
}

function Overlay({ visible, animationType, children }: Pick<AppModalProps, 'visible' | 'animationType' | 'children'>) {
  const { height } = useWindowDimensions();
  // Shown, 1, or gone, 0; it stays mounted while it goes away.
  const shown = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(shown, { toValue: visible ? 1 : 0, duration: DURATION_MS, useNativeDriver: true })
      .start(({ finished }) => {
        // Not when opened again before it was gone.
        if (finished && !visible) setMounted(false);
      });
  }, [visible, shown]);

  if (!mounted) return null;
  const motion = animationType === 'fade'
    ? { opacity: shown }
    : { transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] };
  return (
    <FullWindowOverlay>
      <Animated.View style={[styles.fill, motion]} pointerEvents={visible ? 'auto' : 'none'}>
        {children}
      </Animated.View>
    </FullWindowOverlay>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
