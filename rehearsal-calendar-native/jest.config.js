// West of UTC on purpose. A date-only value read as an instant —
// new Date('2026-09-10') is midnight UTC — lands on the day before there and
// nowhere east of it, so on this machine (Jerusalem) and in UTC CI the
// mistake passes every test. Set before any test runs; workers inherit it.
process.env.TZ = 'America/New_York';

module.exports = {
  projects: [
    {
      // Frontend tests (React Hooks - no UI rendering)
      displayName: 'frontend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.(test|spec).(ts|tsx)'],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react',
            esModuleInterop: true,
          },
        }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|expo|@expo|expo-clipboard|react-native-calendars|@react-navigation/routers|@react-navigation/core)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Mock React Native modules
        '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.js',
        '^react-native-calendars$': '<rootDir>/src/__tests__/__mocks__/react-native-calendars.js',
        '^react-native-screens$': '<rootDir>/src/__tests__/__mocks__/react-native-screens.js',
        '^@expo/vector-icons$': '<rootDir>/src/__tests__/__mocks__/expo-vector-icons.js',
        '^expo-clipboard$': '<rootDir>/src/__tests__/__mocks__/expo-clipboard.js',
        '^expo-calendar$': '<rootDir>/src/__tests__/__mocks__/expo-calendar.js',
        '^expo-constants$': '<rootDir>/src/__tests__/__mocks__/expo-constants.js',
        '^expo-font$': '<rootDir>/src/__tests__/__mocks__/expo-font.js',
        '^expo-haptics$': '<rootDir>/src/__tests__/__mocks__/expo-haptics.js',
        '^expo-notifications$': '<rootDir>/src/__tests__/__mocks__/expo-notifications.js',
        '^expo-device$': '<rootDir>/src/__tests__/__mocks__/expo-device.js',
        '^@react-navigation/native$': '<rootDir>/src/__tests__/__mocks__/react-navigation-native.js',
        '^@react-native-async-storage/async-storage$': '<rootDir>/src/__tests__/__mocks__/async-storage.js',
        // The real stack router, for checking a navigation is handled. Its built
        // copy is an ES module, which the server's --experimental-vm-modules run
        // refuses to require; the TypeScript source it ships compiles like ours.
        '^@react-navigation/routers$': '<rootDir>/node_modules/@react-navigation/routers/src/index.tsx',
        // The real link parser, the same way: what state a link opens.
        '^@react-navigation/core/getStateFromPath$': '<rootDir>/node_modules/@react-navigation/core/src/getStateFromPath.tsx',
      },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
      ],
    },
    {
      // Backend tests (Node.js with native ES modules)
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.(test|spec).(js)'],
      transform: {}, // No transform needed - using native ES modules
      moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
      // The app listens on 127.0.0.1, where supertest sends; on the wildcard
      // another process could take the request (loopbackSupertest.js).
      moduleNameMapper: {
        '^supertest$': '<rootDir>/server/__tests__/loopbackSupertest.js',
      },
      collectCoverageFrom: [
        'server/**/*.{js}',
        '!server/**/__tests__/__mocks__/**',
        '!server/**/__tests__/integration/setup.js',
        '!server/**/__tests__/**',
        '!server/**/*.test.{js}',
        '!server/**/*.spec.{js}',
      ],
    },
  ],
};
