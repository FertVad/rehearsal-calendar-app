import { useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

/** Pulled down this far, or flicked down this fast, the sheet goes. */
const DRAG_DISMISS_DISTANCE = 80;
const DRAG_DISMISS_VELOCITY = 800;

/**
 * The handle of the editor promises a drag (HIG sheets.md), and the drag is
 * this: the finger takes the sheet down, and let go far enough it is put away
 * (`putAway`) as its arrow puts it; short of that it springs back (T-030).
 *
 * Without a gesture of its own the swipe went to the screen's sheet, the
 * MarkBusy modal, and closed the whole screen. A pan of gesture-handler on the
 * handle and the header is the touch's, not the modal's.
 *
 * The sheet springs back however the drag ends: once the editor goes down,
 * its own animation takes it the rest of the way; once asked, it stays where
 * it was for the answer.
 */
export function useSheetDrag(putAway: () => void) {
  const offset = useRef(new Animated.Value(0)).current;
  // The latest, for the gesture made once.
  const putAwayRef = useRef(putAway);
  putAwayRef.current = putAway;

  const gesture = useMemo(() => {
    const back = () => {
      Animated.spring(offset, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    };
    return Gesture.Pan()
      .withTestId('availability-sheet-drag')
      .runOnJS(true)
      // Down only: a drag up, or sideways, is not the sheet's.
      .activeOffsetY(10)
      .failOffsetY(-10)
      .onUpdate((event) => {
        offset.setValue(Math.max(0, event.translationY));
      })
      .onEnd((event, success) => {
        back();
        const far = event.translationY >= DRAG_DISMISS_DISTANCE;
        const flicked = event.translationY > 0 && event.velocityY >= DRAG_DISMISS_VELOCITY;
        if (success && (far || flicked)) putAwayRef.current();
      });
  }, [offset]);

  return {
    /** For the GestureDetector around the handle and the header. */
    gesture,
    /** How far the finger has the sheet down, added to its own slide. */
    offset,
  };
}
