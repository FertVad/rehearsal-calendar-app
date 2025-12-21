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

  const [exportEnabled, setExportEnabled] = useState(settings?.exportEnabled || false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    settings?.exportCalendarId || null
  );
  const [importEnabled, setImportEnabled] = useState(settings?.importEnabled || false);
  const [selectedImportCalendarIds, setSelectedImportCalendarIds] = useState<string[]>(
    settings?.importCalendarIds || []
  );
  const [importInterval, setImportInterval] = useState<'manual' | 'always' | '15min' | 'hourly' | '6hours' | 'daily'>(
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

  const handleToggleAutoSync = async (enabled: boolean) => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (enabled) {
      // Enabling auto-sync
      if (calendars.length === 0) {
        Alert.alert(t.calendarSync.noCalendars, t.calendarSync.noCalendarsMessage);
        return;
      }

      // Select first available calendar for both import and export
      const firstCalendar = calendars[0];

      setExportEnabled(true);
      setSelectedCalendarId(firstCalendar.id);
      setImportEnabled(true);
      setSelectedImportCalendarIds([firstCalendar.id]);
      setImportInterval('always');

      // Update settings - enable both import and export with 'always' interval
      await updateSettings({
        exportEnabled: true,
        exportCalendarId: firstCalendar.id,
        lastExportTime: settings?.lastExportTime || null,
        importEnabled: true,
        importCalendarIds: [firstCalendar.id],
        importInterval: 'always',
      });

      console.log('[AutoSync] Enabled with calendar:', firstCalendar.title);
    } else {
      // Disabling auto-sync
      setExportEnabled(false);
      setImportEnabled(false);

      // Update settings - disable both
      await updateSettings({
        exportEnabled: false,
        exportCalendarId: selectedCalendarId,
        lastExportTime: settings?.lastExportTime || null,
        importEnabled: false,
        importCalendarIds: selectedImportCalendarIds,
        importInterval: importInterval,
      });

      console.log('[AutoSync] Disabled');
    }
  };


  // Single synchronize handler that does both import and export
  const handleSynchronize = async () => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    const hasImport = importEnabled && selectedImportCalendarIds.length > 0;
    const hasExport = exportEnabled && selectedCalendarId;

    if (!hasImport && !hasExport) {
      Alert.alert(
        t.calendarSync.noCalendarsSelected || 'No calendars selected',
        'Please enable and configure import or export calendars first'
      );
      return;
    }

    try {
      let importResult = null;
      let exportResult = null;

      // Import calendar events
      if (hasImport) {
        console.log('[Sync] Starting import...');
        importResult = await importNow();
        console.log('[Sync] Import completed:', importResult);
      }

      // Export rehearsals to calendar
      if (hasExport) {
        console.log('[Sync] Starting export...');
        // Fetch all rehearsals from all projects
        const allRehearsals: RehearsalWithProject[] = [];

        for (const project of projects) {
          try {
            const response = await rehearsalsAPI.getAll(project.id);
            const rehearsals = response.data.rehearsals || [];
            const projectRehearsals = rehearsals.map((r: any) => ({
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

        await syncAll(allRehearsals);
        console.log('[Sync] Export completed');
        exportResult = { success: true };
      }

      // Show success message
      const messages = [];
      if (importResult) {
        messages.push(
          `${t.calendarSync.imported || 'Imported'}: ${importResult.success}, ${t.calendarSync.skipped || 'Skipped'}: ${importResult.skipped}`
        );
      }
      if (exportResult) {
        messages.push(t.calendarSync.exportAllSuccess || 'Rehearsals exported to calendar');
      }

      Alert.alert(
        t.calendarSync.syncSuccess || 'Sync Complete',
        messages.join('\n')
      );
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      Alert.alert(
        t.calendarSync.syncError || 'Sync Error',
        error.message || 'Failed to synchronize calendars'
      );
    }
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
        {!hasPermission && (
          <View style={styles.section}>
            <View style={styles.permissionCard}>
              {hasPermission === null ? (
                <>
                  <ActivityIndicator size="small" color={Colors.accent.purple} />
                  <Text style={styles.permissionStatus}>{t.calendarSync.checkingPermissions}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle" size={24} color={Colors.accent.yellow} />
                  <Text style={styles.permissionStatus}>{t.calendarSync.permissionRequired}</Text>
                  <GlassButton
                    title={t.calendarSync.grantPermission}
                    onPress={handleRequestPermissions}
                    variant="glass"
                    style={styles.permissionButton}
                  />
                </>
              )}
            </View>
          </View>
        )}

        {/* Auto Sync Toggle */}
        {hasPermission && (
          <>
            <View style={styles.section}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                    <Ionicons name="sync" size={20} color={Colors.accent.purple} />
                  </View>
                  <Text style={styles.settingLabel}>{t.calendarSync.autoSync || 'Автосинхронизация'}</Text>
                </View>
                <Switch
                  value={exportEnabled && importEnabled}
                  onValueChange={handleToggleAutoSync}
                  trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.purple }}
                  thumbColor={Colors.text.inverse}
                  disabled={isSyncing || isImporting}
                />
              </View>
            </View>

            {/* Manual Sync Button */}
            {(exportEnabled || importEnabled) && (
              <View style={styles.section}>
                <GlassButton
                  title={t.calendarSync.synchronize || 'Синхронизировать'}
                  onPress={handleSynchronize}
                  variant="purple"
                  disabled={isImporting || isSyncing}
                  loading={isImporting || isSyncing}
                  style={styles.actionButton}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
