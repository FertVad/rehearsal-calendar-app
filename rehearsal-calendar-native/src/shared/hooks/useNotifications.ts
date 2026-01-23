/**
 * useNotifications Hook
 * Handles push notification registration, navigation, and lifecycle
 */

import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

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
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('[useNotifications] Notification received:', notification);

      // Trigger haptic feedback
      hapticMedium();

      // Clear badge after viewing
      clearBadgeCount();
    });

    // Listen for user interaction with notification
    responseListener.current = addNotificationResponseReceivedListener((response) => {
      console.log('[useNotifications] Notification tapped:', response);

      const data = response.notification.request.content.data;

      // Navigate based on notification type
      handleNotificationNavigation(data);

      // Clear badge
      clearBadgeCount();
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user]);

  /**
   * Handle navigation when notification is tapped
   */
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
          // Navigate to project detail with rehearsals tab
          if (projectId) {
            navigation.navigate('ProjectDetail', {
              projectId: String(projectId),
              initialTab: 'rehearsals',
            });
          }
          break;

        case 'rehearsal_deleted':
          // Navigate to project detail
          if (projectId) {
            navigation.navigate('ProjectDetail', {
              projectId: String(projectId),
            });
          }
          break;

        case 'project_invite':
        case 'role_changed':
        case 'member_removed':
        case 'project_deleted':
          // Navigate to projects list
          navigation.navigate('Projects');
          break;

        default:
          console.log('[useNotifications] Unknown notification type:', type);
      }
    } catch (error) {
      console.error('[useNotifications] Navigation error:', error);
    }
  };
}
