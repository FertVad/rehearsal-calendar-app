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
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../shared/constants/colors';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { useI18n } from '../../../contexts/I18nContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { GlassButton } from '../../../shared/components';
import { styles } from '../styles/calendarSyncSettingsScreenStyles';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { formatLastSync } from '../../../shared/utils/formatLastSync';
import { CalendarSyncSettings, DeviceCalendar } from '../../../shared/types/calendar';

type CalendarSyncSettingsScreenProps = NativeStackScreenProps<any, 'CalendarSyncSettings'>;

type CalendarProvider = 'google' | 'apple' | null;

/** Auto Sync off, both directions: what the switch saves, and what a removal saves first. */
const SYNC_OFF: Partial<CalendarSyncSettings> = {
  exportEnabled: false,
  importEnabled: false,
  importCalendarIds: [],
  importInterval: 'manual',
};

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
    clearImported,
    isImporting,
    syncedCount,
  } = useCalendarSync();

  // Which provider's calendars are listed — the screen's own choice until a
  // calendar of it is saved. Whether sync is on, and with which calendar, is
  // what the settings say, not what was last tapped: a save that failed left
  // the tap on screen (HP05, cause fix 18).
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const syncEnabled = settings.exportEnabled && settings.importEnabled;
  // Either direction left on would run again and put back what a removal took.
  const syncWouldRun = settings.exportEnabled || settings.importEnabled;
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
      Alert.alert(t.common.error, t.calendarSync.noWritableCalendars);
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
      Alert.alert(t.common.error, requestErrorMessage(t, error, t.calendarSync.syncError));
      return false;
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!hasPermission) {
      Alert.alert(t.calendarSync.permissionDenied, t.calendarSync.permissionDeniedMessage);
      return;
    }

    if (enabled && !selectedProvider) {
      Alert.alert(t.calendarSync.selectCalendar, t.calendarSync.chooseProviderFirst);
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
      await save(SYNC_OFF);
    }
  };

  /**
   * A removal does not stay done while Auto Sync is on: the next run exports
   * every rehearsal again, or imports every event again (T-270). So it turns
   * Auto Sync off first, as the switch does, and the question says so. False:
   * that could not be saved, it was said, and nothing should be removed.
   */
  const turnSyncOffForRemoval = async (): Promise<boolean> => {
    if (!syncWouldRun) return true;
    return save(SYNC_OFF);
  };

  const handleRemoveAll = () => {
    Alert.alert(
      t.calendarSync.removeAllConfirm,
      syncWouldRun ? t.calendarSync.autoSyncTurnsOff : '',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.calendarSync.removeAll,
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRemoving(true);
              if (!(await turnSyncOffForRemoval())) return;
              const result = await removeAll();
              logger.debug('[Sync] Removed exported events:', result);
              // Signed out before its turn: nothing was done, and nobody to tell.
              if (!result) return;

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
              Alert.alert(t.common.error, requestErrorMessage(t, error, t.calendarSync.syncError));
            } finally {
              setIsRemoving(false);
            }
          },
        },
      ]
    );
  };

  /**
   * What the privacy policy promises (T-270): every busy time that came from
   * a calendar, from all of the person's devices — the server's rows, so no
   * calendar access is needed. What they marked themselves stays. How many
   * went is not said.
   */
  const handleClearImported = () => {
    Alert.alert(
      t.calendarSync.clearImportedConfirm,
      syncWouldRun
        ? `${t.calendarSync.clearImportedMessage}\n\n${t.calendarSync.autoSyncTurnsOff}`
        : t.calendarSync.clearImportedMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.calendarSync.clearImported,
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              if (!(await turnSyncOffForRemoval())) return;
              const result = await clearImported();
              // Signed out before its turn: nothing was done, and nobody to tell.
              if (!result) return;
              Alert.alert(t.calendarSync.clearImportedSuccess, '');
            } catch (error: any) {
              logger.error('[Sync] Failed to remove imported busy times:', error);
              Alert.alert(t.common.error, requestErrorMessage(t, error, t.calendarSync.syncError));
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  // Pressed only from "Sync Now", which is there only with calendar access,
  // Auto Sync on and its calendar on this phone: nothing to check first.
  const handleSynchronize = async () => {
    logger.debug('[Sync] 🔄 handleSynchronize called');

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
      Alert.alert(t.calendarSync.syncError, requestErrorMessage(t, error, t.auth.requestFailed));
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
      problems.push(requestErrorMessage(t, run.import.error, t.calendarSync.syncError));
    }

    let exported = 0;
    if (run.export.status === 'done') {
      exported = run.export.result.success;
      if (run.export.result.failed > 0) problems.push(t.calendarSync.exportIncomplete(run.export.result.failed));
    } else if (run.export.status === 'failed') {
      problems.push(requestErrorMessage(t, run.export.error, t.calendarSync.syncError));
    }

    // The real counts. `syncResult?.success || allRehearsals.length` read
    // zero as "no answer" and fell back to the total, so the one run where
    // nothing exported at all was reported as everything exporting. A run
    // with no rehearsals says so by its "0" too: an English sentence of its
    // own told a participant, who cannot create any, to create some, and hid
    // what was imported (T-270).
    const counts = `${t.calendarSync.imported}: ${imported}\n${t.calendarSync.exportedRehearsals}: ${exported}`;
    if (problems.length > 0) {
      Alert.alert(t.calendarSync.syncError, `${counts}\n\n${problems.join('\n')}`);
    } else {
      Alert.alert(t.calendarSync.syncSuccess, counts);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Pushed in the Profile tab: back to it, with its name (T-029). */}
      <ScreenHeader
        kind="stack"
        title={t.calendarSync.title}
        backTitle={t.profile.title}
        backWord={t.common.back}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text testID="calendar-sync-explanation" style={styles.explanation}>{t.calendarSync.explanation}</Text>

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
              <View testID="calendar-sync-row" style={styles.settingItem}>
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
                      <Text style={styles.calendarPickerLabel}>{t.onboarding.calendarSync.google}</Text>
                      <Text style={styles.calendarPickerSubtext}>
                        {selectedProvider === 'google' && selectedCalendarId
                          ? calendars.find(c => c.id === selectedCalendarId)?.title
                          : getProviderCalendar('google')?.title}
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
                  testID="calendar-provider-apple"
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
                      <Text style={styles.calendarPickerLabel}>{t.onboarding.calendarSync.apple}</Text>
                      <Text style={styles.calendarPickerSubtext}>
                        {selectedProvider === 'apple' && selectedCalendarId
                          ? calendars.find(c => c.id === selectedCalendarId)?.title
                          : getProviderCalendar('apple')?.title}
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
                  <Text style={styles.emptyText}>{t.calendarSync.noCalendarsFound}</Text>
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
                    <Text testID="calendar-sync-status" style={styles.syncStatusText}>
                      {t.calendarSync.syncedAgo(formatLastSync(settings.lastExportTime, t, 'inSentence'))}
                      {syncedCount > 0 ? ` · ${t.calendarSync.inCalendar(syncedCount)}` : ''}
                    </Text>
                  </View>
                )}

                <GlassButton
                  testID="calendar-sync-run"
                  title={t.calendarSync.synchronize}
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

        {/* Taking back what sync did, whatever the switch says: turning it
            off only stops new runs, and what was exported stays in the
            phone's calendar, what was imported in Rehearsly (T-270). The
            imported busy times are the server's, so their button needs no
            calendar access; the exported events are in this phone's calendar,
            so theirs does. */}
        <View style={styles.section}>
          {hasPermission && (
            <TouchableOpacity
              testID="calendar-sync-remove-all"
              style={styles.removeAllButton}
              onPress={handleRemoveAll}
              disabled={isImporting || isSyncing || isRemoving || isClearing}
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
          )}
          <TouchableOpacity
            testID="calendar-sync-clear-imported"
            style={styles.removeAllButton}
            onPress={handleClearImported}
            disabled={isImporting || isSyncing || isRemoving || isClearing}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color={Colors.accent.red} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                <Text style={styles.removeAllText}>{t.calendarSync.clearImported}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
