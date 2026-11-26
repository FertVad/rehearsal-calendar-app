import { useEffect } from 'react';
import { AppState } from 'react-native';
import { noteUsageDay } from '../services/reviewPrompt';

/**
 * Counts the days the app is used on this device, for when to ask for a rating
 * (reviewPrompt.ts, T-410): on launch and on every return to the foreground,
 * so an app left open past midnight counts the new day too. On the phone only.
 */
export function useUsageDays(): void {
  useEffect(() => {
    noteUsageDay();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') noteUsageDay();
    });
    return () => subscription.remove();
  }, []);
}
