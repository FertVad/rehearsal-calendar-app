/**
 * React Navigation Native Mock for Jest
 */

// The guard the last screen rendered put on its removal (usePreventRemove).
const preventRemove = { prevent: false, callback: null };

module.exports = {
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setParams: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
  })),
  usePreventRemove: (prevent, callback) => {
    preventRemove.prevent = prevent;
    preventRemove.callback = callback;
  },
  // A way out of that screen — the close button, the swipe, back: true when it
  // goes through, false when the guard holds it and its callback is called.
  __remove(action = { type: 'GO_BACK' }) {
    if (!preventRemove.prevent) return true;
    preventRemove.callback({ data: { action } });
    return false;
  },
  __resetPreventRemove() {
    preventRemove.prevent = false;
    preventRemove.callback = null;
  },
  useRoute: jest.fn(() => ({
    params: {},
    key: 'test-route-key',
    name: 'TestRoute',
  })),
  useFocusEffect: jest.fn((callback) => callback()),
  useIsFocused: jest.fn(() => true),
  useNavigationContainerRef: jest.fn(() => ({ current: null })),
  NavigationContainer: ({ children }) => children,
};
