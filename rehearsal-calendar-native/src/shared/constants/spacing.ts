/**
 * Spacing System
 * Consistent spacing values for margins, paddings, and gaps
 */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** The sign-in screen's buttons — "Sign In", Google's and Apple's — are one height. */
export const AUTH_BUTTON_HEIGHT = 50;

/**
 * The least a control may be to a finger, on its smaller side (HIG,
 * accessibility: 44×44 pt on iOS). What shows can be smaller; the area that
 * takes the tap is not. Neighbours get room between them rather than areas
 * laid over each other.
 */
export const TouchTarget = 44;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const;
