import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';
import { hapticLight, hapticSuccess } from '../../../shared/utils/haptics';
import type { DeviceCalendar } from '../../../shared/types/calendar';

type OnboardingStackParamList = {
  Welcome: undefined;
  WeekStart: undefined;
  CalendarSync: undefined;
};

type CalendarSyncScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'CalendarSync'>;

export default function CalendarSyncScreen({ navigation }: CalendarSyncScreenProps) {
  const { t } = useI18n();
  const { completeOnboarding, skipOnboarding, isCompleting } = useOnboarding();
  const {
    hasPermission,
    calendars,
    requestPermissions,
    updateSettings,
    settings,
  } = useCalendarSync();

  const [selectedProvider, setSelectedProvider] = useState<'google' | 'apple' | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [providerCalendarsList, setProviderCalendarsList] = useState<DeviceCalendar[]>([]);
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

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        t.onboarding.calendarSync.permissionRequired,
        'Calendar access is required to sync rehearsals'
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
    const providerCalendars = calendars.filter(
      (c) =>
        c.allowsModifications &&
        getCalendarProvider(c) === provider &&
        !shouldExcludeFromImport(c)
    );

    if (providerCalendars.length === 0) {
      Alert.alert(
        t.common.error,
        `No writable ${provider === 'google' ? 'Google' : 'Apple'} calendar found`
      );
      return;
    }

    setSelectedProvider(provider);
    setProviderCalendarsList(providerCalendars);

    // If only 1 calendar, auto-select it
    if (providerCalendars.length === 1) {
      await handleSelectCalendar(providerCalendars[0].id, providerCalendars);
    } else {
      setSelectedCalendarId(null);
    }
  };

  const handleSelectCalendar = async (calendarId: string, cals?: DeviceCalendar[]) => {
    try {
      setIsSettingUp(true);
      hapticLight();

      setSelectedCalendarId(calendarId);

      await updateSettings({
        exportEnabled: true,
        exportCalendarId: calendarId,
        importEnabled: true,
        // Single-calendar mode: sync only the picked one
        importCalendarIds: [calendarId],
        importInterval: 'always',
        lastExportTime: settings?.lastExportTime || null,
        lastImportTime: settings?.lastImportTime || null,
      });

      hapticSuccess();
    } catch (error: any) {
      console.error('Failed to set up calendar sync:', error);
      Alert.alert(t.common.error, error.message || 'Failed to set up calendar sync');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleFinish = async () => {
    await completeOnboarding();
  };

  return (
    <OnboardingStep
      title={t.onboarding.calendarSync.title}
      description={t.onboarding.calendarSync.description}
      currentStep={2}
      totalSteps={3}
      onBack={handleBack}
      onNext={handleFinish}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.calendarSync.finish}
      nextButtonDisabled={isCompleting || isSettingUp}
      showBackButton={true}
    >
      <View style={styles.content}>
        {!hasPermission ? (
          <View style={styles.permissionCard}>
            <Ionicons name="alert-circle" size={48} color={Colors.accent.yellow} />
            <Text style={styles.permissionText}>
              {t.onboarding.calendarSync.permissionRequired}
            </Text>
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
                <Text style={styles.emptyText}>No calendars found</Text>
              </View>
            )}

            {isSettingUp && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent.purple} />
                <Text style={styles.loadingText}>Setting up calendar sync...</Text>
              </View>
            )}

            <Text style={styles.skipHint}>{t.onboarding.calendarSync.setupLater}</Text>
          </View>
        )}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 24,
  },
  permissionCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    gap: 16,
  },
  permissionText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent.purple,
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
  skipHint: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 24,
  },
});
