import { useEffect } from 'react';
import { AppState } from 'react-native';
import { appVersionAPI } from '../services/api';

/**
 * Asks the server whether this build is still answered: on launch, before
 * anyone signs in, and on every return to the foreground (T-265). The answer
 * goes through the API client's interceptor, which puts the update screen up
 * on 426 UPDATE_REQUIRED and takes it down on a 200 — the minimum lowered while
 * the app was away. No answer at all changes nothing: offline is not "too old".
 */
export function useAppVersionCheck(): void {
  useEffect(() => {
    const check = () => {
      appVersionAPI.check().catch(() => undefined);
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, []);
}
