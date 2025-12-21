/**
 * Clear tracking for incorrectly imported all-day event
 * Run this in React Native Debugger console or add to app temporarily
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearAllDayEventTracking() {
  try {
    const IMPORT_TRACKING_KEY = 'calendar-import-tracking';
    const EVENT_ID = 'F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740';

    // Get current tracking
    const trackingJson = await AsyncStorage.getItem(IMPORT_TRACKING_KEY);
    if (!trackingJson) {
      console.log('No import tracking found');
      return;
    }

    const tracking = JSON.parse(trackingJson);
    console.log('Current tracking:', Object.keys(tracking).length, 'events');

    // Remove the specific event
    if (tracking[EVENT_ID]) {
      delete tracking[EVENT_ID];
      console.log(`Removed tracking for event: ${EVENT_ID}`);

      // Save back
      await AsyncStorage.setItem(IMPORT_TRACKING_KEY, JSON.stringify(tracking));
      console.log('Updated tracking saved:', Object.keys(tracking).length, 'events remaining');
    } else {
      console.log(`Event ${EVENT_ID} not found in tracking`);
    }
  } catch (error) {
    console.error('Error clearing tracking:', error);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clearAllDayEventTracking };
}

// Auto-run if executed directly
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Can be called from React Native Debugger:
  // require('./scripts/clear-allday-tracking.js').clearAllDayEventTracking()
}
