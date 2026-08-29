import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';

// Survives a restart, so the count does not begin at nought every launch — and
// so it can be shown at all when the server cannot be reached.
const STORED_COUNT_KEY = 'unread-count';

interface UnreadContextValue {
  unreadCount: number;
  /** Ask the server again — after a push arrives, or the app comes forward. */
  refresh: () => Promise<void>;
  /** Without ids, marks the whole inbox. */
  markRead: (ids?: number[]) => Promise<void>;
  /** Deleting an unread one lowers the count, so it goes through here too. */
  remove: (id: number) => Promise<boolean>;
  removeAll: () => Promise<void>;
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

  // Until a real number arrives — from storage or the server — there is nothing
  // worth showing, and nothing worth writing to the app icon.
  const [known, setKnown] = useState(false);
  const knownRef = useRef(false);

  const remember = useCallback((count: number) => {
    knownRef.current = true;
    setKnown(true);
    setUnreadCount(count);
    AsyncStorage.setItem(STORED_COUNT_KEY, String(count)).catch(() => {
      // A count is not worth an error.
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORED_COUNT_KEY)
      .then((stored) => {
        // A fetch that has already answered wins over the stored value.
        if (stored !== null && !knownRef.current) remember(Number(stored) || 0);
      })
      .catch(() => {});
  }, [remember]);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsAPI.unreadCount();
      remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      // Offline, most likely. Keeping the last known count beats zeroing it and
      // hiding something the reader has not seen.
      logger.warn('[Unread] Could not refresh the count:', error);
    }
  }, [remember]);

  const markRead = useCallback(async (ids?: number[]) => {
    try {
      const res = await notificationsAPI.markRead(ids);
      remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      logger.warn('[Unread] Could not mark as read:', error);
    }
  }, [remember]);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await notificationsAPI.remove(id);
      remember(res.data?.unreadCount ?? 0);
      return true;
    } catch (error) {
      logger.warn('[Unread] Could not delete:', error);
      return false;
    }
  }, [remember]);

  const removeAll = useCallback(async () => {
    try {
      const res = await notificationsAPI.removeAll();
      remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      logger.warn('[Unread] Could not clear the inbox:', error);
    }
  }, [remember]);

  // The badge is not set at the call sites; it follows the count. Six places
  // used to set it, which is six chances for it to disagree with the bell.
  //
  // But only once a real number is in hand. Writing the initial nought would
  // clear the badge on every launch, before the server has said anything —
  // which with no network is not a flicker but the final answer.
  useEffect(() => {
    if (!known) return;
    Notifications.setBadgeCountAsync(unreadCount).catch(() => {
      // Simulators and devices without permission both land here.
    });
  }, [known, unreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refresh, markRead, remove, removeAll }),
    [unreadCount, refresh, markRead, remove, removeAll]
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadContextValue {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within an UnreadProvider');
  }
  return context;
}
