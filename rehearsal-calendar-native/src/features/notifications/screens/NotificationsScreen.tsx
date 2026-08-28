import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Colors } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { notificationsAPI } from '../../../shared/services/api';
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
    try {
      const res = await notificationsAPI.markRead();
      await Notifications.setBadgeCountAsync(res.data.unreadCount ?? 0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      logger.warn('[Notifications] Could not mark read:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openTarget = async (item: NotificationItem) => {
    // Opening it is reading it. Without this the count stayed lit after the user
    // had plainly dealt with the thing.
    if (!item.read) {
      try {
        const res = await notificationsAPI.markRead([item.id]);
        await Notifications.setBadgeCountAsync(res.data.unreadCount ?? 0);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      } catch (err) {
        logger.warn('[Notifications] Could not mark read on open:', err);
      }
    }

    const rehearsalId = item.relatedType === 'rehearsal' ? item.relatedId : null;
    const projectId = item.data?.projectId ?? (item.relatedType === 'project' ? item.relatedId : null);

    // popTo, not navigate. This screen is a modal sitting on top of MainTabs, and
    // navigate() put a *second* MainTabs above it — a calendar inside the modal,
    // with its own bell, opening another inbox, forever. popTo returns to the
    // MainTabs already underneath and hands it the params, dismissing this modal
    // on the way. The destinations are the same ones a tap on the push reaches.
    if (rehearsalId && item.type !== 'rehearsal_deleted') {
      navigation.popTo('MainTabs', {
        screen: 'Calendar',
        params: { screen: 'CalendarMain', params: { openRehearsalId: String(rehearsalId) } },
      });
      return;
    }

    if (projectId) {
      navigation.popTo('MainTabs', {
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

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
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
    </TouchableOpacity>
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
