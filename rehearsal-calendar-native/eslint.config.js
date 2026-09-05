/**
 * ESLint 9 flat config.
 *
 * The project had an .eslintrc.js, which ESLint 9 refuses outright — so
 * `npm run lint`, `npm run lint:fix` and anything depending on them failed
 * before reading a single file. Nobody had been linting for a while, and
 * nothing said so beyond a migration notice nobody reads twice.
 *
 * The rules are the ones that were there. Translating them was the whole job;
 * choosing new ones is a separate conversation and would bury the change.
 */
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      '.metro-cache/**',
      'dist/**',
      'build/**',
      // Generated or vendored, and not ours to keep tidy.
      'server/node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        // React Native and Jest both put things on the global object that
        // eslint:recommended would otherwise call undefined.
        __DEV__: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // no-undef is the TypeScript compiler's job here, and it duplicates it
      // badly on type-only names.
      'no-undef': 'off',
      // Redeclared by the TypeScript rule above, which understands types.
      'no-unused-vars': 'off',

      // React
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // TypeScript does this
      'react/display-name': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'warn',

      // General
      'no-console': 'off',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
