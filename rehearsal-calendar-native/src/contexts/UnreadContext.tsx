import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationsAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';

interface UnreadContextValue {
  unreadCount: number;
  /** Ask the server again — after a push arrives, or the app comes forward. */
  refresh: () => Promise<void>;
  /** Without ids, marks the whole inbox. */
  markRead: (ids?: number[]) => Promise<void>;
}

const UnreadContext = createContext<UnreadContextValue | undefined>(undefined);

/**
 * How many notifications are unread — for the bell, the app icon and the inbox
 * alike.
 *
 * Four places used to keep their own answer: the calendar held a number it
 * refreshed only when the screen regained focus, the inbox set the icon badge
 * itself, and the push handler set it again from two more. So a notification
 * arriving while the calendar was open lit the icon and left the bell reading
 * zero, and marking something read in the inbox never reached the bell at all.
 *
 * One number, one writer. The icon badge follows it rather than being set
 * alongside it, which is what kept the two from drifting.
 */
export function UnreadProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsAPI.unreadCount();
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch (error) {
      // Offline, most likely. Keeping the last known count beats zeroing it and
      // hiding something the reader has not seen.
      logger.warn('[Unread] Could not refresh the count:', error);
    }
  }, []);

  const markRead = useCallback(async (ids?: number[]) => {
    try {
      const res = await notificationsAPI.markRead(ids);
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch (error) {
      logger.warn('[Unread] Could not mark as read:', error);
    }
  }, []);

  // The badge is not set at the call sites; it follows the count. Six places
  // used to set it, which is six chances for it to disagree with the bell.
  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount).catch(() => {
      // Simulators and devices without permission both land here.
    });
  }, [unreadCount]);

  const value = useMemo(() => ({ unreadCount, refresh, markRead }), [unreadCount, refresh, markRead]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadContextValue {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within an UnreadProvider');
  }
  return context;
}
