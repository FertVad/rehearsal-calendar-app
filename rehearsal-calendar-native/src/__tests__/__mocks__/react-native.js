/**
 * React Native Mock for Jest
 *
 * Comprehensive mocks for all RN components used in tests
 */

const React = require('react');

// Create mock component factory
const mockComponent = (name) => {
  const Component = React.forwardRef((props, ref) => {
    return React.createElement(name, { ...props, ref }, props.children);
  });
  Component.displayName = name;
  return Component;
};

// Mock all RN components as proper React components
const View = mockComponent('View');
const Text = mockComponent('Text');
const ScrollView = mockComponent('ScrollView');
const Image = mockComponent('Image');
const TextInput = mockComponent('TextInput');
const ActivityIndicator = mockComponent('ActivityIndicator');

// TouchableOpacity needs special handling for disabled state
const TouchableOpacity = React.forwardRef((props, ref) => {
  const { onPress, disabled, children, ...otherProps } = props;

  // If disabled, don't call onPress
  const handlePress = (e) => {
    if (!disabled && onPress) {
      onPress(e);
    }
  };

  return React.createElement(
    'TouchableOpacity',
    { ...otherProps, ref, disabled, onPress: handlePress },
    children
  );
});
TouchableOpacity.displayName = 'TouchableOpacity';

// Pressable similar to TouchableOpacity
const Pressable = React.forwardRef((props, ref) => {
  const { onPress, disabled, children, ...otherProps } = props;

  const handlePress = (e) => {
    if (!disabled && onPress) {
      onPress(e);
    }
  };

  return React.createElement(
    'Pressable',
    { ...otherProps, ref, disabled, onPress: handlePress },
    children
  );
});
Pressable.displayName = 'Pressable';

// FlatList needs special handling to render items
const FlatList = React.forwardRef((props, ref) => {
  const { data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...otherProps } = props;

  // If no data, render empty component
  if (!data || data.length === 0) {
    if (ListEmptyComponent) {
      return React.createElement(
        'View',
        { ...otherProps, ref, testID: 'flat-list-empty' },
        typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
      );
    }
    return React.createElement('View', { ...otherProps, ref, testID: 'flat-list-empty' });
  }

  // Render items
  const children = [];

  if (ListHeaderComponent) {
    children.push(
      typeof ListHeaderComponent === 'function'
        ? React.createElement(ListHeaderComponent, { key: 'header' })
        : ListHeaderComponent
    );
  }

  data.forEach((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : String(index);
    children.push(renderItem({ item, index, separators: {} }));
  });

  if (ListFooterComponent) {
    children.push(
      typeof ListFooterComponent === 'function'
        ? React.createElement(ListFooterComponent, { key: 'footer' })
        : ListFooterComponent
    );
  }

  return React.createElement('View', { ...otherProps, ref, testID: 'flat-list' }, children);
});
FlatList.displayName = 'FlatList';

// SectionList similar handling
const SectionList = React.forwardRef((props, ref) => {
  const { sections, renderItem, renderSectionHeader, keyExtractor, ...otherProps } = props;

  const children = [];
  sections.forEach((section, sectionIndex) => {
    if (renderSectionHeader) {
      children.push(renderSectionHeader({ section }));
    }
    section.data.forEach((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      children.push(renderItem({ item, index, section, separators: {} }));
    });
  });

  return React.createElement('View', { ...otherProps, ref, testID: 'section-list' }, children);
});
SectionList.displayName = 'SectionList';

// Modal needs special handling
const Modal = (props) => {
  return props.visible
    ? React.createElement('Modal', props, props.children)
    : null;
};
Modal.displayName = 'Modal';

const Alert = {
  alert: jest.fn(),
};

const Share = {
  share: jest.fn(),
};

const Platform = {
  OS: 'ios',
  Version: '14.0',
  select: jest.fn((obj) => obj.ios || obj.default),
};

const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const StyleSheet = {
  create: jest.fn((styles) => styles),
  flatten: jest.fn((style) => style),
};

// Mock NativeModules for icon libraries
const NativeModules = {
  RNVectorIconsManager: {
    getImageForFont: jest.fn(),
  },
  UIManager: {
    RCTView: jest.fn(),
  },
};

module.exports = {
  // Native modules
  Alert,
  Share,
  Platform,
  Dimensions,
  StyleSheet,
  NativeModules,

  // Components
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  FlatList,
  SectionList,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,

  // Whether the app is in the foreground.
  //
  // Added because automatic calendar sync hangs off this and had no test — the
  // listener was registered inside a modal, so sync only ran while that sheet
  // was open, and nothing in the code looked wrong. __emit lets a test move the
  // app between states.
  AppState: {
    currentState: 'active',
    __listeners: [],
    addEventListener(_event, handler) {
      module.exports.AppState.__listeners.push(handler);
      return {
        remove: () => {
          const list = module.exports.AppState.__listeners;
          const i = list.indexOf(handler);
          if (i >= 0) list.splice(i, 1);
        },
      };
    },
    async __emit(state) {
      module.exports.AppState.currentState = state;
      for (const handler of [...module.exports.AppState.__listeners]) {
        await handler(state);
      }
    },
    __reset() {
      module.exports.AppState.__listeners = [];
      module.exports.AppState.currentState = 'active';
    },
  },

  // Additional utilities
  findNodeHandle: jest.fn(),
  Animated: {
    Value: jest.fn(),
    timing: jest.fn(),
    spring: jest.fn(),
    View: View,
    Text: Text,
  },
};
