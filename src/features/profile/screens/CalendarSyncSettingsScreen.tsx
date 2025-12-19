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
    // Export state/functions
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
    // Import state/functions (Phase 2)
    isImporting,
    importError,
    importedCount,
    lastImportTime,
    importNow,
    clearImported,
  } = useCalendarSync();

  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(settings?.exportEnabled || false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    settings?.exportCalendarId || null
  );

  // Phase 2: Import state
  const [importCalendarPickerVisible, setImportCalendarPickerVisible] = useState(false);
  const [importEnabled, setImportEnabled] = useState(settings?.importEnabled || false);
  const [selectedImportCalendarIds, setSelectedImportCalendarIds] = useState<string[]>(
    settings?.importCalendarIds || []
  );
  const [importInterval, setImportInterval] = useState<'manual' | 'hourly' | '6hours' | 'daily'>(
    settings?.importInterval || 'manual'
  );

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      setExportEnabled(settings.exportEnabled);
      setSelectedCalendarId(settings.exportCalendarId);
      setImportEnabled(settings.importEnabled);
      setSelectedImportCalendarIds(settings.importCalendarIds);
      setImportInterval(settings.importInterval);
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

  // ====== Phase 2: Import Handlers ======

  const handleToggleImport = async (enabled: boolean) => {
    setImportEnabled(enabled);

    // If enabling and no calendars selected, show picker
    if (enabled && selectedImportCalendarIds.length === 0) {
      if (calendars.length > 0) {
        setImportCalendarPickerVisible(true);
      } else {
        Alert.alert(t.calendarSync.noCalendars, t.calendarSync.noCalendarsMessage);
        setImportEnabled(false);
        return;
      }
    }

    // Update settings
    await updateSettings({
      importEnabled: enabled,
      importCalendarIds: selectedImportCalendarIds,
      importInterval,
    });
  };

  const handleToggleImportCalendar = (calendarId: string) => {
    const newSelection = selectedImportCalendarIds.includes(calendarId)
      ? selectedImportCalendarIds.filter((id) => id !== calendarId)
      : [...selectedImportCalendarIds, calendarId];

    setSelectedImportCalendarIds(newSelection);
  };

  const handleSaveImportCalendars = async () => {
    setImportCalendarPickerVisible(false);

    // Update settings
    await updateSettings({
      importEnabled,
      importCalendarIds: selectedImportCalendarIds,
      importInterval,
    });
  };

  const getSelectedImportCalendarsText = (): string => {
    if (selectedImportCalendarIds.length === 0) {
      return t.calendarSync.selectCalendars || 'Select calendars';
    }
    if (selectedImportCalendarIds.length === 1) {
      const calendar = calendars.find((c) => c.id === selectedImportCalendarIds[0]);
      return calendar?.title || t.calendarSync.selectCalendars || 'Select calendars';
    }
    return t.calendarSync.calendarsSelected?.(selectedImportCalendarIds.length)
      || `${selectedImportCalendarIds.length} calendars selected`;
  };

  const handleImportNow = async () => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (selectedImportCalendarIds.length === 0) {
      Alert.alert(t.calendarSync.noCalendarsSelected, t.calendarSync.selectCalendarsFirst || 'Please select calendars to import from');
      return;
    }

    try {
      const result = await importNow();
      Alert.alert(
        t.calendarSync.importSuccess || 'Import Successful',
        t.calendarSync.importSuccessMessage?.(result.success, result.failed, result.skipped)
          || `Imported: ${result.success}, Failed: ${result.failed}, Skipped: ${result.skipped}`
      );
    } catch (error: any) {
      Alert.alert(t.calendarSync.importError || 'Import Error', error.message || 'Failed to import events');
    }
  };

  const handleClearImported = () => {
    Alert.alert(
      t.calendarSync.clearImported || 'Clear Imported Events',
      t.calendarSync.clearImportedConfirm || 'Remove all imported events from your availability?',
      [
        { text: t.common?.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.calendarSync.clearImported || 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearImported();
              Alert.alert(t.calendarSync.clearSuccess || 'Success', t.calendarSync.clearImportedSuccess || 'Imported events cleared');
            } catch (error: any) {
              Alert.alert(t.calendarSync.importError || 'Error', error.message || 'Failed to clear imported events');
            }
          },
        },
      ]
    );
  };

  const formatLastImportTime = (): string => {
    if (!lastImportTime) return t.calendarSync.neverImported || 'Never';
    const date = new Date(lastImportTime);
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

            {/* Export Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.calendarSync.exportStatus || 'Export Status'}</Text>

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

            {/* ====== Phase 2: Import Settings ====== */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.calendarSync.importSettings || 'Import Settings'}</Text>

              {/* Enable Import Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                    <Ionicons name="download" size={20} color={Colors.accent.green} />
                  </View>
                  <Text style={styles.settingLabel}>{t.calendarSync.importEnabled || 'Import calendar events'}</Text>
                </View>
                <Switch
                  value={importEnabled}
                  onValueChange={handleToggleImport}
                  trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.green }}
                  thumbColor={Colors.text.inverse}
                  disabled={isImporting || isSyncing}
                />
              </View>

              {/* Import Calendars Selector */}
              {importEnabled && (
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => setImportCalendarPickerVisible(true)}
                  disabled={isImporting || isSyncing}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                      <Ionicons name="albums" size={20} color={Colors.accent.blue} />
                    </View>
                    <Text style={styles.settingLabel}>{t.calendarSync.importCalendars || 'Import from calendars'}</Text>
                  </View>
                  <View style={styles.settingRight}>
                    <Text style={styles.settingValue} numberOfLines={1}>
                      {getSelectedImportCalendarsText()}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Import Actions */}
            {importEnabled && selectedImportCalendarIds.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.calendarSync.importActions || 'Import Actions'}</Text>

                {/* Import Now Button */}
                <GlassButton
                  title={t.calendarSync.importNow || 'Import Now'}
                  onPress={handleImportNow}
                  variant="purple"
                  disabled={isImporting}
                  loading={isImporting}
                  style={styles.actionButton}
                />

                {/* Clear Imported Button */}
                {importedCount > 0 && (
                  <GlassButton
                    title={t.calendarSync.clearImported || 'Clear All Imported'}
                    onPress={handleClearImported}
                    variant="glass"
                    disabled={isImporting}
                    style={styles.actionButton}
                  />
                )}
              </View>
            )}

            {/* Import Status */}
            {importEnabled && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.calendarSync.importStatus || 'Import Status'}</Text>

                <View style={styles.statusCard}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{t.calendarSync.importedCount || 'Imported events'}</Text>
                    <Text style={styles.statusValue}>{importedCount}</Text>
                  </View>

                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{t.calendarSync.lastImport || 'Last import'}</Text>
                    <Text style={styles.statusValue}>{formatLastImportTime()}</Text>
                  </View>

                  {importError && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="warning" size={16} color={Colors.accent.red} />
                      <Text style={styles.errorText}>{importError}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
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

      {/* Import Calendar Picker Modal (Multi-select) */}
      <Modal
        visible={importCalendarPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImportCalendarPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.calendarSync.selectImportCalendars || 'Select Calendars to Import'}</Text>
              <TouchableOpacity onPress={() => setImportCalendarPickerVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={calendars}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedImportCalendarIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.calendarItem,
                      isSelected && styles.calendarItemSelected,
                    ]}
                    onPress={() => handleToggleImportCalendar(item.id)}
                  >
                    <View style={styles.calendarInfo}>
                      <View
                        style={[styles.calendarColor, { backgroundColor: item.color || Colors.accent.purple }]}
                      />
                      <View style={styles.calendarDetails}>
                        <Text
                          style={[
                            styles.calendarTitle,
                            isSelected && styles.calendarTitleSelected,
                          ]}
                        >
                          {item.title}
                        </Text>
                        {item.source?.name && (
                          <Text style={styles.calendarSource}>{item.source.name}</Text>
                        )}
                      </View>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkbox" size={24} color={Colors.accent.green} />
                    ) : (
                      <Ionicons name="square-outline" size={24} color={Colors.text.tertiary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={styles.calendarList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t.calendarSync.noCalendarsMessage}</Text>
                </View>
              }
            />
            <View style={styles.modalFooter}>
              <GlassButton
                title={t.common?.save || 'Save'}
                onPress={handleSaveImportCalendars}
                variant="purple"
                style={styles.modalSaveButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
