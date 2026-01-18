import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { hapticSuccess } from '../../../shared/utils/haptics';

export function useOnboarding() {
  const { updateUser } = useAuth();
  const { t } = useI18n();
  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboarding = async () => {
    setIsCompleting(true);
    try {
      await updateUser({ onboardingCompleted: true });
      hapticSuccess();
      // Navigation обновится автоматически через AuthContext
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    } finally {
      setIsCompleting(false);
    }
  };

  const skipOnboarding = async () => {
    // Показать Alert перед завершением
    Alert.alert(
      t.onboarding.skipTitle,
      t.onboarding.skipMessage,
      [
        {
          text: t.common.yes,
          onPress: async () => {
            await completeOnboarding();
          },
        },
      ]
    );
  };

  return { completeOnboarding, skipOnboarding, isCompleting };
}
