// expo-notifications in an e2e bundle: the real module, and when the launch
// plays a phone (pushDevice.js) what only a phone has: the permission granted
// and an Expo token, made here — Expo's servers are never asked. The token
// goes to the local server as any other; everything after it is the app's.
//
// A phone whose owner refused notifications in iOS's prompt — `arguments: {
// rehearslyPushDevice: "denied" }` — has the permission denied, and iOS will
// not ask again: only Settings can change it (flow 94, T-256). The simulator
// cannot be made to refuse: registering stops at `!Device.isDevice` before the
// permission is read.
const { Settings } = require('react-native');
const Notifications = require('expo-notifications');

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
const denied = { status: 'denied', granted: false, canAskAgain: false, expires: 'never' };

const permission = Settings.get('rehearslyPushDevice') === 'denied' ? denied : granted;

module.exports = require('./pushDevice')
  ? {
      ...Notifications,
      getPermissionsAsync: async () => permission,
      requestPermissionsAsync: async () => permission,
      getExpoPushTokenAsync: async () => ({ type: 'expo', data: 'ExponentPushToken[e2e-simulator]' }),
    }
  : Notifications;
