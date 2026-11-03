import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../shared/constants/colors';
import { GlassButton } from '../../../shared/components';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { AuthStackParamList } from '../../../navigation';
import { registerScreenStyles as styles } from '../styles';
import { AuthFlowError, authErrorMessage } from '../utils/authErrors';
import { looksLikeEmail, meetsPasswordRule, normalizeEmail, PASSWORD_MIN_LENGTH } from '../utils/accountRules';
import PasswordField from '../components/PasswordField';

type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword';

/** What is wrong with one field, said under it. */
function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const lastNameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmInput = useRef<TextInput>(null);
  const { register, busy, error, forgetPendingSignIn } = useAuth();
  const { t, language } = useI18n();

  // Leaving the form drops a registration still in flight: its late answer
  // must not open a code screen nobody is looking at (review R3-24).
  useEffect(() => () => forgetPendingSignIn(), [forgetPendingSignIn]);

  // An empty form is not sent: the button waits for the required fields, and
  // what else is wrong is said under its own field, not in an alert (T-015).
  const filled = firstName.trim() !== '' && email.trim() !== '' && password !== '' && confirmPassword !== '';

  // A field's problem goes as soon as the field is edited.
  const edit = (field: Field, set: (value: string) => void) => (value: string) => {
    set(value);
    setFieldErrors((errors) => (errors[field] ? { ...errors, [field]: undefined } : errors));
  };

  const validateForm = () => {
    const errors: Partial<Record<Field, string>> = {};
    if (firstName.trim().length > 100) errors.firstName = t.auth.nameInvalid;
    if (lastName.trim().length > 100) errors.lastName = t.auth.nameInvalid;
    if (!looksLikeEmail(email)) errors.email = t.auth.invalidEmail;
    if (!meetsPasswordRule(password)) errors.password = t.auth.passwordRule;
    if (password !== confirmPassword) errors.confirmPassword = t.auth.passwordsMismatch;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!filled || busy || !validateForm()) return;

    try {
      // No session yet: the account waits for the code just emailed (R3).
      const created = await register(email, password, firstName, lastName || undefined, language);
      if (!created) return; // left the form before the answer came
      navigation.navigate('VerifyEmail', { email: created.email, delivery: created.delivery });
    } catch (err) {
      if (err instanceof AuthFlowError && err.code === 'EMAIL_TAKEN') {
        // Sign in, or — when someone else registered the address — take it back
        // with a code to the mailbox (R3 contract).
        Alert.alert(t.auth.emailTakenTitle, t.auth.emailTakenMessage, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.auth.loginButton, onPress: () => navigation.popTo('Login') },
          { text: t.auth.resetPassword, onPress: () => navigation.navigate('ResetPassword', { email: normalizeEmail(email) }) },
        ]);
        return;
      }
      Alert.alert(t.auth.registerError, authErrorMessage(t, err));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.registerTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.registerSubtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.firstName} {t.auth.required}</Text>
              <TextInput
                testID="register-first-name"
                style={styles.input}
                placeholder={t.auth.firstNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={firstName}
                onChangeText={edit('firstName', setFirstName)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => lastNameInput.current?.focus()}
              />
              <FieldError message={fieldErrors.firstName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.lastName}</Text>
              <TextInput
                ref={lastNameInput}
                testID="register-last-name"
                style={styles.input}
                placeholder={t.auth.lastNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={lastName}
                onChangeText={edit('lastName', setLastName)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailInput.current?.focus()}
              />
              <FieldError message={fieldErrors.lastName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.email} {t.auth.required}</Text>
              <TextInput
                ref={emailInput}
                testID="register-email"
                style={styles.input}
                placeholder={t.auth.emailPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={email}
                onChangeText={edit('email', setEmail)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
              />
              <FieldError message={fieldErrors.email} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.password}</Text>
              <PasswordField
                ref={passwordInput}
                testID="register-password"
                style={styles.input}
                placeholder={t.auth.password}
                value={password}
                onChangeText={edit('password', setPassword)}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmInput.current?.focus()}
              />
              <Text style={styles.hint}>{t.auth.passwordHint(PASSWORD_MIN_LENGTH)}</Text>
              <FieldError message={fieldErrors.password} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.confirmPassword}</Text>
              <PasswordField
                ref={confirmInput}
                testID="register-confirm"
                style={styles.input}
                placeholder={t.auth.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChangeText={edit('confirmPassword', setConfirmPassword)}
                returnKeyType="go"
                onSubmitEditing={handleRegister}
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{authErrorMessage(t, error)}</Text>
              </View>
            )}

            <GlassButton
              testID="register-submit"
              title={t.auth.registerButton}
              onPress={handleRegister}
              variant="purple"
              loading={busy}
              disabled={!filled}
              style={styles.registerButton}
            />

            <GlassButton
              title={t.auth.alreadyHaveAccount}
              onPress={() => {
                // Back to Login while a registration is in flight: its answer
                // must open nothing. The form stays mounted under navigate(),
                // so leaving is said here, not left to the unmount (R3-28).
                forgetPendingSignIn();
                navigation.popTo('Login');
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
