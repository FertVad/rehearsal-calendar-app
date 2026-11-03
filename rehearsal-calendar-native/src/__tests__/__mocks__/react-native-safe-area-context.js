/**
 * react-native-safe-area-context Mock for Jest
 *
 * A phone with no notch and no home indicator; a test that needs the insets
 * mocks the module with its own (AvailabilitySaveBar.test.tsx).
 */

const React = require('react');

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

module.exports = {
  useSafeAreaInsets: () => insets,
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children, ...props }) => React.createElement('View', props, children),
  initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 375, height: 812 } },
};
