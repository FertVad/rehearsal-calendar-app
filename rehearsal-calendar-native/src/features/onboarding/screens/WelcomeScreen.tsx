import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { UserAvatar } from '../../../shared/components';

type OnboardingStackParamList = {
  Welcome: undefined;
  WeekStart: undefined;
  CalendarSync: undefined;
};

type WelcomeScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { skipOnboarding } = useOnboarding();

  const handleNext = () => {
    navigation.navigate('WeekStart');
  };

  return (
    <OnboardingStep
      title={t.onboarding.welcome.title}
      description={t.onboarding.welcome.description}
      currentStep={0}
      totalSteps={3}
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

        {/* Greeting */}
        <Text style={styles.greeting}>
          {user?.firstName ? `${user.firstName}!` : 'User!'}
        </Text>

        {/* App subtitle */}
        <Text style={styles.subtitle}>{t.onboarding.welcome.subtitle}</Text>

        {/* Feature list */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Ionicons name="calendar-outline" size={24} color={Colors.accent.purple} />
            </View>
            <Text style={styles.featureText}>Plan rehearsals efficiently</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="people-outline" size={24} color={Colors.accent.blue} />
            </View>
            <Text style={styles.featureText}>Collaborate with your team</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="sync-outline" size={24} color={Colors.accent.green} />
            </View>
            <Text style={styles.featureText}>Sync with your calendar</Text>
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
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
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
