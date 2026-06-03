/**
 * Haptic feedback utilities
 * Provides tactile feedback for user interactions
 */
import * as Haptics from 'expo-haptics';

/**
 * Light impact haptic feedback
 * Use for: buttons, toggles, list item selections
 */
export const hapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Medium impact haptic feedback
 * Use for: important buttons, confirmations
 */
export const hapticMedium = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Success notification haptic
 * Use for: successful operations, saves
 */
export const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
