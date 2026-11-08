import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, TouchTarget } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { hapticLight, hapticSuccess } from '../../../shared/utils/haptics';
import type { DeviceCalendar } from '../../../shared/types/calendar';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

import { logger } from '../../../shared/utils/logger';
type CalendarSyncScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'CalendarSync'>;

export default function CalendarSyncScreen({ navigation }: CalendarSyncScreenProps) {
  const { t } = useI18n();
  const { skipOnboarding } = useOnboarding();
  const {
    hasPermission,
    calendars,
    requestPermissions,
    updateSettings,
    settings,
  } = useCalendarSync();

  const [pickedProvider, setPickedProvider] = useState<'google' | 'apple' | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Helper to determine calendar provider
  const getCalendarProvider = (calendar: DeviceCalendar): 'google' | 'apple' | null => {
    const sourceName = calendar.source?.name?.toLowerCase() || '';

    if (sourceName.includes('gmail') || sourceName.includes('google')) {
      return 'google';
    }

    if (
      sourceName.includes('icloud') ||
      sourceName.includes('apple') ||
      sourceName.includes('local') ||
      calendar.allowsModifications
    ) {
      return 'apple';
    }

    return null;
  };

  // Helper to exclude subscription/birthday/holiday calendars
  const shouldExcludeFromImport = (calendar: DeviceCalendar): boolean => {
    const sourceName = calendar.source?.name?.toLowerCase() || '';
    const title = calendar.title?.toLowerCase() || '';

    if (sourceName.includes('subscribed') || sourceName.includes('other') || title.includes('birthday')) {
      return true;
    }

    if (title.includes('holiday') || title.includes('праздник') || title.includes('חגים')) {
      return true;
    }

    return false;
  };

  // Check if providers are available
  const hasGoogleCalendar = calendars.some(
    (c) => c.allowsModifications && getCalendarProvider(c) === 'google'
  );
  const hasAppleCalendar = calendars.some(
    (c) => c.allowsModifications && getCalendarProvider(c) === 'apple'
  );

  const calendarsOf = (provider: 'google' | 'apple' | null): DeviceCalendar[] =>
    calendars.filter(
      (c) =>
        c.allowsModifications &&
        getCalendarProvider(c) === provider &&
        !shouldExcludeFromImport(c)
    );

  // The calendar connected is the one the settings say, once saved. It was the
  // one last tapped, set before the save and kept when the save failed — and on
  // coming back to this step, none, whatever had been saved (HP05).
  const connected = settings.exportEnabled && settings.importEnabled
    ? calendars.find((c) => c.id === settings.exportCalendarId) ?? null
    : null;
  const selectedCalendarId = connected?.id ?? null;
  // The provider whose calendars are listed: the one picked here, or else the
  // connected calendar's.
  const selectedProvider = pickedProvider ?? (connected ? getCalendarProvider(connected) : null);
  const providerCalendarsList = calendarsOf(selectedProvider);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        t.onboarding.calendarSync.permissionRequired,
        t.calendarSync.permissionDeniedMessage
      );
    }
  };

  const handleSelectProvider = async (provider: 'google' | 'apple') => {
    if (!hasPermission) {
      await handleRequestPermissions();
      return;
    }

    hapticLight();

    // Get all writable calendars from this provider
    const providerCalendars = calendarsOf(provider);

    if (providerCalendars.length === 0) {
      Alert.alert(t.common.error, t.calendarSync.noWritableCalendars);
      return;
    }

    // If only 1 calendar, auto-select it — and the provider is marked only once
    // that is saved, since there is no list to choose from.
    if (providerCalendars.length === 1) {
      if (await handleSelectCalendar(providerCalendars[0].id)) setPickedProvider(provider);
    } else {
      setPickedProvider(provider);
    }
  };

  const handleSelectCalendar = async (calendarId: string): Promise<boolean> => {
    try {
      setIsSettingUp(true);
      hapticLight();

      // Shown as connected once saved: the settings it shows are set from
      // what was saved, and a save that fails throws before that.
      await updateSettings({
        exportEnabled: true,
        exportCalendarId: calendarId,
        importEnabled: true,
        // Single-calendar mode: sync only the picked one
        importCalendarIds: [calendarId],
        importInterval: 'always',
      });

      hapticSuccess();
      return true;
    } catch (error: any) {
      logger.error('Failed to set up calendar sync:', error);
      Alert.alert(t.common.error, requestErrorMessage(t, error, t.calendarSync.syncError));
      return false;
    } finally {
      setIsSettingUp(false);
    }
  };

  // No longer the last step: the reason to allow notifications is easier to
  // make right after the person has just seen what the app does with time.
  const handleNext = () => {
    navigation.navigate('Notifications');
  };

  return (
    <OnboardingStep
      title={t.onboarding.calendarSync.title}
      description={t.onboarding.calendarSync.description}
      currentStep={1}
      totalSteps={4}
      onBack={handleBack}
      onNext={handleNext}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.calendarSync.next}
      nextButtonDisabled={isSettingUp}
      showBackButton={true}
      // Nothing to set up once a calendar is connected. The note is the path
      // as the Profile labels it, so it can be found there by its words.
      secondaryAction={selectedCalendarId ? undefined : {
        title: t.onboarding.calendarSync.setupLater,
        onPress: handleNext,
        note: t.onboarding.calendarSync.laterWhere(`${t.nav.profile} → ${t.calendarSync.title}`),
      }}
    >
      {/* Two sentences above — what the company sees, and what picking a
          calendar does — then this card. The privacy promise is said there
          once; it was a box of its own and the description again (T-022).
          Its id says whether a calendar is connected, as saved (HP05). */}
      <View
        testID={selectedCalendarId ? 'onboarding-calendar-connected' : 'onboarding-calendar-card'}
        style={styles.content}
      >
        {!hasPermission ? (
          <View style={styles.permissionCard}>
            <Ionicons name="calendar-outline" size={48} color={Colors.accent.purple} />
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={handleRequestPermissions}
            >
              <Text style={styles.permissionButtonText}>
                {t.onboarding.calendarSync.grantPermission}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.providersContainer}>
            {/* Google Calendar */}
            {hasGoogleCalendar && (
              <TouchableOpacity
                style={[
                  styles.providerButton,
                  selectedProvider === 'google' && styles.providerButtonSelected,
                ]}
                onPress={() => handleSelectProvider('google')}
                disabled={isSettingUp}
              >
                <View style={styles.providerLeft}>
                  <View style={[styles.providerIcon, { backgroundColor: '#DB4437' }]}>
                    <Ionicons name="logo-google" size={28} color="#fff" />
                  </View>
                  <Text style={styles.providerLabel}>{t.onboarding.calendarSync.google}</Text>
                </View>
                {selectedProvider === 'google' && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
                )}
              </TouchableOpacity>
            )}

            {/* Apple Calendar */}
            {hasAppleCalendar && (
              <TouchableOpacity
                style={[
                  styles.providerButton,
                  selectedProvider === 'apple' && styles.providerButtonSelected,
                ]}
                onPress={() => handleSelectProvider('apple')}
                disabled={isSettingUp}
              >
                <View style={styles.providerLeft}>
                  <View style={[styles.providerIcon, { backgroundColor: '#000' }]}>
                    <Ionicons name="logo-apple" size={28} color="#fff" />
                  </View>
                  <Text style={styles.providerLabel}>{t.onboarding.calendarSync.apple}</Text>
                </View>
                {selectedProvider === 'apple' && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
                )}
              </TouchableOpacity>
            )}

            {/* Calendar picker (when provider has multiple calendars) */}
            {selectedProvider && providerCalendarsList.length > 1 && (
              <View style={styles.calendarListContainer}>
                <Text style={styles.calendarListTitle}>{t.calendarSync.chooseCalendar}</Text>
                {providerCalendarsList.map((cal) => (
                  <TouchableOpacity
                    key={cal.id}
                    style={[
                      styles.calendarItem,
                      selectedCalendarId === cal.id && styles.calendarItemSelected,
                    ]}
                    onPress={() => handleSelectCalendar(cal.id)}
                    disabled={isSettingUp}
                  >
                    <View style={styles.calendarItemLeft}>
                      <View style={[styles.calendarDot, { backgroundColor: cal.color || Colors.accent.purple }]} />
                      <Text style={styles.calendarItemLabel}>{cal.title}</Text>
                    </View>
                    {selectedCalendarId === cal.id && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.accent.green} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!hasGoogleCalendar && !hasAppleCalendar && (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>{t.onboarding.calendarSync.noCalendars}</Text>
              </View>
            )}

            {isSettingUp && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent.purple} />
                <Text style={styles.loadingText}>{t.onboarding.calendarSync.settingUp}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
  permissionCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    gap: 16,
  },
  permissionButton: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent.purpleFill,
    borderRadius: BorderRadius.md,
  },
  permissionButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: '#fff',
  },
  providersContainer: {
    gap: 16,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.bg.secondary,
  },
  providerButtonSelected: {
    borderColor: Colors.accent.green,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  providerIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  calendarListContainer: {
    gap: 8,
  },
  calendarListTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  calendarItemSelected: {
    borderColor: Colors.accent.green,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  calendarItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calendarItemLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
});
