import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import { GlassButton } from '../../../shared/components';
import { calendarSyncSettingsScreenStyles as styles } from '../styles';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { DeviceCalendar, RehearsalWithProject } from '../../../shared/types/calendar';
import { rehearsalsAPI } from '../../../shared/services/api';

type CalendarSyncSettingsScreenProps = NativeStackScreenProps<any, 'CalendarSyncSettings'>;

export default function CalendarSyncSettingsScreen({ navigation }: CalendarSyncSettingsScreenProps) {
  const { t } = useI18n();
  const { projects } = useProjects();
  const {
    hasPermission,
    calendars,
    settings,
    syncStatus,
    syncError,
    syncedCount,
    isSyncing,
    lastSyncTime,
    requestPermissions,
    updateSettings,
    syncAll,
    removeAll,
    refresh,
  } = useCalendarSync();

  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(settings?.exportEnabled || false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    settings?.exportCalendarId || null
  );

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      setExportEnabled(settings.exportEnabled);
      setSelectedCalendarId(settings.exportCalendarId);
    }
  }, [settings]);

  // Request permissions on mount if not granted
  useEffect(() => {
    if (hasPermission === false) {
      // Don't auto-request, let user click the button
    }
  }, [hasPermission]);

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
    }
  };

  const handleToggleExport = async (enabled: boolean) => {
    setExportEnabled(enabled);

    // If enabling and no calendar selected, show picker
    if (enabled && !selectedCalendarId) {
      if (calendars.length > 0) {
        setCalendarPickerVisible(true);
      } else {
        Alert.alert(t.calendarSync.noCalendars, t.calendarSync.noCalendarsMessage);
        setExportEnabled(false);
        return;
      }
    }

    // Update settings
    await updateSettings({
      exportEnabled: enabled,
      exportCalendarId: selectedCalendarId,
      lastExportTime: settings?.lastExportTime || null,
    });
  };

  const handleSelectCalendar = async (calendar: DeviceCalendar) => {
    setSelectedCalendarId(calendar.id);
    setCalendarPickerVisible(false);

    // Update settings with new calendar
    await updateSettings({
      exportEnabled,
      exportCalendarId: calendar.id,
      lastExportTime: settings?.lastExportTime || null,
    });
  };

  const handleSyncAll = async () => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (!selectedCalendarId) {
      Alert.alert(t.calendarSync.noCalendarSelected, t.calendarSync.selectCalendarFirst);
      return;
    }

    try {
      // Fetch all rehearsals from all projects
      const allRehearsals: RehearsalWithProject[] = [];

      for (const project of projects) {
        try {
          const response = await rehearsalsAPI.getAll(project.id);
          const projectRehearsals = response.data.map((r: any) => ({
            id: r.id,
            projectId: project.id,
            projectName: project.name,
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            location: r.location,
            title: r.title,
            description: r.description,
          }));
          allRehearsals.push(...projectRehearsals);
        } catch (err) {
          console.error(`Failed to fetch rehearsals for project ${project.id}:`, err);
        }
      }

      // Sync all rehearsals
      await syncAll(allRehearsals);
      Alert.alert(t.calendarSync.exportSuccess, t.calendarSync.exportAllSuccess);
    } catch (error: any) {
      Alert.alert(t.calendarSync.exportError, error.message || t.calendarSync.exportErrorMessage);
    }
  };

  const handleRemoveAll = () => {
    Alert.alert(
      t.calendarSync.removeAll,
      t.calendarSync.removeAllConfirm,
      [
        { text: t.common?.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.calendarSync.removeAll,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAll();
              Alert.alert(t.calendarSync.removeSuccess, t.calendarSync.removeAllSuccess);
            } catch (error: any) {
              Alert.alert(t.calendarSync.exportError, error.message || 'Failed to remove events');
            }
          },
        },
      ]
    );
  };

  const getSelectedCalendarName = (): string => {
    if (!selectedCalendarId) return t.calendarSync.selectCalendar;
    const calendar = calendars.find((c) => c.id === selectedCalendarId);
    return calendar?.title || t.calendarSync.selectCalendar;
  };

  const formatLastSyncTime = (): string => {
    if (!lastSyncTime) return t.calendarSync.neverSynced;
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.calendarSync.title}</Text>
        </View>

        {/* Permission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.calendarSync.permissions}</Text>

          {hasPermission === null ? (
            <View style={styles.permissionCard}>
              <ActivityIndicator size="small" color={Colors.accent.purple} />
              <Text style={styles.permissionStatus}>{t.calendarSync.checkingPermissions}</Text>
            </View>
          ) : hasPermission ? (
            <View style={[styles.permissionCard, styles.permissionGranted]}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
              <Text style={[styles.permissionStatus, { color: Colors.accent.green }]}>
                {t.calendarSync.permissionGranted}
              </Text>
            </View>
          ) : (
            <View style={styles.permissionCard}>
              <Ionicons name="alert-circle" size={24} color={Colors.accent.yellow} />
              <Text style={styles.permissionStatus}>{t.calendarSync.permissionRequired}</Text>
              <GlassButton
                title={t.calendarSync.grantPermission}
                onPress={handleRequestPermissions}
                variant="glass"
                style={styles.permissionButton}
              />
            </View>
          )}
        </View>

        {/* Export Settings */}
        {hasPermission && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.calendarSync.exportSettings}</Text>

              {/* Enable Export Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                    <Ionicons name="calendar" size={20} color={Colors.accent.purple} />
                  </View>
                  <Text style={styles.settingLabel}>{t.calendarSync.exportEnabled}</Text>
                </View>
                <Switch
                  value={exportEnabled}
                  onValueChange={handleToggleExport}
                  trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.purple }}
                  thumbColor={Colors.text.inverse}
                  disabled={isSyncing}
                />
              </View>

              {/* Calendar Selector */}
              {exportEnabled && (
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => setCalendarPickerVisible(true)}
                  disabled={isSyncing}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                      <Ionicons name="list" size={20} color={Colors.accent.blue} />
                    </View>
                    <Text style={styles.settingLabel}>{t.calendarSync.targetCalendar}</Text>
                  </View>
                  <View style={styles.settingRight}>
                    <Text style={styles.settingValue} numberOfLines={1}>
                      {getSelectedCalendarName()}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Actions */}
            {exportEnabled && selectedCalendarId && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.calendarSync.actions}</Text>

                {/* Export All Button */}
                <GlassButton
                  title={t.calendarSync.exportAll}
                  onPress={handleSyncAll}
                  variant="purple"
                  disabled={isSyncing}
                  loading={isSyncing}
                  style={styles.actionButton}
                />

                {/* Remove All Button */}
                {syncedCount > 0 && (
                  <GlassButton
                    title={t.calendarSync.removeAll}
                    onPress={handleRemoveAll}
                    variant="glass"
                    disabled={isSyncing}
                    style={styles.actionButton}
                  />
                )}
              </View>
            )}

            {/* Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.calendarSync.status}</Text>

              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{t.calendarSync.syncedCount}</Text>
                  <Text style={styles.statusValue}>{syncedCount}</Text>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{t.calendarSync.lastSync}</Text>
                  <Text style={styles.statusValue}>{formatLastSyncTime()}</Text>
                </View>

                {syncError && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="warning" size={16} color={Colors.accent.red} />
                    <Text style={styles.errorText}>{syncError}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Calendar Picker Modal */}
      <Modal
        visible={calendarPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.calendarSync.selectCalendar}</Text>
              <TouchableOpacity onPress={() => setCalendarPickerVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={calendars}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.calendarItem,
                    selectedCalendarId === item.id && styles.calendarItemSelected,
                  ]}
                  onPress={() => handleSelectCalendar(item)}
                >
                  <View style={styles.calendarInfo}>
                    <View
                      style={[styles.calendarColor, { backgroundColor: item.color || Colors.accent.purple }]}
                    />
                    <View style={styles.calendarDetails}>
                      <Text
                        style={[
                          styles.calendarTitle,
                          selectedCalendarId === item.id && styles.calendarTitleSelected,
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.source?.name && (
                        <Text style={styles.calendarSource}>{item.source.name}</Text>
                      )}
                    </View>
                  </View>
                  {selectedCalendarId === item.id && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.calendarList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t.calendarSync.noCalendarsMessage}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
