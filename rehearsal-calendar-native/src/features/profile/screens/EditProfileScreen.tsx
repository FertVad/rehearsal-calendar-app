import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../shared/constants/colors';
import { ScreenHeader, HeaderTextButton } from '../../../shared/components/ScreenHeader';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { GlassButton, UserAvatar } from '../../../shared/components';
import { ProfileStackParamList } from '../../../navigation';
import { editProfileScreenStyles as styles } from '../styles';
import { hapticLight, hapticSuccess } from '../../../shared/utils/haptics';
import { authErrorMessage } from '../../auth/utils/authErrors';

type EditProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, updateUser } = useAuth();
  const { t } = useI18n();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { firstName?: string } = {};

    if (!firstName.trim()) {
      newErrors.firstName = t.profile.firstNameRequired;
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

      // An empty last name clears it; undefined would leave the old one (HP02).
      // The address is not sent: it changes on its own screen (HP01).
      await updateUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      hapticSuccess();
      Alert.alert(t.profile.profileUpdated, undefined, [
        {
          text: t.common.done,
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert(t.profile.updateError, authErrorMessage(t, err));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    firstName.trim() !== (user?.firstName || '') ||
    lastName.trim() !== (user?.lastName || '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* A sheet (T-029): Cancel on the left, Save on the right, where
            iOS puts Done (HIG sheets.md). */}
        <ScreenHeader
          kind="modal"
          title={t.profile.editProfile}
          cancelLabel={t.common.cancel}
          onCancel={() => {
            hapticLight();
            navigation.goBack();
          }}
          right={
            <HeaderTextButton
              testID="profile-save"
              label={saving ? t.common.loading : t.common.save}
              onPress={handleSave}
              disabled={saving || !hasChanges}
            />
          }
        />

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

            {/* Email: read only here — a new address needs a code to each (HP01) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.profile.email}</Text>
              <Text testID="profile-email" style={styles.input}>{user?.email}</Text>
              <GlassButton
                testID="profile-change-email"
                title={t.profile.changeEmail}
                onPress={() => {
                  hapticLight();
                  navigation.navigate('ChangeEmail');
                }}
                variant="glass"
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
