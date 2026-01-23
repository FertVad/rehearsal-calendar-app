/**
 * Push Notifications Service
 * Handles Expo push notifications registration and management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './api';

const PUSH_TOKEN_KEY = '@push_token';

// Configure how notifications are displayed when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
      projectId: '3151ccee-abfe-4f07-925e-00004d2fade8',
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
 * Clear badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
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
