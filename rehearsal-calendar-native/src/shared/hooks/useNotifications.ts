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
   * Handle navigation when notification is tapped
   */
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
        case 'rehearsal_deleted':
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
