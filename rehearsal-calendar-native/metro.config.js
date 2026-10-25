// Expo's default configuration, unchanged — except for an e2e run.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// In development Expo bundles the project's .env files and lets them win over
// the environment, so EXPO_PUBLIC_API_URL given to Metro does not reach the
// app while .env names another address — and this checkout's .env names
// production. e2e/run.mjs sets REHEARSLY_E2E and keeps those files out of the
// bundle, so the app talks to the local server the runner started; the runner
// then checks the bundle for any other address before the app is opened.
//
// What the run itself writes — e2e/out, where Maestro puts its screenshots
// while the flows run — is not watched either. Each file there was a change to
// Metro, so an HMR "update-start", and the app put up and took down its
// "Refreshing..." banner, a window of its own, over the screen under test and
// in its screenshots (T-207). The app's own files are still watched, so an edit
// still reaches the app.
if (process.env.REHEARSLY_E2E === '1') {
  const root = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  config.resolver.blockList = [].concat(
    config.resolver.blockList ?? [],
    new RegExp(`^${root}[\\\\/]\\.env[^\\\\/]*$`),
    new RegExp(`^${root}[\\\\/]e2e[\\\\/]out[\\\\/]`),
  );
}

module.exports = config;
