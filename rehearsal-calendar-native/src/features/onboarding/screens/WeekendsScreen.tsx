import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSize } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import StepText from '../components/StepText';
import { availabilityAPI } from '../../../shared/services/api';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { useTimezone } from '../../../shared/hooks/useClock';
import { weekendDaysOf, weekendDayNames } from '../../../shared/utils/weekends';
import { settingPath } from '../../../shared/utils/settingPath';
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
      // The question in its three lines, the days on one of their own: 32 pt,
      // made smaller until the longest line fits whole, never below 26 (T-412).
      titleLines={3}
      titleMinimumScale={26 / 32}
      description={t.onboarding.weekends.description}
      currentStep={1}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      onSkip={skipOnboarding}
      // Both answers at the bottom, "Yes" over "No", and neither while one is
      // being saved: "No" used to do nothing then, silently (T-412).
      answer={{ title: t.onboarding.weekends.yes, onPress: () => answer(true), disabled: saving }}
      secondAnswer={{ title: t.onboarding.weekends.no, onPress: () => answer(false), disabled: saving }}
    >
      <View style={styles.content}>
        <StepText testID="onboarding-weekends-note" style={styles.note}>
          {t.onboarding.weekends.note(settingPath(t.nav.profile, t.profile.weekendsBusy))}
        </StepText>
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
