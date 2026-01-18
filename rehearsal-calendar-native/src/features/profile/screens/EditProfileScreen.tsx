import React, { useState } from 'react';
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
import { GlassButton, UserAvatar } from '../../../shared/components';
import { ProfileStackParamList } from '../../../navigation';
import { editProfileScreenStyles as styles } from '../styles';
import { hapticLight, hapticSuccess } from '../../../shared/utils/haptics';

type EditProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, updateUser } = useAuth();
  const { t } = useI18n();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: { firstName?: string; email?: string } = {};

    if (!firstName.trim()) {
      newErrors.firstName = t.profile.firstNameRequired;
    }

    if (!email.trim()) {
      newErrors.email = t.profile.emailRequired;
    } else if (!validateEmail(email)) {
      newErrors.email = t.profile.emailInvalid;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      hapticLight();
      setSaving(true);

      await updateUser({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
      });

      hapticSuccess();
      Alert.alert(t.profile.profileUpdated, undefined, [
        {
          text: t.common.done,
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert(t.profile.updateError, err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    firstName.trim() !== (user?.firstName || '') ||
    lastName.trim() !== (user?.lastName || '') ||
    email.trim() !== (user?.email || '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              hapticLight();
              navigation.goBack();
            }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.profile.editProfile}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <UserAvatar
                firstName={firstName || user?.firstName || 'U'}
                lastName={lastName || user?.lastName}
                size={80}
              />
            </View>
            <Text style={styles.avatarHint}>{t.profile.avatarHint}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                {t.profile.firstName} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.firstName && styles.inputError]}
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  if (errors.firstName) {
                    setErrors({ ...errors, firstName: undefined });
                  }
                }}
                placeholder={t.profile.firstNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {errors.firstName && (
                <Text style={styles.errorText}>{errors.firstName}</Text>
              )}
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.profile.lastName}</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t.profile.lastNamePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                {t.profile.email} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) {
                    setErrors({ ...errors, email: undefined });
                  }
                }}
                placeholder={t.profile.emailPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>
          </View>

          {/* Save Button */}
          <GlassButton
            title={saving ? t.common.loading : t.profile.saveChanges}
            onPress={handleSave}
            variant="purple"
            disabled={saving || !hasChanges}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
