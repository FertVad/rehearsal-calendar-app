import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
// Rows live inside a Swipeable, and React Native's own touchables take no part
// in gesture-handler's arbitration: swiping a row and letting it slide back
// registered as a tap as well, so cancelling a swipe opened the notification.
// This one loses to the pan, which is the whole point.
import { TouchableOpacity as GestureTouchable } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { notificationsAPI } from '../../../shared/services/api';
import { useUnread } from '../../../contexts/UnreadContext';
import { logger } from '../../../shared/utils/logger';
import { useRequestOrder } from '../../../shared/hooks/useSession';
import { currentSession, isCurrentSession } from '../../../shared/services/session';
import { styles } from '../styles/notificationsScreenStyles';
import {
  emptyInbox,
  pageOf,
  withFirstPage,
  withNextPage,
  type Inbox,
  type NotificationItem,
} from '../inboxPages';
import type { AppNavigation } from '../../../navigation';

/** Matches the notification type to the icon the rest of the app uses for it. */
function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type.startsWith('rehearsal_reminder')) return 'alarm-outline';
  if (type.startsWith('rehearsal')) return 'calendar-outline';
  if (type === 'member_response') return 'eye-outline';
  if (type === 'project_invite') return 'person-add-outline';
  if (type === 'role_changed') return 'shield-checkmark-outline';
  if (type === 'member_removed' || type === 'project_deleted') return 'close-circle-outline';
  return 'notifications-outline';
}

