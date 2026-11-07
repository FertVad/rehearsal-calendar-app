import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthFlowError } from '../utils/authErrors';

type Listens = { addListener: (type: 'blur' | 'focus', callback: () => void) => () => void };

/**
 * The failure of this screen's own attempt, said on this screen only and only
 * while the person is on it (T-224). The AuthProvider kept one error for every
 * screen: a wrong password stayed under registration's fields, and a refused
 * registration on sign-in after going back. The screen stays mounted under the
 * next one in the stack, so leaving it is its blur, and an answer that comes
 * after the person has left is not said there either — under the fields or in
 * an alert over the next screen.
 */
export function useAttemptError(navigation: Listens) {
  const [error, setError] = useState<AuthFlowError | null>(null);
  const focused = useRef(true);

  useEffect(() => {
    const offBlur = navigation.addListener('blur', () => {
      focused.current = false;
      setError(null);
    });
    const offFocus = navigation.addListener('focus', () => {
      focused.current = true;
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);

  /** Whether the person is still on this screen — an alert is said only then. */
  const here = useCallback(() => focused.current, []);
  const fail = useCallback((failure: unknown) => {
    if (focused.current && failure instanceof AuthFlowError) setError(failure);
  }, []);
  const clear = useCallback(() => setError(null), []);

  return { error, fail, clear, here };
}
