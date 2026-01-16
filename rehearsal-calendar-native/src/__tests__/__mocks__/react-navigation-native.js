/**
 * React Navigation Native Mock for Jest
 */

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
  useRoute: jest.fn(() => ({
    params: {},
    key: 'test-route-key',
    name: 'TestRoute',
  })),
  useFocusEffect: jest.fn((callback) => callback()),
  useIsFocused: jest.fn(() => true),
  NavigationContainer: ({ children }) => children,
};
