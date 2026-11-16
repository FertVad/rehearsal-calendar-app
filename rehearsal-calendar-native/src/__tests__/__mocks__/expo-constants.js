/**
 * Expo Constants Mock for Jest
 *
 * The version and build are app.json's, as in the built app (T-265: every
 * request names them).
 */
const { expo } = require('../../../app.json');

const expoConfig = {
  version: expo.version,
  ios: { buildNumber: expo.ios.buildNumber },
  extra: {
    apiUrl: 'http://localhost:3001',
  },
};

module.exports = {
  default: {
    expoConfig,
    manifest: {},
    platform: {
      ios: {},
    },
  },
  expoConfig,
};
