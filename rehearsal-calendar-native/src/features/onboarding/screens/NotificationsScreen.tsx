import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingStep } from '../components';
import { registerForPushNotifications } from '../../../shared/services/notifications';
import { hapticLight } from '../../../shared/utils/haptics';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type NotificationsScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Notifications'>;

/**
 * Asks for the push permission with a reason attached.
 *
 * iOS grants exactly one system prompt: a refusal can only be undone in
 * Settings, which nobody does. It used to fire from the tab navigator the
 * instant onboarding finished, cold and unexplained — so this screen exists to
 * spend that single prompt on someone who knows what they are agreeing to.
 */
export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { t } = useI18n();
  const { skipOnboarding } = useOnboarding();
  const [asking, setAsking] = useState(false);

  const goOn = () => navigation.navigate('WeekStart');

  const handleAllow = async () => {
    hapticLight();
    setAsking(true);
    try {
      await registerForPushNotifications();
    } catch {
      // A refusal is an answer, not a failure — carry on either way.
    } finally {
      setAsking(false);
      goOn();
    }
  };

  return (
    <OnboardingStep
      title={t.onboarding.notifications.title}
      description={t.onboarding.notifications.description}
      currentStep={2}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onNext={handleAllow}
      onSkip={skipOnboarding}
      nextButtonTitle={t.onboarding.notifications.allow}
      nextButtonDisabled={asking}
      showBackButton
      secondaryAction={{ title: t.onboarding.notifications.later, onPress: goOn }}
    >
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={56} color={Colors.accent.purple} />
        </View>

        <View style={styles.row}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent.green} />
          <Text style={styles.rowText}>{t.rehearsals.addRehearsal}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={20} color={Colors.accent.yellow} />
          <Text style={styles.rowText}>{t.rehearsals.updateRehearsal}</Text>
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.bg.secondary,
  },
  rowText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
});
