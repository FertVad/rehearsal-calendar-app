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
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../shared/constants/colors';
import { IconButton } from '../../../shared/components/IconButton';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { useI18n } from '../../../contexts/I18nContext';
import { notificationsAPI } from '../../../shared/services/api';
import { useUnread, type ChangeAnswer } from '../../../contexts/UnreadContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { logger } from '../../../shared/utils/logger';
import { useRequestOrder } from '../../../shared/hooks/useSession';
import { openCalendar, openProject, projectSectionOf } from '../../../shared/hooks/useNotifications';
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
  // when the server had not been reached at all. The error itself, not a flag:
  // no connection and the server down are said apart (T-228).
  const [loadError, setLoadError] = useState<unknown>(null);
  const loadErrorText = loadError ? requestErrorMessage(t, loadError, t.notifications.loadError) : null;

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
        setLoadError(null);
      } else landed = false;
    } catch (err) {
      logger.warn('[Notifications] Could not load:', err);
      if (answer()) setLoadError(err ?? new Error('load failed'));
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
        setLoadError(null);
      }
    } catch (err) {
      logger.warn('[Notifications] Could not load more:', err);
      if (answer()) setLoadError(err ?? new Error('load failed'));
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
  const markShown = useCallback(async (ids: number[], send: () => Promise<ChangeAnswer>) => {
    for (const id of ids) {
      const mark = marks.current.get(id) ?? { out: 0, landed: false };
      mark.out += 1;
      marks.current.set(id, mark);
    }
    const covered = new Set(ids);
    setItems((prev) => prev.map((n) => (covered.has(n.id) ? { ...n, read: true } : n)));

    const answer = await change(send);
    const ok = answer === true;
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
    return answer;
  }, [change, setItems]);

  // The whole inbox, by name — the pages not loaded too. The badge follows the
  // count the server reports back. It covers the cards shown unread and those
  // whose own read is still on its way.
  const markEverythingRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read || marks.current.has(n.id)).map((n) => n.id);
    const answer = await markShown(ids, () => markAllRead());
    if (answer !== true) {
      Alert.alert(t.common.error, requestErrorMessage(t, answer?.failed, t.notifications.markReadError));
    }
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

    // Taken off a rehearsal: to the calendar it has left, not the rehearsal,
    // which they can no longer see (T-233).
    if (item.type === 'rehearsal_removed') {
      openCalendar(navigation);
      return;
    }

    const rehearsalId = item.relatedType === 'rehearsal' ? item.relatedId : null;
    const projectId = item.data?.projectId ?? (item.relatedType === 'project' ? item.relatedId : null);

    // The details are a route now, so this is an ordinary navigation: the sheet
    // opens over the inbox and closing it comes straight back here.
    if (rehearsalId && item.type !== 'rehearsal_deleted') {
      navigation.navigate('RehearsalDetails', { rehearsalId: String(rehearsalId) });
      return;
    }

    // The project is in the tabs under the inbox: back to them, not a copy
    // pushed on top, and over the projects list (T-007) — opened as a tapped
    // push opens it, "New member" on its members (T-023).
    if (projectId) openProject(navigation, projectId, projectSectionOf(item.type));
  };

  // What a change that failed is called: its own error, in the app's language.
  const failedText = (answer: Exclude<ChangeAnswer, true>, fallback: string) =>
    requestErrorMessage(t, answer?.failed, fallback);

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

    const answer = await change(() => remove(item.id));
    if (answer === true) return;

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

    Alert.alert(t.common.error, failedText(answer, t.notifications.deleteError));
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

          const answer = await change(() => removeAll());
          if (answer !== true) {
            setInbox(before);
            Alert.alert(t.common.error, failedText(answer, t.notifications.deleteError));
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
      {/* A sheet over the app: "Close" where every sheet has its way out —
          there is nothing here to cancel (T-029). */}
      <ScreenHeader
        kind="modal"
        title={t.notifications.title}
        cancelLabel={t.common.close}
        onCancel={() => navigation.goBack()}
        right={
          <>
            {/* Icons rather than words. Two text buttons beside the title do
                not fit in Russian and fit still less in German, so they
                overlapped. The words survive as accessibility labels and in
                the confirmation. 24 pt; the target stays 44. */}
            {hasUnread && (
              <IconButton
                icon="checkmark-done"
                size={24}
                color={Colors.accent.purple}
                onPress={markEverythingRead}
                accessibilityLabel={t.notifications.markAllRead}
              />
            )}
            {items.length > 0 && (
              <IconButton
                icon="trash-outline"
                size={24}
                color={Colors.accent.red}
                onPress={confirmClearAll}
                accessibilityLabel={t.notifications.clearAll}
              />
            )}
          </>
        }
      />

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
                {loadErrorText}
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
                <Text style={styles.emptyTitle}>{loadErrorText}</Text>
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
