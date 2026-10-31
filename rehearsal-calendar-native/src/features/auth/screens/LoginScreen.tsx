import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../shared/constants/colors';
import { GlassButton, GoogleSignInButton } from '../../../shared/components';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { AuthStackParamList } from '../../../navigation';
import { loginScreenStyles as styles } from '../styles';
import { AuthFlowError, authErrorMessage } from '../utils/authErrors';
import { normalizeEmail } from '../utils/accountRules';
import PasswordField from '../components/PasswordField';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useGoogleAuth, getGoogleIdToken } from '../../../shared/services/googleAuth';
import { signInWithApple, isAppleAuthAvailable } from '../../../shared/services/appleAuth';

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const passwordInput = useRef<TextInput>(null);
  const { login, loginWithGoogle, loginWithApple, busy, error } = useAuth();
  const { t } = useI18n();

  // Google OAuth
  const { request, response, promptAsync } = useGoogleAuth();

  // Sign in with Apple is iOS 13+ only — hide the button everywhere else
  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response);
    }
  }, [response]);

  // An empty form is not sent: the button waits for both fields (T-015).
  const filled = email.trim() !== '' && password !== '';

  const handleLogin = async () => {
    if (!filled || busy) return;

    try {
      await login(email, password);
      // Navigation handled by AuthProvider
    } catch (err) {
      // The password was right, the address still waits for its code (R3).
      if (err instanceof AuthFlowError && err.code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('VerifyEmail', { email: err.details.email ?? email.trim().toLowerCase() });
      }
      // Any other failure is the context's error, shown under the fields —
      // once, not again in an alert (T-015).
    }
  };

  const handleGoogleSignIn = async (response: any) => {
    try {
      setGoogleLoading(true);
      const idToken = getGoogleIdToken(response);

      if (!idToken) {
        throw new Error('Failed to get ID token from Google');
      }

      // Send to backend
      const result = await loginWithGoogle(idToken);

      // Show message if account was linked
      if (result.linked) {
        Alert.alert(
          t.auth.accountLinked,
          t.auth.googleAccountLinkedToExisting
        );
      }

      // Navigation handled by AuthProvider
    } catch (err: any) {
      Alert.alert(t.auth.googleSignInError, authErrorMessage(t, err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      const credential = await signInWithApple();

      // User dismissed the Apple sheet — leave the screen untouched.
      if (!credential) return;

      const result = await loginWithApple(credential.identityToken, credential.user);

      if (result.linked) {
        Alert.alert(t.auth.accountLinked, t.auth.appleAccountLinkedToExisting);
      }

      // Navigation handled by AuthProvider
    } catch (err: any) {
      Alert.alert(t.auth.appleSignInError, authErrorMessage(t, err));
    } finally {
      setAppleLoading(false);
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
          <View style={styles.main}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.auth.loginTitle}</Text>
              <Text style={styles.subtitle}>{t.auth.loginSubtitle}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.auth.email}</Text>
                <TextInput
                  testID="login-email"
                  style={styles.input}
                  placeholder={t.auth.emailPlaceholder}
                  placeholderTextColor={Colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordInput.current?.focus()}
                />
              </View>

              <View style={styles.passwordGroup}>
                <Text style={styles.label}>{t.auth.password}</Text>
                <PasswordField
                  ref={passwordInput}
                  testID="login-password"
                  style={styles.input}
                  placeholder={t.auth.password}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  testID="login-forgot-password"
                  style={styles.forgotLink}
                  onPress={() => navigation.navigate('ResetPassword', { email: normalizeEmail(email) })}
                >
                  <Text style={styles.linkText}>{t.auth.forgotPassword}</Text>
                </TouchableOpacity>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{authErrorMessage(t, error)}</Text>
                </View>
              )}

              <GlassButton
                testID="login-submit"
                title={t.auth.loginButton}
                onPress={handleLogin}
                variant="purple"
                loading={busy}
                disabled={!filled}
                style={styles.loginButton}
              />

              {/* OAuth Buttons */}
              <View style={styles.oauthContainer}>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t.auth.orContinueWith}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <GoogleSignInButton
                  title={t.auth.signInWithGoogle}
                  onPress={() => promptAsync()}
                  loading={googleLoading}
                  disabled={!request || busy || googleLoading}
                  style={styles.oauthButton}
                />

                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                  />
                )}

                {appleLoading && (
                  <ActivityIndicator color={Colors.accent.purple} style={styles.oauthButton} />
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity
            testID="login-register"
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>{t.auth.noAccount}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
