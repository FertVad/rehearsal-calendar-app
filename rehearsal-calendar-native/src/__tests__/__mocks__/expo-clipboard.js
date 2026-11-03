/**
 * Expo Clipboard Mock for Jest
 */

const React = require('react');

module.exports = {
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
  hasStringAsync: jest.fn(() => Promise.resolve(false)),
  // iOS's paste control, a host element a test presses with what it pastes.
  isPasteButtonAvailable: true,
  ClipboardPasteButton: (props) => React.createElement('ClipboardPasteButton', props),
};
