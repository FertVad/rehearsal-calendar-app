import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Switch, Modal, FlatList, Alert } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { GlassButton } from '../../../shared/components';
import { TabParamList, AppStackParamList } from '../../../navigation';
import { profileScreenStyles as styles } from '../styles';

type ProfileScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Profile'>,
  NativeStackScreenProps<AppStackParamList>
>;

// Common timezones for theatre/rehearsal apps
const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Asia/Jerusalem', label: 'Тель-Авив (UTC+2)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
];

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout, updateUser } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru');
  };

  const handleTimezoneSelect = async (timezone: string) => {
    try {
      await updateUser({ timezone });
      setTimezoneModalVisible(false);
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось обновить таймзону');
    }
  };

  const getCurrentTimezoneLabel = () => {
    const tz = TIMEZONES.find(t => t.value === user?.timezone);
    return tz?.label || user?.timezone || 'Не выбрана';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.profile.title}</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color={Colors.accent.purple} />
          </View>
          <Text style={styles.userName}>
            {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'User'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
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
              onValueChange={setNotificationsEnabled}
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
                {language === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Timezone */}
          <TouchableOpacity style={styles.settingItem} onPress={() => setTimezoneModalVisible(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="globe" size={20} color={Colors.accent.blue} />
              </View>
              <Text style={styles.settingLabel}>Timezone</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue} numberOfLines={1}>
                {getCurrentTimezoneLabel()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Theme */}
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="moon" size={20} color={Colors.accent.green} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.theme}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{t.profile.themeDark}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Availability */}
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Availability')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="time" size={20} color={Colors.accent.yellow} />
              </View>
              <Text style={styles.settingLabel}>{t.profile.availability}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
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
        </View>

        {/* Logout Button */}
        <GlassButton
          title={t.profile.logout}
          onPress={handleLogout}
          variant="glass"
          style={styles.logoutButton}
        />
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
              <Text style={styles.modalTitle}>Выберите часовой пояс</Text>
              <TouchableOpacity onPress={() => setTimezoneModalVisible(false)}>
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
                    {item.label}
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
    </SafeAreaView>
  );
}
