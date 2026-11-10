import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, FontSize, FontWeight } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { phoneWeekStart } from '../../../hooks/useWeekStart';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type WhatWhereScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'WhatWhere'>;

/**
 * The last step: where each thing is, so the calendar that follows is not a
 * blank screen with no way on (HIG writing: "Provide clear next steps on any
 * blank screens"). Every place is named in the labels the app shows there —
 * the "+" sheet, the projects tab, the planner's button — taken from the same
 * translations, so the step cannot say one thing and the app another (T-022).
 */
export default function WhatWhereScreen({ navigation }: WhatWhereScreenProps) {
  const { t } = useI18n();
  const { updateUser } = useAuth();
  const { completeOnboarding, skipOnboarding, isCompleting } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);
  const w = t.onboarding.whatWhere;

  const rows: Array<{ id: string; icon: keyof typeof Ionicons.glyphMap; label: string; where: string }> = [
    {
      id: 'project',
      icon: 'add-circle',
      label: w.project,
      where: w.projectWhere(t.actionSheet.createProject, t.nav.projects, t.projects.haveInvite),
    },
    { id: 'rehearsal', icon: 'add-circle', label: w.rehearsal, where: w.rehearsalWhere(t.actionSheet.createRehearsal) },
    { id: 'availability', icon: 'add-circle', label: w.availability, where: w.availabilityWhere(t.actionSheet.markBusy) },
    { id: 'planner', icon: 'bulb', label: w.planner, where: w.plannerWhere(t.smartPlanner.title) },
  ];

  // The week starts where the phone's region starts it; this is where the
  // week-start step used to write its answer, and it is written here once.
  // The profile changes it afterwards, as before.
  const handleStart = async () => {
    try {
      setIsSaving(true);
      await updateUser({ weekStartDay: phoneWeekStart() });
      await completeOnboarding();
    } catch (error) {
      Alert.alert(t.common.error, requestErrorMessage(t, error, t.profile.updateError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStep
      title={w.title}
      currentStep={3}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onNext={handleStart}
      onSkip={skipOnboarding}
      nextButtonTitle={w.start}
      nextButtonDisabled={isSaving || isCompleting}
      showBackButton
    >
      <View style={styles.content}>
        {rows.map((row) => (
          <View key={row.id} testID={`what-where-${row.id}`} style={styles.row}>
            <Ionicons name={row.icon} size={28} color={Colors.accent.purple} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowWhere}>{row.where}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  rowWhere: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
});
