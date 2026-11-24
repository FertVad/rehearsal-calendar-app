// The app in an e2e bundle (metro.config.js hands this to index.ts for
// ./App): the real one, untouched — unless the launch asks for its touches,
// as the App Store preview's recording does (e2e/store/video.yaml, T-289):
// `arguments: { rehearslyStoreTouches: "http://127.0.0.1:3003" }`. Then the
// real app sits in a view that only listens: in the capture phase it hears
// every touch the app gets, on any screen, sheet or modal, and tells the
// recorder where and when (storeTouches.js). It never takes a touch, never
// stops one going on, and draws nothing.
//
// No production bundle has this file: metro.config.js maps ./App to it only
// when e2e/run.mjs sets REHEARSLY_E2E (store-touches.test.mjs).
const React = require('react');
const { Dimensions, Settings, View } = require('react-native');
const App = require('../../App').default;
const { recorderUrl, touchRoute } = require('./storeTouches');

const url = recorderUrl(Settings.get('rehearslyStoreTouches'));

function report(phase, event) {
  const at = Date.now();
  const screen = Dimensions.get('window');
  for (const touch of event.nativeEvent.changedTouches ?? [event.nativeEvent]) {
    fetch(url + touchRoute(phase, touch, at, screen)).catch(() => {});
  }
}

function Touches(props) {
  return React.createElement(View, {
    style: { flex: 1 },
    onTouchStartCapture: (event) => report('down', event),
    onTouchEndCapture: (event) => report('up', event),
    onTouchCancelCapture: (event) => report('up', event),
  }, React.createElement(App, props));
}

exports.__esModule = true;
exports.default = url ? Touches : App;
