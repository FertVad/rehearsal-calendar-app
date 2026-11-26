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

const mockI18n: { t?: unknown; language: string } = { language: 'en' };
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: mockI18n.t ?? require('../../../../i18n/translations').translations[mockI18n.language],
    language: mockI18n.language,
  }),
}));

jest.mock('../../../../shared/utils/haptics', () => ({
  hapticSuccess: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockI18n.t = undefined;
  mockI18n.language = 'en';
});

/**
 * T-417: the "Skip" alert is typeset as a step's text is — no short word at a
 * line's end, no line begun by "→" — in the app's language. Alert.alert took
 * the strings as they were: "…Профиль / → Настройки." on iOS 26.
 */
it('typesets the "Skip" alert\'s title and message in the app\'s language (T-417)', () => {
  const { translations } = require('../../../../i18n/translations');
  const ru = translations.ru;
  mockI18n.language = 'ru';
  mockI18n.t = { ...ru, onboarding: { ...ru.onboarding, skipTitle: 'Это в профиле', skipMessage: 'Можно и так: Профиль → Настройки.' } };
  const { result } = renderHook(() => useOnboarding());

  act(() => { result.current.skipOnboarding(); });

  const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(title).toBe('Это в\u00a0профиле');
  expect(message).toBe('Можно и\u00a0так: Профиль\u00a0→ Настройки.');
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
