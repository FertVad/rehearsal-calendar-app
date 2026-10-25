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
import { GlassButton } from '../../../shared/components';
import { styles } from '../styles/calendarSyncSettingsScreenStyles';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { formatLastSync } from '../../../shared/utils/formatLastSync';
import { CalendarSyncSettings, DeviceCalendar } from '../../../shared/types/calendar';

type CalendarSyncSettingsScreenProps = NativeStackScreenProps<any, 'CalendarSyncSettings'>;

type CalendarProvider = 'google' | 'apple' | null;

export default function CalendarSyncSettingsScreen({ navigation }: CalendarSyncSettingsScreenProps) {
  const { t } = useI18n();
  const {
    hasPermission,
    calendars,
    settings,
    isSyncing,
    requestPermissions,
    updateSettings,
    synchronize,
    removeAll,
    isImporting,
    syncedCount,
  } = useCalendarSync();

  // Which provider's calendars are listed — the screen's own choice until a
  // calendar of it is saved. Whether sync is on, and with which calendar, is
  // what the settings say, not what was last tapped: a save that failed left
  // the tap on screen (HP05, cause fix 18).
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const syncEnabled = settings.exportEnabled && settings.importEnabled;
  const selectedCalendarId = settings.exportCalendarId;

  // Determine current provider from settings
  useEffect(() => {
    if (settings && calendars.length > 0) {
      if (settings.exportCalendarId) {
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

    // Always start with the first calendar of the new provider — using
    // selectedCalendarId here would carry over the previous provider's ID
    // and the useEffect would snap selectedProvider back to that provider.
    const exportCalendar = providerCalendars[0];
    const exportCalendarId = exportCalendar.id;

    // Import from the same single calendar — matches user expectation of
    // "I picked one calendar to sync with"
    const importCalendarIds = [exportCalendarId];

    // Auto-enable sync
    if (await save({
      exportEnabled: true,
      exportCalendarId,
      importEnabled: true,
      importCalendarIds,
      importInterval: 'always',
    })) {
      setSelectedProvider(provider);
      logger.debug(`[CalendarSync] Enabled ${provider} calendar sync: ${exportCalendar.title}`);
    }
  };

  const handleSelectCalendar = async (calendarId: string) => {
    await save({
      exportCalendarId: calendarId,
      // Import from the same calendar — single-calendar mode
      importCalendarIds: [calendarId],
    });

    const cal = calendars.find(c => c.id === calendarId);
    logger.debug(`[CalendarSync] Calendar changed to: ${cal?.title}`);
  };

  /**
   * Save the fields named, and only those. The stamps are the sync's: the
   * screen used to send back the ones it had read, over newer ones (EO04).
   * What could not be saved is said, and the screen stays as the settings are.
   */
  const save = async (patch: Partial<CalendarSyncSettings>): Promise<boolean> => {
    try {
      await updateSettings(patch);
      return true;
    } catch (error: any) {
      Alert.alert(t.common.error, error?.message || t.calendarSync.syncError);
      return false;
    }
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

    if (enabled && selectedProvider) {
      // Re-enabling sync: keep previously selected calendar if any,
      // otherwise default to first available from the provider.
      const providerCalendars = getProviderCalendars(selectedProvider);
      const previousId = settings?.exportCalendarId;
      const calendar = providerCalendars.find(c => c.id === previousId) || providerCalendars[0];

      if (calendar) {
        await save({
          exportEnabled: true,
          exportCalendarId: calendar.id,
          importEnabled: true,
          importCalendarIds: [calendar.id],
          importInterval: 'always',
        });
      }
    } else {
      await save({
        exportEnabled: false,
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
      });
    }
  };

  const handleRemoveAll = () => {
    Alert.alert(
      t.calendarSync.removeAllConfirm,
      '',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.calendarSync.removeAll,
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRemoving(true);
              const result = await removeAll();
              logger.debug('[Sync] Removed exported events:', result);

              // removeAll reports failures rather than throwing, and this said
              // "done" whatever came back — including a run where every single
              // deletion failed and every event was still sitting in the
              // calendar.
              if (result?.failed) {
                Alert.alert(
                  t.common.error,
                  t.calendarSync.removeAllPartial(result.success ?? 0, result.failed)
                );
              } else {
                Alert.alert(t.calendarSync.removeAllSuccess, '');
              }
            } catch (error: any) {
              logger.error('[Sync] Failed to remove exported events:', error);
              Alert.alert(t.common.error, error?.message || t.calendarSync.syncError);
            } finally {
              setIsRemoving(false);
            }
          },
        },
      ]
    );
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

    logger.debug('[Sync] ✅ Starting synchronization...');
    logger.debug('[Sync] 📊 Current settings:', {
      exportEnabled: settings?.exportEnabled,
      exportCalendarId: settings?.exportCalendarId,
      importEnabled: settings?.importEnabled,
      importCalendarIds: settings?.importCalendarIds,
    });

    // The one sync of the app, as the automatic run and a pull do it — with
    // the settings as they are when each direction gets to them, and after any
    // run already going (cause fix 18). This screen used to run its own copy.
    //
    // The two directions are independent: a failed import used to skip the
    // export altogether, and a run with failures in either was announced as
    // "Synced successfully" with the counts of what did get through. Each
    // direction runs, and what failed is said.
    let run;
    try {
      run = await synchronize();
    } catch (error: any) {
      logger.error('[Sync] ❌ Error during synchronization:', error);
      Alert.alert(t.calendarSync.syncError || 'Sync Error', error?.message || 'Failed to synchronize calendars');
      return;
    }
    // Ended with the session: there is nobody to tell.
    if (!run) return;
    logger.debug('[Sync] ✅ Run completed:', run);

    const problems: string[] = [];
    let imported = 0;
    if (run.import.status === 'done') {
      imported = run.import.result.success;
      if (run.import.result.failed > 0) problems.push(t.calendarSync.importIncomplete(run.import.result.failed));
    } else if (run.import.status === 'failed') {
      problems.push(run.import.error || t.calendarSync.syncError);
    }

    let exported = 0;
    if (run.export.status === 'done') {
      exported = run.export.result.success;
      if (run.export.result.failed > 0) problems.push(t.calendarSync.exportIncomplete(run.export.result.failed));
    } else if (run.export.status === 'failed') {
      problems.push(run.export.error || t.calendarSync.syncError);
    }

    if (run.export.status === 'done' && run.export.result.rehearsals === 0 && problems.length === 0) {
      Alert.alert(
        t.calendarSync.syncSuccess || 'Sync Complete',
        'No rehearsals found to sync. Create some rehearsals first!'
      );
      return;
    }

    // The real counts. `syncResult?.success || allRehearsals.length` read
    // zero as "no answer" and fell back to the total, so the one run where
    // nothing exported at all was reported as everything exporting.
    const counts = `${t.calendarSync.imported || 'Imported'}: ${imported}\n${t.calendarSync.exportedRehearsals || 'Rehearsals exported'}: ${exported}`;
    if (problems.length > 0) {
      Alert.alert(t.calendarSync.syncError || 'Sync Error', `${counts}\n\n${problems.join('\n')}`);
    } else {
      Alert.alert(t.calendarSync.syncSuccess || 'Sync Complete', counts);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => navigation.goBack()} style={styles.backButton}>
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
                  <Text style={styles.settingLabel}>{t.calendarSync.autoSync}</Text>
                </View>
                <Switch
                  testID="calendar-sync-toggle"
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
              <Text style={styles.sectionTitle}>{t.calendarSync.selectCalendar}</Text>

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
                {/* The result used to live in a one-shot alert and vanish, so
                    the only way to know sync worked was to run it again. */}
                {settings?.lastExportTime && (
                  <View style={styles.syncStatus}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={Colors.accent.green} />
                    <Text style={styles.syncStatusText}>
                      {t.calendarSync.syncedAgo(formatLastSync(settings.lastExportTime, t))}
                      {syncedCount > 0 ? ` · ${t.calendarSync.inCalendar(syncedCount)}` : ''}
                    </Text>
                  </View>
                )}

                <GlassButton
                  title={t.calendarSync.synchronize}
                  onPress={handleSynchronize}
                  variant="purple"
                  disabled={isImporting || isSyncing}
                  loading={isImporting || isSyncing}
                  style={styles.actionButton}
                />

                {/* Turning sync off only stops new writes — everything already
                    exported stays in the user's own calendar. This is the way
                    to take it back. */}
                <TouchableOpacity
                  style={styles.removeAllButton}
                  onPress={handleRemoveAll}
                  disabled={isImporting || isSyncing || isRemoving}
                >
                  {isRemoving ? (
                    <ActivityIndicator size="small" color={Colors.accent.red} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                      <Text style={styles.removeAllText}>{t.calendarSync.removeAll}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
