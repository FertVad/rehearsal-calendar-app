import { logger } from '../../../shared/utils/logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import { GlassButton } from '../../../shared/components';
import { styles } from '../styles/calendarSyncSettingsScreenStyles';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { DeviceCalendar, RehearsalWithProject } from '../../../shared/types/calendar';
import { rehearsalsAPI } from '../../../shared/services/api';

type CalendarSyncSettingsScreenProps = NativeStackScreenProps<any, 'CalendarSyncSettings'>;

type CalendarProvider = 'google' | 'apple' | null;

export default function CalendarSyncSettingsScreen({ navigation }: CalendarSyncSettingsScreenProps) {
  const { t } = useI18n();
  const { projects } = useProjects();
  const {
    hasPermission,
    calendars,
    settings,
    isSyncing,
    requestPermissions,
    updateSettings,
    syncAll,
    removeAll,
    refresh,
    isImporting,
    importNow,
  } = useCalendarSync();

  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // Determine current provider and calendar from settings
  useEffect(() => {
    if (settings && calendars.length > 0) {
      const isEnabled = settings.exportEnabled && settings.importEnabled;
      setSyncEnabled(isEnabled);

      if (settings.exportCalendarId) {
        setSelectedCalendarId(settings.exportCalendarId);
        const selectedCal = calendars.find(c => c.id === settings.exportCalendarId);
        if (selectedCal) {
          const provider = getCalendarProvider(selectedCal);
          setSelectedProvider(provider);
        }
      }
    }
  }, [settings, calendars]);

  // Log available calendars and which will be used for import
  useEffect(() => {
    if (calendars.length > 0) {
      logger.debug('[CalendarSync] 📋 All available calendars:');
      calendars.forEach((cal, idx) => {
        const provider = getCalendarProvider(cal);
        const excluded = shouldExcludeFromImport(cal);
        logger.debug(`  [${idx}] ${cal.title}`);
        logger.debug(`      - Provider: ${provider}`);
        logger.debug(`      - Source: ${cal.source?.name || 'Unknown'}`);
        logger.debug(`      - Writable: ${cal.allowsModifications}`);
        logger.debug(`      - Will import: ${!excluded && cal.allowsModifications ? 'YES' : 'NO'} ${excluded ? '(excluded: subscription/birthday/holiday)' : ''}`);
      });
    }
  }, [calendars]);

  // Group calendars by provider
  // Strategy: Google = gmail/google in source name, Apple = everything else (iCloud, Local, iOS, etc.)
  const getCalendarProvider = (calendar: DeviceCalendar): CalendarProvider => {
    const sourceName = calendar.source?.name?.toLowerCase() || '';
    const sourceType = calendar.source?.type?.toLowerCase() || '';

    // Check for Google Calendar
    if (sourceName.includes('gmail') || sourceName.includes('google')) {
      return 'google';
    }

    // Check for Apple/iCloud Calendar
    if (
      sourceName.includes('icloud') ||
      sourceName.includes('apple') ||
      sourceName.includes('local') ||
      sourceType === 'local' ||
      sourceType === 'caldav'
    ) {
      return 'apple';
    }

    // Default: if writable and not Google, assume it's Apple/Local
    if (calendar.allowsModifications) {
      return 'apple';
    }

    return null;
  };

  // Helper: Check if calendar should be excluded from import (subscriptions, birthdays, holidays)
  const shouldExcludeFromImport = (calendar: DeviceCalendar): boolean => {
    const sourceName = calendar.source?.name?.toLowerCase() || '';
    const title = calendar.title?.toLowerCase() || '';

    // Exclude subscribed calendars (holidays, etc.)
    if (sourceName.includes('subscribed')) {
      return true;
    }

    // Exclude birthdays calendar
    if (sourceName.includes('other') || title.includes('birthday')) {
      return true;
    }

    // Exclude holiday calendars by title
    if (
      title.includes('holiday') ||
      title.includes('праздник') ||
      title.includes('חגים')
    ) {
      return true;
    }

    return false;
  };

  // Get ALL writable calendars from provider (for import)
  const getProviderCalendars = (provider: CalendarProvider): DeviceCalendar[] => {
    return calendars.filter(
      c =>
        c.allowsModifications &&
        getCalendarProvider(c) === provider &&
        !shouldExcludeFromImport(c)
    );
  };

  // Get first writable calendar from provider (for export)
  const getProviderCalendar = (provider: CalendarProvider): DeviceCalendar | null => {
    const providerCalendars = getProviderCalendars(provider);
    return providerCalendars[0] || null;
  };

  // Check if provider is available
  const hasGoogleCalendar = calendars.some(
    c => c.allowsModifications && getCalendarProvider(c) === 'google'
  );
  const hasAppleCalendar = calendars.some(
    c => c.allowsModifications && getCalendarProvider(c) === 'apple'
  );

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
    }
  };

  const handleSelectProvider = async (provider: CalendarProvider) => {
    if (!provider) return;

    // Get ALL calendars from this provider (not just first one)
    const providerCalendars = getProviderCalendars(provider);

    if (providerCalendars.length === 0) {
      Alert.alert(
        t.common.error,
        `No writable ${provider === 'google' ? 'Google' : 'Apple'} calendar found`
      );
      return;
    }

    setSelectedProvider(provider);

    // If only 1 calendar, auto-select it; otherwise let user pick
    const exportCalendar = providerCalendars.length === 1 ? providerCalendars[0] : null;
    const exportCalendarId = exportCalendar?.id || selectedCalendarId || providerCalendars[0].id;

    // Import from the same single calendar — matches user expectation of
    // "I picked one calendar to sync with"
    const importCalendarIds = [exportCalendarId];

    if (exportCalendar) {
      setSelectedCalendarId(exportCalendar.id);
    }

    // Auto-enable sync
    setSyncEnabled(true);
    await updateSettings({
      exportEnabled: true,
      exportCalendarId,
      importEnabled: true,
      importCalendarIds,
      importInterval: 'always',
      lastExportTime: settings?.lastExportTime || null,
      lastImportTime: settings?.lastImportTime || null,
    });

    logger.debug(`[CalendarSync] Enabled ${provider} calendar sync:`);
    logger.debug(`  Calendar: ${exportCalendar?.title || 'user will pick'}`);
  };

  const handleSelectCalendar = async (calendarId: string) => {
    setSelectedCalendarId(calendarId);

    await updateSettings({
      exportEnabled: settings?.exportEnabled ?? true,
      exportCalendarId: calendarId,
      importEnabled: settings?.importEnabled ?? true,
      // Import from the same calendar — single-calendar mode
      importCalendarIds: [calendarId],
      importInterval: settings?.importInterval || 'always',
      lastExportTime: settings?.lastExportTime || null,
      lastImportTime: settings?.lastImportTime || null,
    });

    const cal = calendars.find(c => c.id === calendarId);
    logger.debug(`[CalendarSync] Calendar changed to: ${cal?.title}`);
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (enabled && !selectedProvider) {
      // Ask user to select provider first
      Alert.alert(
        t.calendarSync.selectCalendar || 'Select Calendar',
        'Please select Google Calendar or Apple Calendar first'
      );
      return;
    }

    setSyncEnabled(enabled);

    if (enabled && selectedProvider) {
      // Re-enabling sync: keep previously selected calendar if any,
      // otherwise default to first available from the provider.
      const providerCalendars = getProviderCalendars(selectedProvider);
      const previousId = settings?.exportCalendarId;
      const calendar = providerCalendars.find(c => c.id === previousId) || providerCalendars[0];

      if (calendar) {
        await updateSettings({
          exportEnabled: true,
          exportCalendarId: calendar.id,
          importEnabled: true,
          importCalendarIds: [calendar.id],
          importInterval: 'always',
          lastExportTime: settings?.lastExportTime || null,
          lastImportTime: settings?.lastImportTime || null,
        });
      }
    } else {
      await updateSettings({
        exportEnabled: false,
        exportCalendarId: settings?.exportCalendarId || null,
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
        lastExportTime: settings?.lastExportTime || null,
        lastImportTime: settings?.lastImportTime || null,
      });
    }
  };

  const handleSynchronize = async () => {
    logger.debug('[Sync] 🔄 handleSynchronize called');

    if (!hasPermission) {
      logger.debug('[Sync] ❌ No calendar permission');
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (!syncEnabled || !selectedProvider) {
      logger.debug('[Sync] ❌ Sync not enabled or no provider selected:', {
        syncEnabled,
        selectedProvider,
      });
      Alert.alert(
        t.calendarSync.noCalendarsSelected || 'No calendar selected',
        'Please enable sync and select a calendar first'
      );
      return;
    }

    try {
      logger.debug('[Sync] ✅ Starting synchronization...');
      logger.debug('[Sync] 📊 Current settings:', {
        exportEnabled: settings?.exportEnabled,
        exportCalendarId: settings?.exportCalendarId,
        importEnabled: settings?.importEnabled,
        importCalendarIds: settings?.importCalendarIds,
      });

      // Import calendar events
      logger.debug('[Sync] 📥 Starting import from calendar...');
      const importResult = await importNow();
      logger.debug('[Sync] ✅ Import completed:', importResult);

      // Export rehearsals to calendar
      logger.debug('[Sync] 📤 Starting export to calendar...');
      logger.debug('[Sync] 📊 Projects available:', projects.length);
      const projectIds = projects.map(p => p.id);
      logger.debug('[Sync] 🔍 Fetching rehearsals for projects:', projectIds);

      const response = await rehearsalsAPI.getBatch(projectIds);
      logger.debug('[Sync] 📋 API response:', {
        hasData: !!response.data,
        rehearsalsCount: response.data?.rehearsals?.length || 0,
      });

      const allRehearsals: RehearsalWithProject[] = (response.data.rehearsals || []).map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        projectName: r.projectName,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        location: r.location,
      }));

      logger.debug('[Sync] 📊 Rehearsals to sync:', allRehearsals.length);

      if (allRehearsals.length === 0) {
        logger.debug('[Sync] ⚠️ No rehearsals found to sync');
        Alert.alert(
          t.calendarSync.syncSuccess || 'Sync Complete',
          'No rehearsals found to sync. Create some rehearsals first!'
        );
        return;
      }

      logger.debug('[Sync] 🚀 Calling syncAll with', allRehearsals.length, 'rehearsals');
      const syncResult = await syncAll(allRehearsals);
      logger.debug('[Sync] ✅ Export completed:', syncResult);

      // Show success message
      Alert.alert(
        t.calendarSync.syncSuccess || 'Sync Complete',
        `${t.calendarSync.imported || 'Imported'}: ${importResult.success}\n${t.calendarSync.exportedRehearsals || 'Rehearsals exported'}: ${syncResult?.success || allRehearsals.length}`
      );
    } catch (error: any) {
      console.error('[Sync] ❌ Error during synchronization:', error);
      console.error('[Sync] ❌ Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
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

        {/* Sync Settings */}
        {hasPermission && (
          <>
            {/* Sync Toggle */}
            <View style={styles.section}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
                    <Ionicons name="sync" size={20} color={Colors.accent.purple} />
                  </View>
                  <Text style={styles.settingLabel}>{t.calendarSync.autoSync || 'Синхронизация'}</Text>
                </View>
                <Switch
                  value={syncEnabled}
                  onValueChange={handleToggleSync}
                  trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.purple }}
                  thumbColor={Colors.text.inverse}
                  disabled={isSyncing || isImporting}
                />
              </View>
            </View>

            {/* Calendar Provider Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Выберите календарь</Text>

              {/* Google Calendar Option */}
              {hasGoogleCalendar && (
                <TouchableOpacity
                  style={[
                    styles.calendarPickerButton,
                    selectedProvider === 'google' && styles.calendarPickerButtonSelected,
                  ]}
                  onPress={() => handleSelectProvider('google')}
                  disabled={isSyncing || isImporting}
                >
                  <View style={styles.calendarPickerLeft}>
                    <View style={[styles.providerIcon, { backgroundColor: '#DB4437' }]}>
                      <Ionicons name="logo-google" size={24} color="#fff" />
                    </View>
                    <View style={styles.calendarPickerText}>
                      <Text style={styles.calendarPickerLabel}>Google Calendar</Text>
                      <Text style={styles.calendarPickerSubtext}>
                        {(selectedProvider === 'google' && selectedCalendarId
                          ? calendars.find(c => c.id === selectedCalendarId)?.title
                          : getProviderCalendar('google')?.title) || 'Gmail'}
                      </Text>
                    </View>
                  </View>
                  {selectedProvider === 'google' && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent.purple} />
                  )}
                </TouchableOpacity>
              )}

              {/* Apple Calendar Option */}
              {hasAppleCalendar && (
                <TouchableOpacity
                  style={[
                    styles.calendarPickerButton,
                    selectedProvider === 'apple' && styles.calendarPickerButtonSelected,
                  ]}
                  onPress={() => handleSelectProvider('apple')}
                  disabled={isSyncing || isImporting}
                >
                  <View style={styles.calendarPickerLeft}>
                    <View style={[styles.providerIcon, { backgroundColor: '#000' }]}>
                      <Ionicons name="logo-apple" size={24} color="#fff" />
                    </View>
                    <View style={styles.calendarPickerText}>
                      <Text style={styles.calendarPickerLabel}>Apple Calendar</Text>
                      <Text style={styles.calendarPickerSubtext}>
                        {(selectedProvider === 'apple' && selectedCalendarId
                          ? calendars.find(c => c.id === selectedCalendarId)?.title
                          : getProviderCalendar('apple')?.title) || 'iCloud'}
                      </Text>
                    </View>
                  </View>
                  {selectedProvider === 'apple' && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent.purple} />
                  )}
                </TouchableOpacity>
              )}

              {!hasGoogleCalendar && !hasAppleCalendar && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color={Colors.text.tertiary} />
                  <Text style={styles.emptyText}>
                    {t.calendarSync.noCalendarsFound || 'No calendars found'}
                  </Text>
                </View>
              )}
            </View>

            {/* Calendar Picker (when provider has multiple calendars) */}
            {selectedProvider && getProviderCalendars(selectedProvider).length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.calendarSync.chooseCalendar}</Text>
                <View style={styles.calendarPickerList}>
                  {getProviderCalendars(selectedProvider).map((cal) => (
                    <TouchableOpacity
                      key={cal.id}
                      style={[
                        styles.calendarPickerItem,
                        selectedCalendarId === cal.id && styles.calendarPickerItemSelected,
                      ]}
                      onPress={() => handleSelectCalendar(cal.id)}
                      disabled={isSyncing || isImporting}
                    >
                      <View style={styles.calendarPickerItemLeft}>
                        <View style={[styles.calendarPickerDot, { backgroundColor: cal.color || Colors.accent.purple }]} />
                        <Text style={styles.calendarPickerItemLabel}>{cal.title}</Text>
                      </View>
                      {selectedCalendarId === cal.id && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.accent.green} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Sync Button */}
            {syncEnabled && selectedProvider && (
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
