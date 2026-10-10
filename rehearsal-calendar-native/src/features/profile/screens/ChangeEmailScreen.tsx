import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { GlassButton } from '../../../shared/components';
import { authAPI } from '../../../shared/services/api';
import { ProfileStackParamList } from '../../../navigation';
import { editProfileScreenStyles as styles } from '../styles';
import { AuthFlowError, authErrorMessage, DeliveryOutcome } from '../../auth/utils/authErrors';
import { looksLikeEmail, normalizeEmail } from '../../auth/utils/accountRules';

type ChangeEmailScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ChangeEmail'>;

// The server sends at most one code a minute; the button waits the same.
const RESEND_INTERVAL_SECONDS = 60;

type Field = 'newEmail' | 'currentPassword' | 'currentCode' | 'code';
type Sent = { to: string; delivery: { newAddress: DeliveryOutcome; currentAddress: DeliveryOutcome } };

/**
 * Changing the sign-in address (R3: HP01).
 *
 * A session is not enough to move an account: the server sends a code to the
 * current address and one to the new, and asks for the password when the
 * account has one (review R3-19). The confirmation revokes every session and
 * answers with a new pair, which the context writes; leaving the screen does
 * not cancel that.
 */
export default function ChangeEmailScreen({ navigation }: ChangeEmailScreenProps) {
  const { user, requestEmailChange, confirmEmailChange, busy } = useAuth();
  const { t } = useI18n();
  const currentEmail = user?.email ?? '';
  // Whether the account has a password to ask for: null until the sign-in
  // methods have loaded, or if they could not — then the field is shown and
  // the server, which knows, decides.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<Sent | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<{ message: string; field?: Field } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let current = true;
    authAPI.getAuthProviders()
      .then((response) => {
        const methods: { providerType: string }[] = response.data.providers ?? [];
        if (current) setHasPassword(methods.some((method) => method.providerType === 'email'));
      })
      .catch(() => undefined);
    // An answer after leaving sets nothing (CLAUDE.md 11).
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const failure = (err: unknown) => {
    const field = err instanceof AuthFlowError ? err.details.field as Field | undefined : undefined;
    if (err instanceof AuthFlowError && err.code === 'EMAIL_TAKEN') {
      return { message: t.profile.emailTakenByOther, field: 'newEmail' as Field };
    }
    return { message: authErrorMessage(t, err), field };
  };

  const handleSend = async () => {
    setError(null);
    setNotice(null);
    if (!looksLikeEmail(newEmail)) {
      setError({ message: t.auth.invalidEmail, field: 'newEmail' });
      return;
    }
    if (normalizeEmail(newEmail) === currentEmail) {
      setError({ message: t.auth.emailUnchanged, field: 'newEmail' });
      return;
    }
    if (hasPassword && !password) {
      setError({ message: t.auth.fillAllFields, field: 'currentPassword' });
      return;
    }
    const address = normalizeEmail(newEmail);
    try {
      setSending(true);
      const delivery = await requestEmailChange(address, hasPassword === false ? undefined : password || undefined);
      if (sent) setNotice(t.profile.codesSent);
      setSent({ to: address, delivery });
      setCurrentCode('');
      setCode('');
      setCooldown(RESEND_INTERVAL_SECONDS);
    } catch (err) {
      if (err instanceof AuthFlowError && err.code === 'RATE_LIMITED') {
        setCooldown(err.details.retryAfter ?? RESEND_INTERVAL_SECONDS);
      }
      setError(failure(err));
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    if (!sent) return;
    if (!/^\d{6}$/.test(currentCode)) {
      setError({ message: t.auth.codeInvalid, field: 'currentCode' });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError({ message: t.auth.codeInvalid, field: 'code' });
      return;
    }
    try {
      await confirmEmailChange(code, currentCode);
      Alert.alert(t.profile.emailChangedTitle, t.profile.emailChanged(sent.to), [
        { text: t.common.done, onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(failure(err));
    }
  };

  const deliveryNotice = (delivery: DeliveryOutcome, address: string) =>
    delivery === 'failed' ? t.profile.deliveryFailedTo(address)
      : delivery === 'unknown' ? t.profile.deliveryUnknownTo(address) : null;

  const fieldError = (field: Field) => (error?.field === field ? (
    <Text testID={`change-${fieldTestId[field]}-error`} style={styles.errorText}>{error.message}</Text>
  ) : null);

  const codeInput = (testID: string, value: string, onChange: (value: string) => void, invalid: boolean) => (
    <TextInput
      testID={testID}
      style={[styles.input, invalid && styles.inputError]}
      placeholder={t.auth.verifyCodePlaceholder}
      placeholderTextColor={Colors.text.tertiary}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      maxLength={6}
    />
  );

  const notices = sent
    ? [deliveryNotice(sent.delivery.currentAddress, currentEmail), deliveryNotice(sent.delivery.newAddress, sent.to)]
      .filter((text): text is string => text !== null)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.profile.changeEmailTitle}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.avatarHint}>{t.profile.changeEmailSubtitle(currentEmail)}</Text>

          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.profile.newEmail}</Text>
              <TextInput
                testID="change-new-email"
                style={[styles.input, error?.field === 'newEmail' && styles.inputError]}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder={t.profile.emailPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sent}
              />
              {fieldError('newEmail')}
            </View>

            {hasPassword !== false && (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>{t.profile.currentPassword}</Text>
                <TextInput
                  testID="change-password"
                  style={[styles.input, error?.field === 'currentPassword' && styles.inputError]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  placeholderTextColor={Colors.text.tertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!sent}
                />
                {fieldError('currentPassword')}
              </View>
            )}

            {sent && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>{t.profile.currentAddressCode(currentEmail)}</Text>
                  {codeInput('change-current-code', currentCode, setCurrentCode, error?.field === 'currentCode')}
                  {fieldError('currentCode')}
                </View>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>{t.profile.newAddressCode(sent.to)}</Text>
                  {codeInput('change-new-code', code, setCode, error?.field === 'code')}
                  {fieldError('code')}
                </View>
              </>
            )}

            {[...notices, ...(notice ? [notice] : [])].map((text) => (
              <Text key={text} style={styles.avatarHint}>{text}</Text>
            ))}
            {error && !error.field && <Text style={styles.errorText}>{error.message}</Text>}
          </View>

          {!sent ? (
            <GlassButton
              title={t.profile.sendCodes}
              onPress={handleSend}
              variant="purple"
              loading={sending}
              style={styles.saveButton}
            />
          ) : (
            <>
              <GlassButton
                title={t.profile.confirmChange}
                onPress={handleConfirm}
                variant="purple"
                loading={busy}
                style={styles.saveButton}
              />
              <GlassButton
                title={cooldown > 0 ? t.auth.resendIn(cooldown) : t.profile.resendCodes}
                onPress={handleSend}
                variant="glass"
                disabled={cooldown > 0 || sending || busy}
                style={styles.saveButton}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const fieldTestId: Record<Field, string> = {
  newEmail: 'new-email',
  currentPassword: 'password',
  currentCode: 'current-code',
  code: 'new-code',
};
