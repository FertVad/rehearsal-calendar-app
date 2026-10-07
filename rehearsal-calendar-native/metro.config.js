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
if (process.env.REHEARSLY_E2E === '1') {
  const root = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  config.resolver.blockList = [].concat(config.resolver.blockList ?? [], new RegExp(`^${root}[\\\\/]\\.env[^\\\\/]*$`));
}

module.exports = config;
