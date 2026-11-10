/**
 * useNotifications Hook
 * Handles push notification registration, navigation, and lifecycle
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { runAutoSync } from './useAutoCalendarSync';
import { emitDataChanged } from '../utils/dataChanged';
import { hapticMedium } from '../utils/haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useUnread } from '../../contexts/UnreadContext';
import type { AppNavigation, ProjectSection } from '../../navigation';

import { logger } from '../utils/logger';

/**
 * Open a project from a notification — a tapped push or a card in the inbox.
 *
 * ProjectDetail and the projects list both live two levels down — inside the
 * Projects tab of MainTabs — so they have to be addressed through their
 * parents. Naming them directly, as this did, throws "was not handled by any
 * navigator" and the tap does nothing at all: every notification in the app
 * was inert.
 *
 * A modal screen may be open over the tabs; `pop: true` closes it and goes
 * back to them, where navigating without it pushed a copy of MainTabs over
 * the modal (T-007). `initial: false`: over the projects list, even when
 * the tab has not been opened yet. `section`: where on the project it opens.
 */
export function openProject(
  navigation: Pick<AppNavigation, 'navigate'>,
  projectId: string | number,
  section?: ProjectSection
) {
  navigation.navigate('MainTabs', {
    screen: 'Projects',
    params: {
      screen: 'ProjectDetail',
      params: section ? { projectId: String(projectId), section } : { projectId: String(projectId) },
      initial: false,
    },
  }, { pop: true });
}

/**
 * Open the calendar from a notification: "you were taken off a rehearsal".
 * The rehearsal is no longer theirs to open, and the calendar is where it has
 * just disappeared from (T-233). `pop: true`, as above, closes a modal over
 * the tabs instead of pushing a second MainTabs on top of it.
 */
export function openCalendar(navigation: Pick<AppNavigation, 'navigate'>) {
  navigation.navigate('MainTabs', {
    screen: 'Calendar',
    params: { screen: 'CalendarMain' },
  }, { pop: true });
}

/** Where on its project a notification of this type opens: "New member" on the members (T-023). */
export function projectSectionOf(type: string): ProjectSection | undefined {
  return type === 'member_joined' ? 'members' : undefined;
}

/**
 * A push that changes what the person may do in a project: a role given or
 * taken, a removal, a deletion. The list of projects — where the role is read
 * from — is read again at once, received in the app or opened by a tap, so an
 * admin's buttons come and go when the owner changes the role (T-229).
 */
const CHANGES_PROJECTS = new Set(['role_changed', 'member_removed', 'project_deleted']);
function reloadProjectsFor(data: any) {
  if (CHANGES_PROJECTS.has(data?.type)) emitDataChanged('projects');
}
/**
 * Hook for managing push notifications
 * Should be called once in the root component (App.tsx)
 */
export function useNotifications() {
  const navigation = useNavigation<AppNavigation<'MainTabs'>>();
  const { user } = useAuth();
  const { refresh, markRead } = useUnread();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const handledLaunchResponse = useRef(false);
  const appStateListener = useRef<{ remove: () => void } | undefined>(undefined);

  useEffect(() => {
    // Registering the device is not done here. This asked for the system
    // permission whenever the tabs mounted for someone with notifications on —
    // so "Later" on the onboarding screen was answered by the very prompt it
    // put off (GC01). The session keeps the device registered without asking
    // (AuthContext, keepPushRegistered); only the person's own action asks.

    // Listen for notifications received while app is foregrounded
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        logger.debug('[useNotifications] Notification received:', notification);

        // Trigger haptic feedback
        hapticMedium();

        // Seeing the banner is not reading it — the count simply catches up,
        // and the bell moves with it.
        refresh();

        // And bring the calendar in line. A push telling someone their
        // rehearsal was cancelled used to move the unread count and nothing
        // else, so the event sat in their calendar — alarm and all — until the
        // app happened to be sent away and brought back. The sync's own lock
        // and throttle are shared, so this cannot cause an extra run.
        runAutoSync().catch(() => {
          // Nothing to tell the reader; the next foreground tries again.
        });

        // And tell whatever is on screen to reload. Screens refresh when they
        // gain focus, and one already in focus never gains it again — so a
        // rehearsal announced by a push did not appear in the list until the
        // app was restarted, even though its event had just been written to the
        // calendar.
        emitDataChanged('rehearsals');
        reloadProjectsFor(notification.request.content.data);
      });

      // Listen for user interaction with notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        logger.debug('[useNotifications] Notification tapped:', response);

        const data = response.notification.request.content.data;

        // Navigate based on notification type
        handleNotificationNavigation(data);
        reloadProjectsFor(data);

        if ((data as any)?.notificationId) markRead([Number((data as any).notificationId)]);
        else refresh();
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
            reloadProjectsFor(data);
            if (data?.notificationId) markRead([Number(data.notificationId)]);
            else refresh();
          })
          .catch((error) => {
            logger.debug('[useNotifications] Could not read the launching notification:', error);
          });
      }
    } catch (error) {
      logger.debug('[useNotifications] Listener setup failed (expected on simulator):', error);
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
      refresh();
      appStateListener.current = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
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
        logger.debug('[useNotifications] Cleanup failed (expected on simulator):', error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the listeners stay for the session: `handleNotificationNavigation` reads only `navigation`, whose `navigate` goes to the same navigator from any render, so the one they hold is never out of date (T-243)
  }, [user, refresh, markRead]);

  /**
   * Open the rehearsal the notification is about.
   *
   * A notification names one rehearsal, so landing on the project list — or
   * even the project — makes the reader hunt for what they were just told
   * about. Its details are a route on the app stack, loaded by id, so the
   * sheet opens over whatever screen is up.
   */
  const openRehearsal = (rehearsalId: string | number) => {
    navigation.navigate('RehearsalDetails', { rehearsalId: String(rehearsalId) });
  };

  /**
   * The list itself, not just its tab: `pop: true` keeps the MainTabs that is
   * there, and with it the Projects stack as it was left — naming only the tab
   * showed whatever card was open there, even the project just deleted. The
   * stack is taken back down to ProjectsMain the same way, with `pop: true`.
   */
  const openProjectsList = () => {
    navigation.navigate('MainTabs', {
      screen: 'Projects',
      params: { screen: 'ProjectsMain', pop: true },
    }, { pop: true });
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
          else if (projectId) openProject(navigation, projectId);
          break;

        case 'rehearsal_deleted':
          // No rehearsal left to open — the project is the nearest thing.
          if (projectId) openProject(navigation, projectId);
          break;

        case 'rehearsal_removed':
          // Taken off it: the rehearsal is not theirs to open any more.
          openCalendar(navigation);
          break;

        case 'member_joined':
          // On its members. One sent before it carried the project's id opens
          // nothing (T-023).
          if (projectId) openProject(navigation, projectId, projectSectionOf(type));
          break;

        case 'project_invite':
        case 'role_changed':
        case 'member_removed':
        case 'project_deleted':
          openProjectsList();
          break;

        default:
          logger.debug('[useNotifications] Unknown notification type:', type);
      }
    } catch (error) {
      logger.error('[useNotifications] Navigation error:', error);
    }
  };
}
