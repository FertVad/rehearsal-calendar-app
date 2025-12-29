/**
 * Expo Vector Icons Mock for Jest
 */

const React = require('react');

// Create a proper mock icon component that accepts all props
const createIconMock = (iconSetName) => {
  const IconComponent = React.forwardRef((props, ref) => {
    const { name, size, color, style, ...otherProps } = props;

    // Render as Text element with icon metadata
    return React.createElement(
      'Text',
      {
        ...otherProps,
        ref,
        testID: `icon-${iconSetName}-${name}`,
        style: { fontSize: size, color, ...style },
      },
      `Icon: ${name}`
    );
  });

  IconComponent.displayName = iconSetName;

  // Add static methods that some tests might use
  IconComponent.getImageSource = jest.fn(() => Promise.resolve({ uri: 'mock-icon-uri' }));
  IconComponent.getRawGlyphMap = jest.fn(() => ({}));
  IconComponent.getFontFamily = jest.fn(() => iconSetName);
  IconComponent.loadFont = jest.fn(() => Promise.resolve());

  return IconComponent;
};

// Mock all icon sets
const Ionicons = createIconMock('Ionicons');
const MaterialIcons = createIconMock('MaterialIcons');
const MaterialCommunityIcons = createIconMock('MaterialCommunityIcons');
const FontAwesome = createIconMock('FontAwesome');
const FontAwesome5 = createIconMock('FontAwesome5');
const Feather = createIconMock('Feather');
const AntDesign = createIconMock('AntDesign');
const Entypo = createIconMock('Entypo');
const EvilIcons = createIconMock('EvilIcons');
const Foundation = createIconMock('Foundation');
const Octicons = createIconMock('Octicons');
const SimpleLineIcons = createIconMock('SimpleLineIcons');
const Zocial = createIconMock('Zocial');

module.exports = {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
  Feather,
  AntDesign,
  Entypo,
  EvilIcons,
  Foundation,
  Octicons,
  SimpleLineIcons,
  Zocial,
  createIconSet: jest.fn((glyphMap, fontFamily) => createIconMock(fontFamily || 'CustomIcon')),
  createIconSetFromFontello: jest.fn(() => createIconMock('FontelloIcon')),
  createIconSetFromIcoMoon: jest.fn(() => createIconMock('IcoMoonIcon')),
};
