/**
 * Push Notifications Service
 * Handles Expo push notifications registration and management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './api';
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
  logger.debug('[Notifications] Handler setup failed (expected on simulator):', error);
}

/**
 * What registering this device came to (cause fix 20). It used to be a token
 * or null, and null meant a refusal, a simulator and a dropped connection
 * alike — so the profile took each of them for success (GC02), and nothing
 * could tell a failure worth trying again from an answer (GC03).
 */
export type PushRegistration =
  /** Permission granted and the token is on the server. */
  | 'registered'
  /** The system permission is not granted: refused, or never asked. */
  | 'denied'
  /** This device cannot receive push at all (a simulator). */
  | 'unsupported'
  /** Permission granted, but the token did not reach the server. */
  | 'failed';

/**
 * What this device last came to, for the session: one value that every
 * registration writes and the profile reads ('unknown' until the first
 * attempt has ended, and again once the session is over).
 *
 * The profile used to keep its own copy, read from the system permission when
 * it was focused: a token the server refused read as registered again after
 * a tab change, and an answer given in Settings was not seen until the next
 * one (review of cause fix 20).
 */
export type PushDeviceState = PushRegistration | 'unknown';

let deviceState: PushDeviceState = 'unknown';
const deviceListeners = new Set<() => void>();

function setDeviceState(state: PushDeviceState) {
  if (state === deviceState) return;
  deviceState = state;
  deviceListeners.forEach((listener) => listener());
}

export function getPushDeviceState(): PushDeviceState {
  return deviceState;
}

/** For useSyncExternalStore. */
export function subscribePushDeviceState(listener: () => void): () => void {
  deviceListeners.add(listener);
  return () => {
    deviceListeners.delete(listener);
  };
}

/**
 * The one place that registers this device. Only `ask` may show the system
 * prompt, and only the person's own action passes it: the onboarding screen's
 * Allow and the profile (`askAndRegisterPush`). The session's own attempts
 * run in the background and never ask (`keepPushRegistered`).
 *
 * iOS shows that prompt once: a refusal can only be undone in Settings. The
 * notifications hook used to ask whenever a signed-in user with notifications
 * on mounted the tabs, so "Later" on the onboarding screen was answered by the
 * same prompt a moment later (GC01).
 */
async function registerPush(ask: boolean): Promise<PushRegistration> {
  if (!Device.isDevice) {
    logger.debug('[Notifications] Push notifications only work on physical devices');
    return 'unsupported';
  }

  let status: string;
  try {
    status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted' && ask) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
  } catch (error) {
    logger.warn('[Notifications] Could not read the push permission:', error);
    return 'failed';
  }
  if (status !== 'granted') return 'denied';

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    const token = tokenData.data;

    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const deviceName = Device.modelName || 'Unknown Device';

    // The endpoint upserts on (user, device), so registering again is cheap.
    await authAPI.registerPushToken(token, deviceType, deviceName);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rehearsal-notifications', {
        name: 'Rehearsal Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A855F7',
        sound: 'default',
      });
    }

    logger.debug('[Notifications] Registration successful');
    return 'registered';
  } catch (error) {
    logger.warn('[Notifications] Could not register the push token:', error);
    return 'failed';
  }
}

/** The person asked for notifications: may show the system prompt. */
export async function askAndRegisterPush(): Promise<PushRegistration> {
  const result = await registerPush(true);
  setDeviceState(result);
  return result;
}

/** Whether this device can receive push right now, without asking. */
async function pushPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!Device.isDevice) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Keeps this device registered for the session that is on: registers at once
 * and, until it has, again each time the app comes forward. Returns the stop.
 * Never shows a prompt. Logging out deletes the token row on the server, so a
 * session that appears — login, or a restored one — puts it back.
 *
 * It registered once per session and gave up on any failure, so a sign-in
 * made on a bad connection left the device without notifications for the
 * whole session, silently (GC03). Coming forward is also when a permission
 * granted in Settings is first seen — and one taken back there: a registered
 * device then only reads the permission, and is 'denied' once it is gone, to
 * be registered again when it returns. One attempt at a time; a simulator
 * stops it, as nothing there can register. What each attempt comes to is the
 * device's state (`getPushDeviceState`); the end of the session clears it.
 */
export function keepPushRegistered(): () => void {
  let stopped = false;
  let running = false;

  const attempt = async () => {
    if (stopped || running || deviceState === 'unsupported') return;
    running = true;
    try {
      if (deviceState === 'registered') {
        const permission = await pushPermission();
        if (!stopped && permission !== 'granted') setDeviceState('denied');
      } else {
        // An attempt that ends after its session has must not speak for the
        // next one.
        const result = await registerPush(false);
        if (!stopped) setDeviceState(result);
      }
    } finally {
      running = false;
    }
  };

  setDeviceState('unknown');
  attempt();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') attempt();
  });

  return () => {
    stopped = true;
    subscription.remove();
    setDeviceState('unknown');
  };
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

      logger.debug('[Notifications] Token unregistered');
    }
  } catch (error) {
    logger.error('[Notifications] Unregister error:', error);
  }
}

