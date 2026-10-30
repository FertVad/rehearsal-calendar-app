import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { invitesAPI } from '../../../shared/services/api';
import { inviteCodeFromUrl } from '../../../shared/utils/inviteCode';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { joinProjectScreenStyles as styles } from '../styles';

import { logger } from '../../../shared/utils/logger';
type JoinProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'JoinProject'>;

export default function JoinProjectScreen({ route, navigation }: JoinProjectScreenProps) {
  // Arriving from an invite link brings the code with it. Reached from the
  // create sheet it does not, and the screen asks for one — otherwise a link
  // that fails to open leaves a person with no way into the project at all.
  const linkCode = route.params?.code;
  const { refreshProjects } = useProjects();
  const { t } = useI18n();

  const [typedCode, setTypedCode] = useState('');
  const [loading, setLoading] = useState(Boolean(linkCode));
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The invitation shown carries the code it was asked by, and joining sends
  // that code: a second link opened over the first showed its own project and
  // joined the first's (T-011 review).
  const [projectInfo, setProjectInfo] = useState<{
    code: string;
    projectId: string;
    projectName: string;
    projectDescription?: string;
  } | null>(null);
  // The code last asked about. An earlier answer that comes after it is not
  // shown.
  const askedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!linkCode) return;
    checkAndFetchInviteInfo(linkCode);
  }, [linkCode]);

  const handleSubmitCode = () => {
    const entered = typedCode.trim();
    if (!entered || loading) return;
    // Pasting the whole link is the likelier gesture than copying the code out
    // of it, so take the code out of a link by the same rule as opened links.
    // Asked here rather than on a change of state: the same code sent again
    // after a failure is asked again.
    fetchInviteInfo(inviteCodeFromUrl(entered) ?? entered);
  };

  const checkAndFetchInviteInfo = async (inviteCode: string) => {
    try {
      // Check if user logged out recently (within last 5 seconds)
      const lastLogoutTime = await AsyncStorage.getItem('lastLogoutTime');
      if (lastLogoutTime) {
        const timeSinceLogout = Date.now() - parseInt(lastLogoutTime, 10);
        if (timeSinceLogout < 5000) {
          // This is a stale invite link from before logout, ignore it
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
          return;
        }
      }

      // Proceed with fetching invite info
      await fetchInviteInfo(inviteCode);
    } catch (err) {
      logger.error('Error checking logout time:', err);
      // If check fails, proceed anyway
      await fetchInviteInfo(inviteCode);
    }
  };

  const fetchInviteInfo = async (inviteCode: string) => {
    askedCode.current = inviteCode;
    const isLatest = () => askedCode.current === inviteCode;
    try {
      setLoading(true);
      setError(null);
      setProjectInfo(null);
      const response = await invitesAPI.getInviteInfo(inviteCode);
      if (!isLatest()) return;
      setProjectInfo({ ...response.data, code: inviteCode });
    } catch (err: any) {
      if (!isLatest()) return;
      if (err.response?.status === 404) {
        setError(t.projects.inviteNotFound);
      } else if (err.response?.status === 410) {
        setError(t.projects.inviteExpired);
      } else {
        setError(t.projects.inviteLoadError);
      }
    } finally {
      if (isLatest()) setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!projectInfo) return;
    try {
      setJoining(true);
      await invitesAPI.joinProject(projectInfo.code);
      await refreshProjects();

      // Clear the lastLogoutTime flag after successful join
      await AsyncStorage.removeItem('lastLogoutTime');

      // Navigate to the project
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      if (err.response?.status === 400) {
        // User is already a member - just navigate to app
        await AsyncStorage.removeItem('lastLogoutTime');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        setError(err.response?.data?.error || t.projects.joinError);
        // A typed code goes back to its field, the error under it.
        if (!linkCode) setProjectInfo(null);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // No link — ask for a code until one names a project. A code that does not
  // stays in the field with the error under it, to be corrected.
  if (!linkCode && !projectInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="key-outline" size={64} color={Colors.accent.purple} />
          </View>

          <Text style={styles.title}>{t.projects.joinByCode}</Text>
          <Text style={styles.subtitle}>{t.projects.joinByCodeSubtitle}</Text>

          <TextInput
            testID="join-code-input"
            style={[styles.codeInput, error && styles.codeInputError]}
            value={typedCode}
            onChangeText={(text) => {
              setTypedCode(text);
              setError(null);
            }}
            placeholder={t.projects.joinByCodePlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleSubmitCode}
          />
          {error && (
            <Text testID="join-code-error" style={styles.codeError}>
              {error}
            </Text>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="join-code-submit"
              style={[styles.button, styles.primaryButton]}
              onPress={handleSubmitCode}
              disabled={!typedCode.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  {t.projects.join}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleCancel}
            >
              <Text style={styles.secondaryButtonText}>{t.projects.cancel}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
          <Text style={styles.loadingText}>{t.projects.loadingInvite}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={64} color={Colors.accent.red} />
          <Text style={styles.errorTitle}>{t.projects.error}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleCancel}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              {t.projects.close}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={64} color={Colors.accent.purple} />
        </View>

        <Text style={styles.title}>{t.projects.projectInvitation}</Text>

        <View style={styles.projectCard}>
          <Text testID="join-project-name" style={styles.projectName}>{projectInfo?.projectName}</Text>
          {projectInfo?.projectDescription && (
            <Text style={styles.projectDescription}>
              {projectInfo.projectDescription}
            </Text>
          )}
        </View>

        <Text style={styles.subtitle}>
          {t.projects.inviteSubtitle}
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            testID="join-project-submit"
            style={[styles.button, styles.primaryButton]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={Colors.text.inverse} />
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  {t.projects.join}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCancel}
            disabled={joining}
          >
            <Text style={styles.secondaryButtonText}>{t.projects.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
