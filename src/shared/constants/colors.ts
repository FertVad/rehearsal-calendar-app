/**
 * Design System Colors
 * Based on NATIVE_APP_SPEC.md
 */

export const Colors = {
  // Dark Theme (основная)
  bg: {
    primary: '#0d1117',
    secondary: '#161b22',
    tertiary: '#21262d',
  },

  text: {
    primary: '#e6edf3',
    secondary: '#8b949e',
    tertiary: '#6e7681',
    inverse: '#ffffff',
  },

  // Glass morphism
  glass: {
    bg: 'rgba(22, 27, 34, 0.7)',
    bgLight: 'rgba(22, 27, 34, 0.5)',
    border: 'rgba(139, 148, 158, 0.2)',
    hover: 'rgba(22, 27, 34, 0.9)',
  },

  // Accent colors
  accent: {
    purple: '#A855F7',
    purpleDark: '#9333EA',
    blue: '#3b82f6',
    green: '#10b981',
    red: '#ef4444',
    yellow: '#f59e0b',
  },

  // Borders & backgrounds
  border: {
    default: 'rgba(139, 148, 158, 0.2)',
    light: 'rgba(139, 148, 158, 0.1)',
  },
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 24,
} as const;

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
