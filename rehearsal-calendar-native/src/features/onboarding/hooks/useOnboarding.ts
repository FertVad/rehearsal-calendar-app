import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { hapticSuccess } from '../../../shared/utils/haptics';
import { typeset } from '../../../shared/utils/typeset';

import { logger } from '../../../shared/utils/logger';
export function useOnboarding() {
  const { updateUser } = useAuth();
  const { t, language } = useI18n();
  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboarding = async () => {
    setIsCompleting(true);
    try {
      await updateUser({ onboardingCompleted: true });
      hapticSuccess();
      // Navigation обновится автоматически через AuthContext
    } catch (error) {
      logger.error('Failed to complete onboarding:', error);
      throw error;
    } finally {
      setIsCompleting(false);
    }
  };

  const skipOnboarding = () => {
    // Показать Alert перед завершением.
    // Alert does not await its buttons: a throw here would be an unhandled
    // rejection the user never sees (HP03), so the error is shown right here.
    // Typeset as a step's text is: iOS wraps the alert too (T-417).
    Alert.alert(
      typeset(t.onboarding.skipTitle, language),
      typeset(t.onboarding.skipMessage, language),
      [
        {
          text: t.common.ok,
          onPress: async () => {
            try {
              await completeOnboarding();
            } catch (error) {
              Alert.alert(
                t.common.error,
                requestErrorMessage(t, error, t.profile.updateError),
              );
            }
          },
        },
      ]
    );
  };

  return { completeOnboarding, skipOnboarding, isCompleting };
}
