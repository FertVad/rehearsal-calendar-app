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
        'node_modules/(?!(react-native|@react-native|expo|@expo|expo-clipboard|react-native-calendars)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Mock React Native modules
        '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.js',
        '^react-native-calendars$': '<rootDir>/src/__tests__/__mocks__/react-native-calendars.js',
        '^@expo/vector-icons$': '<rootDir>/src/__tests__/__mocks__/expo-vector-icons.js',
        '^expo-clipboard$': '<rootDir>/src/__tests__/__mocks__/expo-clipboard.js',
        '^expo-calendar$': '<rootDir>/src/__tests__/__mocks__/expo-calendar.js',
        '^expo-constants$': '<rootDir>/src/__tests__/__mocks__/expo-constants.js',
        '^expo-font$': '<rootDir>/src/__tests__/__mocks__/expo-font.js',
        '^expo-haptics$': '<rootDir>/src/__tests__/__mocks__/expo-haptics.js',
        '^@react-navigation/native$': '<rootDir>/src/__tests__/__mocks__/react-navigation-native.js',
        '^@react-native-async-storage/async-storage$': '<rootDir>/src/__tests__/__mocks__/async-storage.js',
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
