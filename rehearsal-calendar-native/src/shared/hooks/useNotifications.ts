/**
 * useNotifications Hook
 * Handles push notification registration, navigation, and lifecycle
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  syncBadgeWithUnread as syncBadge,
  markNotificationRead,
} from '../services/notifications';
import { hapticMedium } from '../utils/haptics';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Hook for managing push notifications
 * Should be called once in the root component (App.tsx)
 */
export function useNotifications() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const handledLaunchResponse = useRef(false);
  const appStateListener = useRef<{ remove: () => void } | undefined>(undefined);

  useEffect(() => {
    // Only register if user is logged in and notifications are enabled
    if (user && user.notificationsEnabled) {
      registerForPushNotifications()
        .then((token) => {
          if (token) {
            console.log('[useNotifications] Registered with token:', token);
          }
        })
        .catch((error) => {
          console.error('[useNotifications] Registration failed:', error);
        });
    }

    // Listen for notifications received while app is foregrounded
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        console.log('[useNotifications] Notification received:', notification);

        // Trigger haptic feedback
        hapticMedium();

        // Seeing the banner is not reading it — the badge follows the inbox.
        syncBadge();
      });

      // Listen for user interaction with notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('[useNotifications] Notification tapped:', response);

        const data = response.notification.request.content.data;

        // Navigate based on notification type
        handleNotificationNavigation(data);

        markNotificationRead((data as any)?.notificationId);
      });

      // A tap that *launched* the app is not delivered to the listener above:
      // iOS hands it over before React has mounted, let alone before `user` has
      // loaded from the API, and the listener only ever sees events that arrive
      // after it is registered. Without this, tapping a notification on a phone
      // where the app was closed — the usual case for a morning reminder — just
      // opened the app on its first tab, and the tap did nothing.
      //
      // The response persists for the session, so it is handled once — and only
      // once `user` exists. On a cold start this effect first runs with nobody
      // signed in, while the navigator is still showing the login stack, so
      // navigating then would silently fail. It re-runs when the session is
      // restored.
      if (user) {
        Notifications.getLastNotificationResponseAsync()
          .then((response) => {
            if (!response || handledLaunchResponse.current) return;
            handledLaunchResponse.current = true;

            const data = response.notification.request.content.data as any;
            handleNotificationNavigation(data);
            markNotificationRead(data?.notificationId);
          })
          .catch((error) => {
            console.log('[useNotifications] Could not read the launching notification:', error);
          });
      }
    } catch (error) {
      console.log('[useNotifications] Listener setup failed (expected on simulator):', error);
    }

    // The badge is the unread count from the server, refreshed whenever the app
    // comes forward.
    //
    // It briefly cleared the badge on open instead, which was the best available
    // answer while there was nowhere in the app to read a notification: the count
    // otherwise hung around forever, pointing at something unreachable. Now that
    // the inbox exists, blanking it would be a lie in the other direction — the
    // dot would vanish while the notifications behind it stayed unread. Reading
    // them is what clears it.
    if (user) {
      syncBadge();
      appStateListener.current = AppState.addEventListener('change', (state) => {
        if (state === 'active') syncBadge();
      });
    }

    // Cleanup
    return () => {
      try {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
        if (appStateListener.current) {
          appStateListener.current.remove();
        }
      } catch (error) {
        console.log('[useNotifications] Cleanup failed (expected on simulator):', error);
      }
    };
  }, [user]);

  /**
   * ProjectDetail and the projects list both live two levels down — inside the
   * Projects tab of MainTabs — so they have to be addressed through their
   * parents. Naming them directly, as this did, throws "was not handled by any
   * navigator" and the tap does nothing at all: every notification in the app
   * was inert.
   *
   * popTo rather than navigate: a tap can land while a modal is open, and
   * navigate put a second MainTabs on top of it instead of returning to the one
   * already underneath. popTo goes to the existing one and cannot duplicate it.
   */
  const openProject = (projectId: string | number) => {
    navigation.popTo('MainTabs' as any, {
      screen: 'Projects',
      params: {
        screen: 'ProjectDetail',
        params: { projectId: String(projectId) },
      },
    });
  };

  /**
   * Open the rehearsal the notification is about.
   *
   * A notification names one rehearsal, so landing on the project list — or
   * even the project — makes the reader hunt for what they were just told
   * about. Its details are a modal on the calendar rather than a route, so the
   * id goes across as a param and CalendarScreen opens it once its data is in.
   */
  const openRehearsal = (rehearsalId: string | number) => {
    navigation.popTo('MainTabs' as any, {
      screen: 'Calendar',
      params: {
        screen: 'CalendarMain',
        params: { openRehearsalId: String(rehearsalId) },
      },
    });
  };

  const openProjectsList = () => {
    navigation.popTo('MainTabs' as any, { screen: 'Projects' });
  };

  const handleNotificationNavigation = (data: any) => {
    if (!data || !data.type) return;

    const { type, rehearsalId, projectId } = data;

    try {
      switch (type) {
        case 'rehearsal_created':
        case 'rehearsal_updated':
        case 'rehearsal_reminder_24h':
        case 'rehearsal_reminder_1h':
        case 'member_response':
          // The rehearsal itself, falling back to its project only when the
          // notification did not carry an id.
          if (rehearsalId) openRehearsal(rehearsalId);
          else if (projectId) openProject(projectId);
          break;

        case 'rehearsal_deleted':
          // No rehearsal left to open — the project is the nearest thing.
          if (projectId) openProject(projectId);
          break;

        case 'project_invite':
        case 'role_changed':
        case 'member_removed':
        case 'project_deleted':
          openProjectsList();
          break;

        default:
          console.log('[useNotifications] Unknown notification type:', type);
      }
    } catch (error) {
      console.error('[useNotifications] Navigation error:', error);
    }
  };
}
