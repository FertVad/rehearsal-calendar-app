/**
 * Ionicons for Jest: `@expo/vector-icons/Ionicons`, the one icon set the app
 * draws. The app imports the set's own file, not the library's entry file,
 * which requires all 19 fonts (T-242).
 */

const React = require('react');

// Renders as a Text with the icon's name, accepting all props
const Ionicons = React.forwardRef((props, ref) => {
  const { name, size, color, style, ...otherProps } = props;

  return React.createElement(
    'Text',
    {
      ...otherProps,
      ref,
      testID: `icon-Ionicons-${name}`,
      style: { fontSize: size, color, ...style },
    },
    `Icon: ${name}`
  );
});

Ionicons.displayName = 'Ionicons';

// Static methods some tests might use
Ionicons.getImageSource = jest.fn(() => Promise.resolve({ uri: 'mock-icon-uri' }));
Ionicons.getRawGlyphMap = jest.fn(() => ({}));
Ionicons.getFontFamily = jest.fn(() => 'Ionicons');
Ionicons.loadFont = jest.fn(() => Promise.resolve());

module.exports = { __esModule: true, default: Ionicons };
