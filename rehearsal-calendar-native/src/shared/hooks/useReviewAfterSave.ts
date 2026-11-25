import { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { askForReviewAfterSave } from '../services/reviewPrompt';

/**
 * Called once a save went through and its screen is closing: iOS's rating
 * window, if everything in reviewPrompt.ts holds (T-410). Someone still in
 * the onboarding is never asked.
 */
export function useReviewAfterSave(): () => void {
  const { user } = useAuth();
  const onboardingCompleted = user?.onboardingCompleted === true;
  return useCallback(() => askForReviewAfterSave(onboardingCompleted), [onboardingCompleted]);
}
