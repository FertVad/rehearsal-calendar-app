import React, { useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Switch, Modal, FlatList, Alert } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import type { Language } from '../../../i18n/translations';
import { GlassButton, SkeletonLoader, UserAvatar } from '../../../shared/components';
import { ProfileStackParamList } from '../../../navigation';
import { profileScreenStyles as styles } from '../styles';
import { hapticLight, hapticSuccess, hapticMedium } from '../../../shared/utils/haptics';
import { registerForPushNotifications, unregisterPushToken } from '../../../shared/services/notifications';
import { notificationsAPI } from '../../../shared/services/api';

type ProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

import { getTimezonesWithDevice, getTimezoneLabel } from '../../../shared/constants/timezones';

// Week start options
const WEEK_START_OPTIONS = [
  { value: 'monday' as const, labelKey: 'weekStartMonday' as const },
  { value: 'sunday' as const, labelKey: 'weekStartSunday' as const },
];

// Language options — labels are shown in their own language so users
// can recognize their language without already speaking the current one.
const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
];

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout, updateUser, deleteAccount, loading } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);
  const [weekStartModalVisible, setWeekStartModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Refreshed on every visit rather than once: a push can land while this screen
  // sits in the background, and the count beside the row has to agree with the
  // badge on the app icon.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      notificationsAPI
        .unreadCount()
        .then((res) => {
          if (alive) setUnreadCount(res.data.unreadCount ?? 0);
        })
        .catch(() => {
          // A count is not worth an error message.
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  const handleLogout = async () => {
    hapticMedium();
    await logout();
  };

  const handleNotificationsToggle = async (value: boolean) => {
    hapticLight();
    setNotificationsEnabled(value);

    try {
      // Update database
      await updateUser({ notificationsEnabled: value });

      // Register or unregister push token
      if (value) {
        await registerForPushNotifications();
      } else {
        await unregisterPushToken();
      }

      hapticSuccess();
    } catch (err: any) {
      Alert.alert(t.profile.errorTitle, err.message || t.profile.notificationError);
      // Revert state on error
      setNotificationsEnabled(!value);
    }
  };

  const handleLanguageSelect = async (newLanguage: Language) => {
    hapticLight();
    setLanguageModalVisible(false);
    if (newLanguage === language) return;
    try {
      // Save to local state and AsyncStorage
      await setLanguage(newLanguage);
      // Save to database
      await updateUser({ locale: newLanguage });
      hapticSuccess();
    } catch (err: any) {
      Alert.alert(t.profile.errorTitle, err.message || t.profile.languageError);
    }
  };

  const getCurrentLanguageLabel = () =>
    LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.label ?? language;

  const handleTimezoneSelect = async (timezone: string) => {
    hapticLight();
    try {
      await updateUser({ timezone });
      setTimezoneModalVisible(false);
      hapticSuccess();
    } catch (err: any) {
      Alert.alert(t.profile.errorTitle, err.message || t.profile.timezoneError);
    }
  };

  const getCurrentTimezoneLabel = () => {
    if (!user?.timezone) return t.profile.timezoneNotSelected;
    return getTimezoneLabel(user.timezone, language);
  };

  const handleWeekStartSelect = async (weekStart: 'monday' | 'sunday') => {
    hapticLight();
    try {
      await updateUser({ weekStartDay: weekStart });
      setWeekStartModalVisible(false);
      hapticSuccess();
    } catch (err: any) {
      Alert.alert(t.profile.errorTitle, err.message || t.profile.weekStartError);
    }
  };

  const getCurrentWeekStartLabel = () => {
    const weekStart = user?.weekStartDay || 'monday';
    return weekStart === 'monday' ? t.profile.weekStartMonday : t.profile.weekStartSunday;
  };

  const handleDeleteAccount = async () => {
    try {
      hapticMedium();
      setDeletingAccount(true);
      const { deletedProjects } = await deleteAccount();
      hapticSuccess();
      Alert.alert(
        t.profile.deleteAccountSuccess,
        deletedProjects > 0 ? t.profile.deleteAccountProjectsWarning(deletedProjects) : undefined
      );
    } catch (err: any) {
      Alert.alert(t.profile.deleteAccountError, err.message);
    } finally {
      setDeletingAccount(false);
      setDeleteAccountModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.profile.title}</Text>
        </View>

        {loading ? (
          <>
            {/* User Info Card Skeleton */}
            <View style={styles.userCard}>
              <View style={styles.avatarContainer}>
                <SkeletonLoader variant="circular" height={64} />
              </View>
              <SkeletonLoader width="40%" height={24} style={{ marginTop: 12, marginBottom: 8 }} />
              <SkeletonLoader width="60%" height={16} />
            </View>

            {/* Settings Section Skeleton */}
            <View style={styles.section}>
              <SkeletonLoader width="30%" height={20} style={{ marginBottom: 16 }} />
              {[1, 2, 3, 4, 5].map((key) => (
                <View key={key} style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <SkeletonLoader variant="circular" height={40} />
                    <SkeletonLoader width={120} height={16} style={{ marginLeft: 12 }} />
                  </View>
                  <SkeletonLoader width={80} height={16} />
                </View>
              ))}
            </View>

            {/* About Section Skeleton */}
            <View style={styles.section}>
              <SkeletonLoader width="25%" height={20} style={{ marginBottom: 16 }} />
              {[1, 2].map((key) => (
                <View key={key} style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <SkeletonLoader variant="circular" height={40} />
                    <SkeletonLoader width={100} height={16} style={{ marginLeft: 12 }} />
                  </View>
                  <SkeletonLoader width={60} height={16} />
                </View>
              ))}
            </View>

            {/* Logout Button Skeleton */}
            <SkeletonLoader width="100%" height={48} borderRadius={24} style={{ marginTop: 24 }} />
          </>
        ) : (
          <>
            {/* User Info Card */}
            <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <UserAvatar
              firstName={user?.firstName || 'U'}
              lastName={user?.lastName}
              size={80}
            />
          </View>
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>
              {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'User'}
            </Text>
          </View>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => {
              hapticLight();
              navigation.navigate('EditProfile');
            }}
          >
            <Ionicons name="create-outline" size={16} color={Colors.accent.purple} />
            <Text style={styles.editProfileText}>{t.profile.editProfile}</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.settings}</Text>

          {/* Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="notifications" size={20} color={Colors.accent.blue} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.notifications}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.purple }}
              thumbColor={Colors.text.inverse}
            />
          </View>

          {/* Language */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => { hapticLight(); setLanguageModalVisible(true); }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
                <Ionicons name="language" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.language}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {getCurrentLanguageLabel()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Timezone */}
          <TouchableOpacity style={styles.settingItem} onPress={() => { hapticLight(); setTimezoneModalVisible(true); }}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="globe" size={20} color={Colors.accent.blue} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.timezone}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue} numberOfLines={1}>
                {getCurrentTimezoneLabel()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Week Start */}
          <TouchableOpacity style={styles.settingItem} onPress={() => { hapticLight(); setWeekStartModalVisible(true); }}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
                <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.weekStart}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {getCurrentWeekStartLabel()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Calendar Sync */}
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('CalendarSyncSettings')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
                <Ionicons name="sync" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.calendarSync.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>

          {/* Notifications — the only place a push can be read after the fact.
              The count is what the app badge shows, so the two agree. */}
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Notifications')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
                <Ionicons name="notifications" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.notifications.title}</Text>
            </View>
            <View style={styles.settingRight}>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.about}</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.version}</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="help-circle" size={20} color={Colors.accent.red} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.help}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              hapticLight();
              setDeleteAccountModalVisible(true);
            }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="trash" size={20} color={Colors.accent.red} />
              </View>
              <Text style={[styles.settingLabel, { color: Colors.accent.red }]}>{t.profile.deleteAccount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.accent.red} />
          </TouchableOpacity>
        </View>

            {/* Logout Button */}
            <GlassButton
              title={t.profile.logout}
              onPress={handleLogout}
              variant="glass"
              style={styles.logoutButton}
            />
          </>
        )}
      </ScrollView>

      {/* Timezone Selection Modal */}
      <Modal
        visible={timezoneModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimezoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.profile.timezoneModalTitle}</Text>
              <TouchableOpacity onPress={() => { hapticLight(); setTimezoneModalVisible(false); }}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getTimezonesWithDevice()}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.timezoneItem,
                    user?.timezone === item.value && styles.timezoneItemSelected,
                  ]}
                  onPress={() => handleTimezoneSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.timezoneLabel,
                      user?.timezone === item.value && styles.timezoneLabelSelected,
                    ]}
                  >
                    {language === 'ru' ? item.labelRu : item.labelEn}
                  </Text>
                  {user?.timezone === item.value && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.timezoneList}
            />
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.profile.language}</Text>
              <TouchableOpacity onPress={() => { hapticLight(); setLanguageModalVisible(false); }}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekStartOptions}>
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = language === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.timezoneItem,
                      isSelected && styles.timezoneItemSelected,
                    ]}
                    onPress={() => handleLanguageSelect(option.value)}
                  >
                    <Text
                      style={[
                        styles.timezoneLabel,
                        isSelected && styles.timezoneLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Week Start Selection Modal */}
      <Modal
        visible={weekStartModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeekStartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.profile.weekStart}</Text>
              <TouchableOpacity onPress={() => { hapticLight(); setWeekStartModalVisible(false); }}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekStartOptions}>
              {WEEK_START_OPTIONS.map((option) => {
                const isSelected = (user?.weekStartDay || 'monday') === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.timezoneItem,
                      isSelected && styles.timezoneItemSelected,
                    ]}
                    onPress={() => handleWeekStartSelect(option.value)}
                  >
                    <Text
                      style={[
                        styles.timezoneLabel,
                        isSelected && styles.timezoneLabelSelected,
                      ]}
                    >
                      {t.profile[option.labelKey]}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: undefined }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.profile.deleteAccountConfirm}</Text>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setDeleteAccountModalVisible(false);
                }}
                disabled={deletingAccount}
              >
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <View style={{ marginBottom: 20 }}>
                <Ionicons
                  name="warning"
                  size={48}
                  color={Colors.accent.red}
                  style={{ alignSelf: 'center', marginBottom: 16 }}
                />
                <Text style={[styles.timezoneLabel, { textAlign: 'center', marginBottom: 12 }]}>
                  {t.profile.deleteAccountWarning}
                </Text>
                <Text style={[styles.settingValue, { textAlign: 'center', color: Colors.text.secondary }]}>
                  {t.profile.deleteAccountFinalWarning}
                </Text>
              </View>
              <View style={{ gap: 12 }}>
                <GlassButton
                  title={deletingAccount ? t.common.loading : t.profile.confirmDelete}
                  onPress={handleDeleteAccount}
                  variant="glass"
                  disabled={deletingAccount}
                  style={{ borderColor: Colors.accent.red }}
                  textStyle={{ color: Colors.accent.red }}
                />
                <GlassButton
                  title={t.profile.cancel}
                  onPress={() => {
                    hapticLight();
                    setDeleteAccountModalVisible(false);
                  }}
                  variant="glass"
                  disabled={deletingAccount}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
