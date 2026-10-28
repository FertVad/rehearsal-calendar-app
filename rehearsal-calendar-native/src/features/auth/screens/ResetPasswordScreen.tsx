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
import { authErrorMessage } from '../utils/authErrors';
import { looksLikeEmail, meetsPasswordRule } from '../utils/accountRules';

type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

// The server sends at most one code a minute; the button waits the same.
const RESEND_INTERVAL_SECONDS = 60;

/**
 * A forgotten password, reset with a code emailed to the address (R3: A01).
 *
 * The server answers a request the same whether or not the address has an
 * account, and a code asked for too soon is simply not sent; so the screen
 * says only "if there is an account". The code is also how the owner of a
 * mailbox takes back an account someone else registered with it: a confirmed
 * reset revokes everything that was in the account and signs in.
 */
export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const { requestPasswordReset, resetPassword, forgetPendingSignIn, busy } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState(route.params?.email ?? '');
  // The address the latest code was asked for; the second step uses it.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Leaving by any way drops a reset still in flight: its late answer must
  // not sign anyone in (review R3-24). The password is reset either way.
  useEffect(() => () => forgetPendingSignIn(), [forgetPendingSignIn]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSend = async () => {
    setError(null);
    if (!looksLikeEmail(email)) {
      setError(t.auth.invalidEmail);
      return;
    }
    try {
      setSending(true);
      const address = await requestPasswordReset(email);
      setSentTo(address);
      setCode('');
      setCooldown(RESEND_INTERVAL_SECONDS);
    } catch (err) {
      setError(authErrorMessage(t, err));
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!sentTo) return;
    if (!/^\d{6}$/.test(code)) {
      setError(t.auth.codeInvalid);
      return;
    }
    if (!meetsPasswordRule(password)) {
      setError(t.auth.passwordRule);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.passwordsMismatch);
      return;
    }
    try {
      await resetPassword(sentTo, code, password);
      // Signed in: the navigator leaves the auth screens by itself.
    } catch (err) {
      setError(authErrorMessage(t, err));
    }
  };

  const leave = () => {
    forgetPendingSignIn();
    navigation.popTo('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.resetTitle}</Text>
            <Text style={styles.subtitle}>{sentTo ? t.auth.resetCodeSent(sentTo) : t.auth.resetSubtitle}</Text>
          </View>

          <View style={styles.form}>
            {!sentTo ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.auth.email}</Text>
                <TextInput
                  testID="reset-email"
                  style={styles.input}
                  placeholder={t.auth.emailPlaceholder}
                  placeholderTextColor={Colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.auth.verifyCodeLabel}</Text>
                  <TextInput
                    testID="reset-code"
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
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.auth.newPassword}</Text>
                  <TextInput
                    testID="reset-password"
                    style={styles.input}
                    placeholder={t.auth.passwordMinLength}
                    placeholderTextColor={Colors.text.tertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.auth.confirmPassword}</Text>
                  <TextInput
                    testID="reset-confirm"
                    style={styles.input}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    placeholderTextColor={Colors.text.tertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!sentTo ? (
              <GlassButton
                testID="reset-send"
                title={t.auth.resetSendCode}
                onPress={handleSend}
                variant="purple"
                loading={sending}
                style={styles.registerButton}
              />
            ) : (
              <>
                <GlassButton
                  testID="reset-submit"
                  title={t.auth.resetButton}
                  onPress={handleReset}
                  variant="purple"
                  loading={busy}
                  style={styles.registerButton}
                />
                <GlassButton
                  title={cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resendCode}
                  onPress={handleSend}
                  variant="glass"
                  disabled={cooldown > 0 || sending || busy}
                  style={styles.loginButton}
                />
                <GlassButton
                  title={t.auth.otherAddress}
                  onPress={() => {
                    setError(null);
                    setSentTo(null);
                  }}
                  variant="glass"
                  disabled={busy}
                  style={styles.loginButton}
                />
              </>
            )}

            <GlassButton
              title={t.auth.backToLogin}
              onPress={leave}
              variant="glass"
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