export default function NotificationsScreen() {
  const navigation = useNavigation<AppNavigation<'Notifications'>>();
  const { t } = useI18n();
  const { unreadCount, markRead, markAllRead, remove, removeAll } = useUnread();

  const [inbox, setInbox] = useState<Inbox>(emptyInbox);
  const items = inbox.items;
  const setItems = useCallback(
    (next: (prev: NotificationItem[]) => NotificationItem[]) =>
      setInbox((prev) => ({ ...prev, items: next(prev.items) })),
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  // The last read of the list failed (NI05). An empty list said "Nothing yet"
  // when the server had not been reached at all.
  const [loadError, setLoadError] = useState(false);

  // A list read while a change was on its way may still hold the deleted card,
  // or the read one as unread: reads and changes on this screen go in one order
  // (useRequestOrder), and such a read's answer is dropped (NI04, review). Only
  // `change` sends one.
  //
  // A dropped read is read again once no change is on its way. Dropped and no
  // more, the first load of a screen where "Mark all read" was pressed in time
  // left it saying "Nothing yet" over an inbox that had cards (review).
  const order = useRequestOrder();
  const changesOut = useRef(0);
  const readLater = useRef(false);
  const loadRef = useRef<() => void>(() => {});
  const readAgain = useCallback(() => {
    if (changesOut.current > 0) readLater.current = true;
    else loadRef.current();
  }, []);
  const change = useCallback(
    async <T,>(send: () => Promise<T>): Promise<T> => {
      changesOut.current += 1;
      try {
        return await order.write(() => send());
      } finally {
        changesOut.current -= 1;
        if (changesOut.current === 0 && readLater.current) {
          readLater.current = false;
          loadRef.current();
        }
      }
    },
    [order]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const asked = currentSession();
    const answer = order.beginRead();
    let landed = true;
    try {
      const res = await notificationsAPI.list();
      if (answer()) {
        setInbox((prev) => withFirstPage(prev, pageOf(res.data)));
        setLoadError(false);
      } else landed = false;
    } catch (err) {
      logger.warn('[Notifications] Could not load:', err);
      if (answer()) setLoadError(true);
      else landed = false;
    } finally {
      // The spinner stays while the read is still to be made again.
      if (landed) setLoading(false);
      setRefreshing(false);
    }
    if (!landed && isCurrentSession(asked)) readAgain();
  }, [order, readAgain]);
  loadRef.current = () => { load(); };

  // The page after the last one read: on reaching the end of the list, or on
  // the button under it (NI01).
  const loadMore = useCallback(async () => {
    const cursor = inbox.nextCursor;
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const answer = order.beginRead();
    try {
      const res = await notificationsAPI.list(cursor);
      if (answer()) {
        setInbox((prev) => withNextPage(prev, pageOf(res.data), cursor));
        setLoadError(false);
      }
    } catch (err) {
      logger.warn('[Notifications] Could not load more:', err);
      if (answer()) setLoadError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [inbox.nextCursor, order]);

  // A "read" shows at once and is taken back if the server did not take it
  // (NI02): the cards used to stay read on screen while the server, and the
  // count, still had them unread.
  //
  // Taken back only if nothing else read the card meanwhile: each card keeps
  // the reads on their way that cover it, and whether one of them landed. A
  // card opened on a slow connection and then "Mark all read" that went
  // through: the first read failing late put the card back unread, though the
  // server had it read (review).
  const marks = useRef(new Map<number, { out: number; landed: boolean }>());
  const markShown = useCallback(async (ids: number[], send: () => Promise<boolean>) => {
    for (const id of ids) {
      const mark = marks.current.get(id) ?? { out: 0, landed: false };
      mark.out += 1;
      marks.current.set(id, mark);
    }
    const covered = new Set(ids);
    setItems((prev) => prev.map((n) => (covered.has(n.id) ? { ...n, read: true } : n)));

    const ok = await change(send);
    const back = new Set<number>();
    for (const id of ids) {
      const mark = marks.current.get(id);
      if (!mark) continue;
      mark.out -= 1;
      if (ok) mark.landed = true;
      if (mark.out > 0) continue;
      marks.current.delete(id);
      if (!mark.landed) back.add(id);
    }
    if (back.size > 0) {
      setItems((prev) => prev.map((n) => (back.has(n.id) ? { ...n, read: false } : n)));
    }
    return ok;
  }, [change, setItems]);

  // The whole inbox, by name — the pages not loaded too. The badge follows the
  // count the server reports back. It covers the cards shown unread and those
  // whose own read is still on its way.
  const markEverythingRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read || marks.current.has(n.id)).map((n) => n.id);
    const ok = await markShown(ids, () => markAllRead());
    if (!ok) Alert.alert(t.common.error, t.notifications.markReadError);
  }, [items, markAllRead, markShown, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openTarget = async (item: NotificationItem) => {
    // Opening it is reading it. Without this the count stayed lit after the user
    // had plainly dealt with the thing. It opens at once; if the server did not
    // take the "read", the card is unread again when the reader comes back.
    if (!item.read) markShown([item.id], () => markRead([item.id]));

    const rehearsalId = item.relatedType === 'rehearsal' ? item.relatedId : null;
    const projectId = item.data?.projectId ?? (item.relatedType === 'project' ? item.relatedId : null);

    // The details are a route now, so this is an ordinary navigation: the sheet
    // opens over the inbox and closing it comes straight back here.
    if (rehearsalId && item.type !== 'rehearsal_deleted') {
      navigation.navigate('RehearsalDetails', { rehearsalId: String(rehearsalId) });
      return;
    }

    if (projectId) {
      navigation.goBack();
      navigation.navigate('MainTabs', {
        screen: 'Projects',
        params: { screen: 'ProjectDetail', params: { projectId: String(projectId) } },
      });
    }
  };

  const ageOf = (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return t.notifications.justNow;
    if (minutes < 60) return t.notifications.minutesAgo(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t.notifications.hoursAgo(hours);
    return t.notifications.daysAgo(Math.floor(hours / 24));
  };

  // The count is the whole inbox's; the cards are only the pages read so far
  // (NI01). Older ones unread under fifty read ones hid the button.
  const hasUnread = unreadCount > 0 || items.some((n) => !n.read);

  const deleteOne = async (item: NotificationItem) => {
    // Gone from the list first: the row has already slid away under the
    // reader's thumb, and putting it back on success would be a stutter.
    const wasAt = items.findIndex((n) => n.id === item.id);
    setItems((prev) => prev.filter((n) => n.id !== item.id));

    const ok = await change(() => remove(item.id));
    if (ok) return;

    // Put it back where it was, from memory. Asking the server for the list
    // instead was wrong in the one case this matters: with no connection that
    // request fails too, so the row stayed gone and came back only once the
    // network did — the app claiming a deletion it had not managed.
    setItems((prev) => {
      if (prev.some((n) => n.id === item.id)) return prev;
      const restored = [...prev];
      restored.splice(wasAt < 0 ? 0 : Math.min(wasAt, restored.length), 0, item);
      return restored;
    });

    Alert.alert(t.common.error, t.notifications.deleteError);
  };

  const confirmClearAll = () => {
    Alert.alert(t.notifications.clearAllConfirm, t.notifications.clearAllConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.notifications.clearAll,
        style: 'destructive',
        onPress: async () => {
          // Same care as a single row: emptied on screen at once, and put back
          // in full if the server never heard about it.
          const before = inbox;
          setInbox(emptyInbox);

          const ok = await change(() => removeAll());
          if (!ok) {
            setInbox(before);
            Alert.alert(t.common.error, t.notifications.deleteError);
          }
        },
      },
    ]);
  };

  const renderDeleteAction = (item: NotificationItem) => (
    <GestureTouchable
      style={styles.deleteAction}
      onPress={() => deleteOne(item)}
      accessibilityLabel={t.notifications.delete}
    >
      <Ionicons name="trash-outline" size={22} color={Colors.text.inverse} />
      <Text style={styles.deleteActionText}>{t.notifications.delete}</Text>
    </GestureTouchable>
  );

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <Swipeable
      renderRightActions={() => renderDeleteAction(item)}
      overshootRight={false}
      friction={2}
    >
    <GestureTouchable
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => openTarget(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={iconFor(item.type)}
          size={20}
          color={item.read ? Colors.text.secondary : Colors.accent.purple}
        />
      </View>

      <View style={styles.body}>
        <Text style={[styles.cardTitle, item.read && styles.cardTitleRead]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.cardBody} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={styles.cardTime}>{ageOf(item.createdAt)}</Text>
      </View>

      {!item.read && <View style={styles.unreadDot} />}
    </GestureTouchable>
    </Swipeable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t.common.back} style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{t.notifications.title}</Text>

        {/* Icons rather than words. Two text buttons beside a large title do not
            fit in Russian and fit still less in German, so they overlapped. The
            words survive as accessibility labels and in the confirmation. */}
        {hasUnread && (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={markEverythingRead}
            accessibilityLabel={t.notifications.markAllRead}
          >
            <Ionicons name="checkmark-done" size={22} color={Colors.accent.purple} />
          </TouchableOpacity>
        )}
        {items.length > 0 && (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={confirmClearAll}
            accessibilityLabel={t.notifications.clearAll}
          >
            <Ionicons name="trash-outline" size={22} color={Colors.accent.red} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.accent.purple} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.accent.purple}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          // A refresh that failed leaves the cards it had, and says so.
          ListHeaderComponent={
            loadError && items.length > 0 ? (
              <Text testID="inbox-load-error" style={styles.loadErrorBanner}>
                {t.notifications.loadError}
              </Text>
            ) : null
          }
          // Reaching the end loads the next page by itself; the button is for
          // when it did not — it failed, or a change on its way set it aside.
          ListFooterComponent={
            inbox.nextCursor ? (
              loadingMore ? (
                <ActivityIndicator style={styles.more} color={Colors.accent.purple} />
              ) : (
                <TouchableOpacity testID="inbox-more" style={styles.more} onPress={loadMore}>
                  <Text style={styles.moreText}>{t.notifications.showOlder}</Text>
                </TouchableOpacity>
              )
            ) : null
          }
          ListEmptyComponent={
            loadError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>{t.notifications.loadError}</Text>
                <TouchableOpacity testID="inbox-retry" style={styles.more} onPress={() => load()}>
                  <Text style={styles.moreText}>{t.common.retry}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>{t.notifications.empty}</Text>
                <Text style={styles.emptyHint}>{t.notifications.emptyHint}</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
