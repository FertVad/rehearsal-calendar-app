import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';
import { useAuth } from './AuthContext';
import { useRequestOrder, useSession, useSessionState } from '../shared/hooks/useSession';
import { isCurrentSession } from '../shared/services/session';

// Survives a restart, so the count does not begin at nought every launch — and
// so it can be shown at all when the server cannot be reached. One per person:
// a shared key was read by the next account before anything wiped it (NI03).
const storedCountKey = (userId: string | number) => `unread-count:${userId}`;

interface UnreadContextValue {
  unreadCount: number;
  /** Ask the server again — after a push arrives, or the app comes forward. */
  refresh: () => Promise<void>;
  /** Without ids, marks the whole inbox. */
  markRead: (ids?: number[]) => Promise<void>;
  /** Deleting an unread one lowers the count, so it goes through here too. */
  remove: (id: number) => Promise<boolean>;
  removeAll: () => Promise<boolean>;
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const session = useSession();
  // The count is the session's: the next person starts from nothing known, and
  // an answer for the previous one writes neither the count nor the stored
  // copy (NI03).
  const [unreadCount, setUnreadCount] = useSessionState(0);

  // Until a real number arrives — from storage or the server — there is nothing
  // worth showing, and nothing worth writing to the app icon.
  const [known, setKnown] = useSessionState(false);
  const knownRef = useRef<{ session: number; known: boolean }>({ session, known: false });

  // Reads and changes of the count in one order (useRequestOrder): a count read
  // while a change was on its way may be the old count, and a change's answer
  // is not dropped for a read that came after it (NI04, review).
  const order = useRequestOrder();

  const remember = useCallback((count: number) => {
    if (!isCurrentSession(session)) return;
    knownRef.current = { session, known: true };
    setKnown(true);
    setUnreadCount(count);
    if (userId === null) return;
    AsyncStorage.setItem(storedCountKey(userId), String(count)).catch(() => {
      // A count is not worth an error.
    });
  }, [session, userId, setKnown, setUnreadCount]);

  // The signed-in person's own stored count.
  const signedIn = userId !== null;
  useEffect(() => {
    if (userId === null) return;
    AsyncStorage.getItem(storedCountKey(userId))
      .then((stored) => {
        // A fetch that has already answered wins over the stored value.
        const known = knownRef.current.session === session && knownRef.current.known;
        if (stored !== null && !known) remember(Number(stored) || 0);
      })
      .catch(() => {});
  }, [userId, session, remember]);

  const refresh = useCallback(async () => {
    const answer = order.beginRead();
    try {
      const res = await notificationsAPI.unreadCount();
      if (answer()) remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      // Offline, most likely. Keeping the last known count beats zeroing it and
      // hiding something the reader has not seen.
      logger.warn('[Unread] Could not refresh the count:', error);
    }
  }, [order, remember]);

  // Every change answers with the count it leaves behind.
  const change = useCallback(
    (send: () => Promise<{ data?: { unreadCount?: number } }>) =>
      order.write(async (answer) => {
        const res = await send();
        if (answer()) remember(res.data?.unreadCount ?? 0);
      }),
    [order, remember]
  );

  const markRead = useCallback(async (ids?: number[]) => {
    try {
      await change(() => notificationsAPI.markRead(ids));
    } catch (error) {
      logger.warn('[Unread] Could not mark as read:', error);
    }
  }, [change]);

  const remove = useCallback(async (id: number) => {
    try {
      await change(() => notificationsAPI.remove(id));
      return true;
    } catch (error) {
      logger.warn('[Unread] Could not delete:', error);
      return false;
    }
  }, [change]);

  const removeAll = useCallback(async () => {
    try {
      await change(() => notificationsAPI.removeAll());
      return true;
    } catch (error) {
      logger.warn('[Unread] Could not clear the inbox:', error);
      return false;
    }
  }, [change]);

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

  // Signed out, the icon shows nobody's count.
  useEffect(() => {
    if (signedIn || session === 0) return;
    Notifications.setBadgeCountAsync(0).catch(() => {});
  }, [signedIn, session]);

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
