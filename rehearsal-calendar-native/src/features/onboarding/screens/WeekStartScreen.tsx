import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep, WeekPreview } from '../components';
import { hapticLight } from '../../../shared/utils/haptics';

type OnboardingStackParamList = {
  Welcome: undefined;
  WeekStart: undefined;
  CalendarSync: undefined;
};

type WeekStartScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'WeekStart'>;

const WEEK_START_OPTIONS = [
  { value: 'monday' as const, icon: 'calendar-outline' as const },
  { value: 'sunday' as const, icon: 'calendar-outline' as const },
] as const;

export default function WeekStartScreen({ navigation }: WeekStartScreenProps) {
  const { t } = useI18n();
  const { updateUser } = useAuth();
  const { skipOnboarding } = useOnboarding();
  const [selectedWeekStart, setSelectedWeekStart] = useState<'monday' | 'sunday'>('monday');
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = async () => {
    try {
      setIsSaving(true);
      await updateUser({ weekStartDay: selectedWeekStart });
      navigation.navigate('CalendarSync');
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || 'Failed to save week start preference');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStep
      title={t.onboarding.weekStart.title}
      description={t.onboarding.weekStart.description}
      currentStep={1}
      totalSteps={3}
      onBack={handleBack}
      onNext={handleNext}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.weekStart.next}
      nextButtonDisabled={isSaving}
      showBackButton={true}
    >
      <View style={styles.content}>
        {/* Options */}
        {WEEK_START_OPTIONS.map((option) => {
          const isSelected = selectedWeekStart === option.value;
          const label = option.value === 'monday'
            ? t.onboarding.weekStart.monday
            : t.onboarding.weekStart.sunday;

          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => {
                hapticLight();
                setSelectedWeekStart(option.value);
              }}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.15)' : Colors.bg.tertiary },
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={isSelected ? Colors.accent.purple : Colors.text.secondary}
                  />
                </View>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {label}
                </Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.accent.purple} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Week Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview:</Text>
          <WeekPreview weekStart={selectedWeekStart} />
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 24,
    gap: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.bg.secondary,
  },
  optionButtonSelected: {
    borderColor: Colors.accent.purple,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  optionLabelSelected: {
    color: Colors.accent.purple,
  },
  previewSection: {
    marginTop: 24,
  },
  previewTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
});
