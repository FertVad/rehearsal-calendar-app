/**
 * HP03 — error from a failed skip is shown to the user (red before fix).
 *
 * Alert's button callback is async but Alert itself does not await it, so any
 * throw becomes an unhandled rejection and the user sees nothing. The fix is a
 * try/catch inside the callback that calls Alert.alert with the error message.
 *
 * Red before: on unfixed code Alert.alert is called only once (confirmation),
 * not twice (confirmation + error). The second call is what this test requires.
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useOnboarding } from '../useOnboarding';

const mockUpdateUser = jest.fn();

jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ updateUser: mockUpdateUser }),
}));

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations.en,
  }),
}));

jest.mock('../../../../shared/utils/haptics', () => ({
  hapticSuccess: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows an error Alert when onboarding cannot be completed during skip (HP03)', async () => {
  mockUpdateUser.mockRejectedValue(new Error('Network error'));
  const alertMock = Alert.alert as jest.Mock;

  const { result } = renderHook(() => useOnboarding());

  // skipOnboarding shows a confirmation Alert (first call)
  act(() => { result.current.skipOnboarding(); });
  expect(alertMock).toHaveBeenCalledTimes(1);

  // Simulate the user pressing the "Yes" button
  const [, , buttons] = alertMock.mock.calls[0];
  const yesButton = buttons[0];

  // On unfixed code yesButton.onPress() rethrows and Alert is never called again.
  // On fixed code the catch block calls Alert.alert a second time with the error.
  await act(async () => {
    try { await yesButton.onPress(); } catch { /* unfixed code rethrows */ }
  });

  // Fails on unfixed code (only 1 call); passes after the fix (2 calls).
  expect(alertMock).toHaveBeenCalledTimes(2);
});
