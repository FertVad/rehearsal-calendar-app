/**
 * useNotifications Hook
 * Handles push notification registration, navigation, and lifecycle
 */

import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  clearBadgeCount,
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

        // Clear badge after viewing
        clearBadgeCount();
      });

      // Listen for user interaction with notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('[useNotifications] Notification tapped:', response);

        const data = response.notification.request.content.data;

        // Navigate based on notification type
        handleNotificationNavigation(data);

        // Clear badge
        clearBadgeCount();
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

            handleNotificationNavigation(response.notification.request.content.data);
            clearBadgeCount();
          })
          .catch((error) => {
            console.log('[useNotifications] Could not read the launching notification:', error);
          });
      }
    } catch (error) {
      console.log('[useNotifications] Listener setup failed (expected on simulator):', error);
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
   */
  const openProject = (projectId: string | number) => {
    navigation.navigate('MainTabs' as any, {
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
    navigation.navigate('MainTabs' as any, {
      screen: 'Calendar',
      params: {
        screen: 'CalendarMain',
        params: { openRehearsalId: String(rehearsalId) },
      },
    });
  };

  const openProjectsList = () => {
    navigation.navigate('MainTabs' as any, { screen: 'Projects' });
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
