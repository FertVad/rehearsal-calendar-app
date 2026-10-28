/**
 * react-native-screens for Jest: AppModal shows its content in a
 * FullWindowOverlay on iOS, which here is a plain container.
 */
const React = require('react');

const FullWindowOverlay = (props) => React.createElement('FullWindowOverlay', props, props.children);
FullWindowOverlay.displayName = 'FullWindowOverlay';

module.exports = { FullWindowOverlay };
