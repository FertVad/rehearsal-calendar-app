/**
 * react-native-gesture-handler for Jest: a gesture is its callbacks, kept by
 * its test id for the test to call as the native side would, and a detector
 * is its child. `__gesture(id)` hands one back.
 */
const React = require('react');

const gestures = new Map();

const pan = () => {
  const gesture = { handlers: {} };
  const chain = new Proxy(gesture, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        if (key === 'withTestId') gestures.set(args[0], gesture);
        if (typeof key === 'string' && key.startsWith('on')) gesture.handlers[key] = args[0];
        return chain;
      };
    },
  });
  return chain;
};

const GestureDetector = ({ children }) => React.Children.only(children);

module.exports = {
  Gesture: { Pan: pan },
  GestureDetector,
  __gesture: (id) => gestures.get(id),
};
