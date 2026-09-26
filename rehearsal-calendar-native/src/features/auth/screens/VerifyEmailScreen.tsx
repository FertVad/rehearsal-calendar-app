import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../shared/constants/colors';
import { GlassButton } from '../../../shared/components';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { AuthStackParamList } from '../../../navigation';
import { registerScreenStyles as styles } from '../styles';
import { AuthFlowError, authErrorMessage, DeliveryOutcome } from '../utils/authErrors';

type VerifyEmailScreenProps = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

// The server allows one code a minute; the button waits the same.
const RESEND_INTERVAL_SECONDS = 60;

/**
 * Entering the emailed code that confirms the address (R3). Reached after
 * registering (a code was just sent) or after signing in to an account whose
 * address still waits (no code was sent now; it may have expired). The
 * password stays in AuthContext's memory; after an app restart there is none,
 * and the person signs in again to get here.
 */
export default function VerifyEmailScreen({ navigation, route }: VerifyEmailScreenProps) {
  const { pendingEmail, confirmEmail, resendConfirmation, forgetPendingSignIn, busy } = useAuth();
  const { t } = useI18n();
  const fromRegistration = route.params.delivery !== undefined;
  // What happened to the latest email, if one was sent from here: 'sent' is the
  // only outcome that lets the screen say a code went out (review R3-26).
  const [delivery, setDelivery] = useState<DeliveryOutcome | undefined>(route.params.delivery);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(deliveryNotice(route.params.delivery));
  const [cooldown, setCooldown] = useState(fromRegistration ? RESEND_INTERVAL_SECONDS : 0);

  // Leaving by any way — the button, a swipe, the system back — drops a
  // confirmation still in flight: its late answer must not sign anyone in
  // (review R3-24). After a confirmed code the session has already started.
  useEffect(() => () => forgetPendingSignIn(), [forgetPendingSignIn]);

  function deliveryNotice(delivery?: DeliveryOutcome): string | null {
    if (delivery === 'failed') return t.auth.deliveryFailed;
    if (delivery === 'unknown') return t.auth.deliveryUnknown;
    return null;
  }

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleConfirm = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t.auth.codeInvalid);
      return;
    }
    try {
      await confirmEmail(code);
      // Signed in: the navigator leaves the auth screens by itself.
    } catch (err) {
      // Nothing more to do here with these: sign in (again) instead.
      if (err instanceof AuthFlowError && (err.code === 'ALREADY_VERIFIED' || err.code === 'SIGN_IN_AGAIN' || err.status === 401)) {
        forgetPendingSignIn();
      }
      setError(authErrorMessage(t, err));
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      const outcome = await resendConfirmation();
      if (!outcome) return; // left meanwhile
      setDelivery(outcome);
      setNotice(deliveryNotice(outcome) ?? t.auth.codeResent);
      setCode('');
      setCooldown(RESEND_INTERVAL_SECONDS);
    } catch (err) {
      if (err instanceof AuthFlowError && err.code === 'RATE_LIMITED') {
        setCooldown(err.details.retryAfter ?? RESEND_INTERVAL_SECONDS);
      }
      if (err instanceof AuthFlowError && (err.code === 'ALREADY_VERIFIED' || err.code === 'SIGN_IN_AGAIN' || err.status === 401)) {
        forgetPendingSignIn();
      }
      setError(authErrorMessage(t, err));
    }
  };

  if (!pendingEmail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.verifyTitle}</Text>
            <Text style={styles.subtitle}>{error ?? t.auth.signInAgainToConfirm}</Text>
          </View>
          <GlassButton
            title={t.auth.backToLogin}
            onPress={() => navigation.navigate('Login')}
            variant="purple"
            style={styles.registerButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.verifyTitle}</Text>
            <Text style={styles.subtitle}>
              {delivery === 'sent' ? t.auth.verifySubtitle(pendingEmail)
                : delivery ? t.auth.verifySubtitleUnsent(pendingEmail)
                  : t.auth.emailNotVerified}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.verifyCodeLabel}</Text>
              <TextInput
                testID="verify-code"
                style={styles.input}
                placeholder={t.auth.verifyCodePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
              />
            </View>

            {notice && <Text style={styles.subtitle}>{notice}</Text>}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <GlassButton
              title={t.auth.verifyButton}
              onPress={handleConfirm}
              variant="purple"
              loading={busy}
              style={styles.registerButton}
            />

            <GlassButton
              title={cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resendCode}
              onPress={handleResend}
              variant="glass"
              disabled={cooldown > 0 || busy}
              style={styles.loginButton}
            />

            <GlassButton
              title={t.auth.backToLogin}
              onPress={() => {
                forgetPendingSignIn();
                navigation.navigate('Login');
              }}
              variant="glass"
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
