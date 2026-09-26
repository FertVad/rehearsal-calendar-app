import React, { useState } from 'react';
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

type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, busy, error } = useAuth();
  const { t, language } = useI18n();

  const validateForm = () => {
    if (!email || !firstName || !password || !confirmPassword) {
      Alert.alert(t.common.error, t.auth.fillAllFields);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t.common.error, t.auth.invalidEmail);
      return false;
    }

    if (password.length < 8) {
      Alert.alert(t.common.error, t.auth.passwordMinLength);
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert(t.common.error, t.auth.passwordsMismatch);
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      // No session yet: the account waits for the code just emailed (R3).
      const created = await register(email, password, firstName, lastName || undefined, language);
      navigation.navigate('VerifyEmail', { email: created.email, delivery: created.delivery });
    } catch (err) {
      if (err instanceof AuthFlowError && err.code === 'EMAIL_TAKEN') {
        Alert.alert(t.auth.emailTakenTitle, t.auth.emailTakenMessage, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.auth.loginButton, onPress: () => navigation.navigate('Login') },
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
                style={styles.input}
                placeholder={t.auth.firstNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.lastName}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.lastNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.email} {t.auth.required}</Text>
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
                placeholder={t.auth.passwordMinLength}
                placeholderTextColor={Colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.confirmPassword}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.confirmPasswordPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
              title={t.auth.registerButton}
              onPress={handleRegister}
              variant="purple"
              loading={busy}
              style={styles.registerButton}
            />

            <GlassButton
              title={t.auth.alreadyHaveAccount}
              onPress={() => navigation.navigate('Login')}
              variant="glass"
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
