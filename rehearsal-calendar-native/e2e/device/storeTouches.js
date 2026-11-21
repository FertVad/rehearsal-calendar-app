// What the App Store preview's recording learns of a touch (T-289): where the
// finger went down and came up, when, and on how big a screen — told to the
// store's recorder (e2e/store/record.mjs), which keeps it beside the
// recording; montage.mjs draws a touch mark there and then. Nothing here is
// guessed: the app itself says where its touches landed.
//
// Only a recorder on this machine is ever told: the launch argument
// `rehearslyStoreTouches` must be http://127.0.0.1:<port>, or nothing is sent.
// Plain JavaScript, no React Native, so a test can hold it (store-touches.test.mjs).

/** The recorder's address from the launch argument, or null: no reports then. */
function recorderUrl(value) {
  return typeof value === 'string' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(value) ? value : null;
}

/**
 * The recorder's route for one touch: `phase` down or up, the touch's own
 * number (a down and its up share it), where in points from the window's top
 * left, when (ms since the epoch, the Mac's clock: a simulator runs on it),
 * and the window's size in points.
 */
function touchRoute(phase, touch, at, screen) {
  const n = (v) => String(Math.round(v * 10) / 10);
  return `/touch?phase=${phase}&id=${encodeURIComponent(String(touch.identifier))}&x=${n(touch.pageX)}&y=${n(touch.pageY)}`
    + `&at=${Math.round(at)}&w=${n(screen.width)}&h=${n(screen.height)}`;
}

module.exports = { recorderUrl, touchRoute };
