/**
 * Push Notifications Service
 * Handles Expo push notifications registration and management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, notificationsAPI } from './api';
import { logger } from '../utils/logger';

const PUSH_TOKEN_KEY = '@push_token';

// Shared by both registration paths so they cannot drift apart.
const EXPO_PROJECT_ID = '3151ccee-abfe-4f07-925e-00004d2fade8';

// Configure how notifications are displayed when app is foregrounded
// Wrapped in try-catch to prevent errors on iOS Simulator (notifications not supported)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.log('[Notifications] Handler setup failed (expected on simulator):', error);
}

/**
 * Register for push notifications and save token to backend
 * @returns {Promise<string | null>} Push token or null if failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.log('[Notifications] Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });

    const token = tokenData.data;
    console.log('[Notifications] Push token:', token);

    // Get device info
    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const deviceName = Device.modelName || 'Unknown Device';

    // Register token with backend
    await authAPI.registerPushToken(token, deviceType, deviceName);

    // Save token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rehearsal-notifications', {
        name: 'Rehearsal Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A855F7',
        sound: 'default',
      });
    }

    console.log('[Notifications] Registration successful');
    return token;
  } catch (error) {
    console.error('[Notifications] Registration error:', error);
    return null;
  }
}

/**
 * Re-register the device with the backend, but only if permission is already
 * granted — this never shows a prompt.
 *
 * Logging out deletes the token row on the server, and nothing used to put it
 * back: registration happened only on the onboarding screen and the profile
 * toggle. So signing out and back in stopped every notification, permanently
 * and silently, while the profile still read "enabled" because that switch
 * reflects a flag on the user rather than whether a device is registered.
 *
 * Call this whenever a user appears — login, or a restored session. It is
 * cheap and idempotent: the endpoint upserts on (user, device).
 */
export async function syncPushTokenIfGranted(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    // getPermissionsAsync, not requestPermissionsAsync: asking belongs to
    // onboarding and the profile toggle, where the user is expecting it. iOS
    // only shows the system prompt once, so spending it here would be worse
    // than useless.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    const token = tokenData.data;

    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const deviceName = Device.modelName || 'Unknown Device';

    await authAPI.registerPushToken(token, deviceType, deviceName);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch (error) {
    // Never surfaced: this runs in the background on every launch, and a
    // failure here must not interrupt anything.
    logger.warn('[Notifications] Could not re-register push token:', error);
    return null;
  }
}

/**
 * Mark the notification behind a tapped push as read, then bring the badge in
 * line. Tapping is reading — leaving it unread would keep a count pointing at
 * something the user has already dealt with.
 */
export async function markNotificationRead(notificationId?: number | null): Promise<void> {
  try {
    if (notificationId) await notificationsAPI.markRead([Number(notificationId)]);
  } catch (error) {
    logger.warn('[Notifications] Could not mark as read:', error);
  } finally {
    await syncBadgeWithUnread();
  }
}

/**
 * Set the app icon badge to the number of unread notifications.
 *
 * The server is the only place that knows: notifications arrive while the app is
 * closed, and are read on another device as easily as this one.
 */
export async function syncBadgeWithUnread(): Promise<number | null> {
  try {
    const res = await notificationsAPI.unreadCount();
    const unread = res.data?.unreadCount ?? 0;
    await Notifications.setBadgeCountAsync(unread);
    return unread;
  } catch (error) {
    // Offline, most likely. Leaving the badge as it is beats zeroing it and
    // hiding something the user has not seen.
    logger.warn('[Notifications] Could not sync the badge:', error);
    return null;
  }
}

/**
 * Unregister push token (call on logout)
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    // Get saved token
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

    if (token) {
      // Unregister from backend
      await authAPI.unregisterPushToken(token);

      // Remove from local storage
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);

      console.log('[Notifications] Token unregistered');
    }
  } catch (error) {
    console.error('[Notifications] Unregister error:', error);
  }
}

/**
 * Add listener for when notification is received while app is foregrounded
 * @param handler Callback function
 * @returns Subscription object
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add listener for when user taps on notification
 * @param handler Callback function
 * @returns Subscription object
 */
export function addNotificationResponseReceivedListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Get saved push token from local storage
 */
export async function getSavedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch (error) {
    console.error('[Notifications] Error getting saved token:', error);
    return null;
  }
}
