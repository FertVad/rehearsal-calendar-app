import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSize } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { availabilityAPI } from '../../../shared/services/api';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { useTimezone } from '../../../shared/hooks/useClock';
import { weekendDaysOf, weekendDayNames } from '../../../shared/utils/weekends';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type WeekendsScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Weekends'>;

/**
 * Weekends busy by default, asked outright (T-406, the owner: "ask right
 * away: mark all weekends as busy?"). The days are the country's of the
 * profile's zone, not the language's. The answer is the profile's switch on
 * the server; skipped, the switch stays as it is for everyone — on. Under the
 * question, where it is changed later, the path as the Profile labels it.
 */
export default function WeekendsScreen({ navigation }: WeekendsScreenProps) {
  const { t, language } = useI18n();
  const { skipOnboarding } = useOnboarding();
  const timezone = useTimezone();
  const [saving, setSaving] = useState(false);
  const days = weekendDayNames(weekendDaysOf(timezone), language, t.profile.weekendDaysJoin);

  // The answer is saved before the next step: a refusal said only here and
  // lost would leave the weekends busy behind "No".
  const answer = async (enabled: boolean) => {
    setSaving(true);
    try {
      await availabilityAPI.setWeekends(enabled);
      navigation.navigate('CalendarSync');
    } catch (error) {
      Alert.alert(t.common.error, requestErrorMessage(t, error, t.profile.weekendsBusyError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      title={t.onboarding.weekends.question(days)}
      description={t.onboarding.weekends.description}
      currentStep={1}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      onNext={() => answer(true)}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.weekends.yes}
      nextButtonDisabled={saving}
      showBackButton
      secondaryAction={{ title: t.onboarding.weekends.no, onPress: () => { if (!saving) answer(false); } }}
    >
      <View style={styles.content}>
        <Text testID="onboarding-weekends-note" style={styles.note}>
          {t.onboarding.weekends.note(`${t.nav.profile} → ${t.profile.weekendsBusy}`)}
        </Text>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  note: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
