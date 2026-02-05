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
import { GlassButton, SkeletonLoader, UserAvatar } from '../../../shared/components';
import { ProfileStackParamList } from '../../../navigation';
import { profileScreenStyles as styles } from '../styles';
import { hapticLight, hapticSuccess, hapticMedium } from '../../../shared/utils/haptics';
import { registerForPushNotifications, unregisterPushToken } from '../../../shared/services/notifications';
import { subscriptionsAPI } from '../../../shared/services/api';

type ProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

interface UserSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  display_name_en: string;
  display_name_ru: string;
  status: string;
  current_period_end: string;
  next_billing_date: string | null;
}

// Common timezones for theatre/rehearsal apps
const TIMEZONES = [
  { value: 'Europe/Moscow', labelRu: 'Москва (UTC+3)', labelEn: 'Moscow (UTC+3)' },
  { value: 'Europe/Kaliningrad', labelRu: 'Калининград (UTC+2)', labelEn: 'Kaliningrad (UTC+2)' },
  { value: 'Europe/Samara', labelRu: 'Самара (UTC+4)', labelEn: 'Samara (UTC+4)' },
  { value: 'Asia/Yekaterinburg', labelRu: 'Екатеринбург (UTC+5)', labelEn: 'Yekaterinburg (UTC+5)' },
  { value: 'Asia/Novosibirsk', labelRu: 'Новосибирск (UTC+7)', labelEn: 'Novosibirsk (UTC+7)' },
  { value: 'Asia/Vladivostok', labelRu: 'Владивосток (UTC+10)', labelEn: 'Vladivostok (UTC+10)' },
  { value: 'Europe/Kiev', labelRu: 'Киев (UTC+2)', labelEn: 'Kyiv (UTC+2)' },
  { value: 'Asia/Jerusalem', labelRu: 'Тель-Авив (UTC+2)', labelEn: 'Tel Aviv (UTC+2)' },
  { value: 'Europe/Berlin', labelRu: 'Берлин (UTC+1)', labelEn: 'Berlin (UTC+1)' },
  { value: 'Europe/London', labelRu: 'Лондон (UTC+0)', labelEn: 'London (UTC+0)' },
  { value: 'America/New_York', labelRu: 'Нью-Йорк (UTC-5)', labelEn: 'New York (UTC-5)' },
  { value: 'America/Los_Angeles', labelRu: 'Лос-Анджелес (UTC-8)', labelEn: 'Los Angeles (UTC-8)' },
];

// Week start options
const WEEK_START_OPTIONS = [
  { value: 'monday' as const, labelKey: 'weekStartMonday' as const },
  { value: 'sunday' as const, labelKey: 'weekStartSunday' as const },
];

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout, updateUser, deleteAccount, loading } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);
  const [weekStartModalVisible, setWeekStartModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Load subscription data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadSubscription = async () => {
        try {
          setLoadingSubscription(true);
          const response = await subscriptionsAPI.getCurrentSubscription();
          setSubscription(response.data.subscription);
        } catch (error) {
          // No active subscription or error - this is fine
          setSubscription(null);
        } finally {
          setLoadingSubscription(false);
        }
      };

      loadSubscription();
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

  const toggleLanguage = async () => {
    hapticLight();
    const newLanguage = language === 'ru' ? 'en' : 'ru';
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
    const tz = TIMEZONES.find(t => t.value === user?.timezone);
    if (tz) {
      return language === 'ru' ? tz.labelRu : tz.labelEn;
    }
    return user?.timezone || t.profile.timezoneNotSelected;
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
            {!loadingSubscription && subscription?.status === 'active' && (
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.premiumText}>{t.profile.premium}</Text>
              </View>
            )}
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
          <TouchableOpacity style={styles.settingItem} onPress={toggleLanguage}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="language" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.language}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {language === 'ru' ? 'Русский' : 'English'}
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
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
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
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="sync" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>{t.calendarSync.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>

          {/* Subscription */}
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Subscription')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="card" size={20} color={Colors.accent.purple} />
              </View>
              <Text style={styles.settingLabel}>
                {language === 'ru' ? 'Подписка' : 'Subscription'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
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
              data={TIMEZONES}
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
