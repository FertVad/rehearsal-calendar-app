import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Modal, FlatList, Alert } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import GlassButton from '../../../shared/components/GlassButton';
import AvailabilityEditor from '../../availability/components/AvailabilityEditor';
import { TabParamList } from '../../../navigation';

type ProfileScreenProps = BottomTabScreenProps<TabParamList, 'Profile'>;

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [availabilityVisible, setAvailabilityVisible] = useState(false);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ru' ? 'en' : 'ru');
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
          <Text style={styles.title}>Профиль</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color={Colors.accent.purple} />
          </View>
          <Text style={styles.userName}>{user?.name || 'Пользователь'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Настройки</Text>

          {/* Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="notifications" size={20} color={Colors.accent.blue} />
              </View>
              <Text style={styles.settingLabel}>Уведомления</Text>
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
              <Text style={styles.settingLabel}>Язык</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {language === 'ru' ? 'Русский' : 'English'}
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
              <Text style={styles.settingLabel}>Часовой пояс</Text>
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
              <Text style={styles.settingLabel}>Тема</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>Тёмная</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Availability */}
          <TouchableOpacity style={styles.settingItem} onPress={() => setAvailabilityVisible(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="time" size={20} color={Colors.accent.yellow} />
              </View>
              <Text style={styles.settingLabel}>Моя доступность</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>О приложении</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
              </View>
              <Text style={styles.settingLabel}>Версия</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="help-circle" size={20} color={Colors.accent.red} />
              </View>
              <Text style={styles.settingLabel}>Помощь</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <GlassButton
          title="Выйти из аккаунта"
          onPress={handleLogout}
          variant="glass"
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Availability Editor Modal */}
      <AvailabilityEditor
        visible={availabilityVisible}
        onClose={() => setAvailabilityVisible(false)}
        onSave={(data) => {
          console.log('Availability saved:', data);
          // TODO: Save to server
        }}
      />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl * 2,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  userCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  timezoneList: {
    paddingBottom: Spacing.xxl,
  },
  timezoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  timezoneItemSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  timezoneLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  timezoneLabelSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
});
