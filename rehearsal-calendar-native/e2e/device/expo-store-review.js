// expo-store-review in an e2e bundle (T-410). iOS shows its rating window on
// every request in a Debug build, and the e2e app is one: a window over the
// screen after some save would stand in the way of any flow. So by default
// iOS is never asked here — `isAvailableAsync` answers false, as where the
// request cannot be made — whatever reviewPrompt.ts decides.
//
// A flow that shows the window launches the app with
//   arguments: { rehearslyStoreReview: "due" }
// and gets the real module, and a phone on which the app was used on the
// three days before this one: their keys are written here, under the prefix
// reviewPrompt.ts counts (`review-day:`), each a write of its own, before the
// app first reads them. Whether to ask is still the app's own rule — the
// onboarding, the first launch, the version, the fourteen days. iOS puts
// launch arguments among the user defaults, which React Native's Settings
// reads (as pushDevice.js).
//
// Only an e2e bundle has this: metro.config.js hands it in for
// expo-store-review when REHEARSLY_E2E is set.
const StoreReview = require('expo-store-review');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { Settings } = require('react-native');

const due = Settings.get('rehearslyStoreReview') === 'due';

const localDay = (daysAgo) => {
  const at = new Date();
  at.setDate(at.getDate() - daysAgo);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

if (due) {
  // Not written, the flow fails where it waits for the window: nothing to add.
  AsyncStorage.multiSet([3, 2, 1].map((ago) => [`review-day:${localDay(ago)}`, '1']))
    .catch(() => undefined);
}

module.exports = due
  ? StoreReview
  : {
      ...StoreReview,
      isAvailableAsync: () => Promise.resolve(false),
      requestReview: () => Promise.resolve(),
    };
