import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Set only by e2e/run.mjs for its own Metro: the development warning toasts sit
// over the tab bar and take the taps a flow means for it.
if (__DEV__ && process.env.EXPO_PUBLIC_E2E === '1') LogBox.ignoreAllLogs();

registerRootComponent(App);
