import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { UserAvatar } from '../../../shared/components';

type WelcomeScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { skipOnboarding } = useOnboarding();

  const handleNext = () => {
    navigation.navigate('CalendarSync');
  };

  return (
    <OnboardingStep
      // One line with the name in it; it was "Welcome!", then the name, then
      // "Rehearsly", each on a line of its own (T-022).
      title={t.onboarding.welcome.greeting(user?.firstName || undefined)}
      description={t.onboarding.welcome.description}
      currentStep={0}
      totalSteps={4}
      onNext={handleNext}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.welcome.next}
      showBackButton={false}
    >
      <View style={styles.content}>
        {/* User Avatar */}
        <View style={styles.avatarContainer}>
          <UserAvatar
            firstName={user?.firstName || 'U'}
            lastName={user?.lastName}
            size={100}
          />
        </View>

        {/* Feature list */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
              <Ionicons name="calendar-outline" size={24} color={Colors.accent.purple} />
            </View>
            <Text style={styles.featureText}>{t.onboarding.welcome.feature1}</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: Colors.accent.purpleAlpha15 }]}>
              <Ionicons name="people-outline" size={24} color={Colors.accent.purple} />
            </View>
            <Text style={styles.featureText}>{t.onboarding.welcome.feature2}</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="sync-outline" size={24} color={Colors.accent.green} />
            </View>
            <Text style={styles.featureText}>{t.onboarding.welcome.feature3}</Text>
          </View>
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingTop: 24,
  },
  avatarContainer: {
    marginBottom: 40,
  },
  featuresList: {
    width: '100%',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
});
