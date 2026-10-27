// expo-notifications in an e2e bundle: the real module, and when the launch
// plays a phone (pushDevice.js) what only a phone has: the permission granted
// and an Expo token, made here — Expo's servers are never asked. The token
// goes to the local server as any other; everything after it is the app's.
const Notifications = require('expo-notifications');

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };

module.exports = require('./pushDevice')
  ? {
      ...Notifications,
      getPermissionsAsync: async () => granted,
      requestPermissionsAsync: async () => granted,
      getExpoPushTokenAsync: async () => ({ type: 'expo', data: 'ExponentPushToken[e2e-simulator]' }),
    }
  : Notifications;
