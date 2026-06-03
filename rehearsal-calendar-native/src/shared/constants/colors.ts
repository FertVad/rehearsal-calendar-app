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
    tertiary: '#7d8590', // Updated for WCAG AA compliance (4.8:1 contrast ratio)
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

    // Translucent variants for backgrounds, highlights, borders
    purpleAlpha05: 'rgba(168, 85, 247, 0.05)',
    purpleAlpha10: 'rgba(168, 85, 247, 0.1)',
    purpleAlpha15: 'rgba(168, 85, 247, 0.15)',
    purpleAlpha20: 'rgba(168, 85, 247, 0.2)',

    purpleDarkAlpha10: 'rgba(147, 51, 234, 0.1)',
    purpleDarkAlpha15: 'rgba(147, 51, 234, 0.15)',
    purpleDarkAlpha20: 'rgba(147, 51, 234, 0.2)',
    purpleDarkAlpha30: 'rgba(147, 51, 234, 0.3)',
  },

  // Borders & backgrounds
  border: {
    default: 'rgba(139, 148, 158, 0.2)',
    light: 'rgba(139, 148, 158, 0.1)',
  },
} as const;

// Re-export for backward compatibility
export { Spacing, BorderRadius } from './spacing';
export { FontSize, FontWeight } from './typography';
