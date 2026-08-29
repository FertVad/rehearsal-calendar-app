import React, { useCallback, useState } from 'react';
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
import { styles } from '../styles/notificationsScreenStyles';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  data: { rehearsalId?: number | string; projectId?: number | string };
  relatedType: 'rehearsal' | 'project' | null;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
}

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
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const { markRead, remove, removeAll } = useUnread();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await notificationsAPI.list();
      setItems(res.data.notifications || []);
    } catch (err) {
      logger.warn('[Notifications] Could not load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reading the inbox is what marks it read — this screen is the only place the
  // notifications can be read at all, so arriving here is the acknowledgement.
  // The badge follows the count the server reports back.
  const markEverythingRead = useCallback(async () => {
    await markRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [markRead]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openTarget = async (item: NotificationItem) => {
    // Opening it is reading it. Without this the count stayed lit after the user
    // had plainly dealt with the thing.
    if (!item.read) {
      await markRead([item.id]);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }

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

  const hasUnread = items.some((n) => !n.read);

  const deleteOne = async (item: NotificationItem) => {
    // Gone from the list first: the row has already slid away under the
    // reader's thumb, and putting it back on success would be a stutter.
    const wasAt = items.findIndex((n) => n.id === item.id);
    setItems((prev) => prev.filter((n) => n.id !== item.id));

    const ok = await remove(item.id);
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
          const before = items;
          setItems([]);

          const ok = await removeAll();
          if (!ok) {
            setItems(before);
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.notifications.title}</Text>
        {hasUnread && (
          <TouchableOpacity style={styles.markAllButton} onPress={markEverythingRead}>
            <Text style={styles.markAllText}>{t.notifications.markAllRead}</Text>
          </TouchableOpacity>
        )}
        {items.length > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={confirmClearAll}>
            <Text style={styles.clearAllText}>{t.notifications.clearAll}</Text>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>{t.notifications.empty}</Text>
              <Text style={styles.emptyHint}>{t.notifications.emptyHint}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
