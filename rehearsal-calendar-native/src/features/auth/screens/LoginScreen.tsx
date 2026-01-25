import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../shared/constants/colors';
import { GlassButton } from '../../../shared/components';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { AuthStackParamList } from '../../../navigation';
import { loginScreenStyles as styles } from '../styles';
import { useGoogleAuth, getGoogleIdToken } from '../../../shared/services/googleAuth';

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle, loading, error } = useAuth();
  const { t } = useI18n();

  // Google OAuth
  const { request, response, promptAsync } = useGoogleAuth();

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response);
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.common.error, t.auth.fillAllFields);
      return;
    }

    try {
      await login(email, password);
      // Navigation handled by AuthProvider
    } catch (err: any) {
      Alert.alert(t.auth.loginError, err.message);
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
      Alert.alert(t.auth.googleSignInError, err.message);
    } finally {
      setGoogleLoading(false);
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
            <Text style={styles.title}>{t.auth.loginTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.loginSubtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.email}</Text>
              <TextInput
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.password}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.passwordPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <GlassButton
              title={t.auth.loginButton}
              onPress={handleLogin}
              variant="purple"
              loading={loading}
              style={styles.loginButton}
            />

            <GlassButton
              title={t.auth.createAccount}
              onPress={() => navigation.navigate('Register')}
              variant="glass"
              style={styles.registerButton}
            />

            {/* OAuth Buttons */}
            <View style={styles.oauthContainer}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t.auth.orContinueWith}</Text>
                <View style={styles.dividerLine} />
              </View>

              <GlassButton
                title={t.auth.signInWithGoogle}
                onPress={() => promptAsync()}
                variant="glass"
                loading={googleLoading}
                disabled={!request || loading || googleLoading}
                style={styles.oauthButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
