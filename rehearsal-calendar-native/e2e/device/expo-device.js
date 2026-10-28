// expo-device in an e2e bundle: the real module, a phone when the launch asks
// for one (pushDevice.js).
const Device = require('expo-device');

module.exports = require('./pushDevice') ? { ...Device, isDevice: true } : Device;
