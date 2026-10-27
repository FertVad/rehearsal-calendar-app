// Whether this launch plays a phone that can receive push (cause fix 20,
// review 3). A simulator cannot: registering ends at `!Device.isDevice`,
// before the permission and the server, so a flow could not hold the server's
// answer to a token. A flow that needs one launches the app with
// `arguments: { rehearslyPushDevice: "1" }`; iOS puts launch arguments among
// the user defaults, which React Native's Settings reads. Without it the app
// is the simulator it is (flow 23 says so on screen).
//
// Only an e2e bundle has this: metro.config.js hands these modules in for
// expo-device and expo-notifications when REHEARSLY_E2E is set.
const { Settings } = require('react-native');

module.exports = Settings.get('rehearslyPushDevice') != null;
