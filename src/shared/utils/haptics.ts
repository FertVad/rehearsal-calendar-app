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
 * Heavy impact haptic feedback
 * Use for: critical actions, deletions
 */
export const hapticHeavy = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

/**
 * Success notification haptic
 * Use for: successful operations, saves
 */
export const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/**
 * Warning notification haptic
 * Use for: warnings, important alerts
 */
export const hapticWarning = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

/**
 * Error notification haptic
 * Use for: errors, failed operations
 */
export const hapticError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

/**
 * Selection haptic feedback
 * Use for: picker changes, slider movements
 */
export const hapticSelection = () => {
  Haptics.selectionAsync();
};
