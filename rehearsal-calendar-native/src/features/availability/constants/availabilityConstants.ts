/**
 * Constants for Availability feature
 */
import { Dimensions } from 'react-native';
import { FontSize, Spacing } from '../../../shared/constants/colors';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DAY_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xs * 6) / 7;

// Calculate month height for scroll calculations
export const MONTH_TITLE_HEIGHT = FontSize.lg + Spacing.md; // Title + marginBottom
export const WEEKDAY_ROW_HEIGHT = FontSize.xs + Spacing.sm; // Labels + marginBottom
export const DAY_ROW_HEIGHT = DAY_SIZE + Spacing.xs; // Day cell + marginBottom

/**
 * Height of the editor sheet.
 *
 * A flat 320 was a third of the screen on a large phone while the slot list
 * inside it was already scrolling. Scale with the device instead, clamped so
 * small screens keep a usable calendar above and large ones do not turn the
 * sheet into a full-screen takeover.
 */
export const PANEL_HEIGHT = Math.round(
  Math.min(Math.max(SCREEN_HEIGHT * 0.55, 320), 620)
);
