import React, { useState, useEffect } from 'react';
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
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { joinProjectScreenStyles as styles } from '../styles';

type JoinProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'JoinProject'>;

export default function JoinProjectScreen({ route, navigation }: JoinProjectScreenProps) {
  // Arriving from an invite link brings the code with it. Reached from the
  // create sheet it does not, and the screen asks for one — otherwise a link
  // that fails to open leaves a person with no way into the project at all.
  const linkCode = route.params?.code;
  const { refreshProjects } = useProjects();
  const { t } = useI18n();

  const [code, setCode] = useState(linkCode ?? '');
  const [typedCode, setTypedCode] = useState('');
  const [loading, setLoading] = useState(Boolean(linkCode));
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<{
    projectId: string;
    projectName: string;
    projectDescription?: string;
  } | null>(null);

  useEffect(() => {
    if (!code) return;
    checkAndFetchInviteInfo();
  }, [code]);

  const handleSubmitCode = () => {
    const entered = typedCode.trim();
    if (!entered) return;
    setError(null);
    setLoading(true);
    // Pasting the whole link is the likelier gesture than copying the code out
    // of it, so take the last path segment when one is given.
    const fromUrl = entered.match(/\/invite\/([^/?#\s]+)/i);
    setCode(fromUrl ? fromUrl[1] : entered);
  };

  const checkAndFetchInviteInfo = async () => {
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
      await fetchInviteInfo();
    } catch (err) {
      console.error('Error checking logout time:', err);
      // If check fails, proceed anyway
      await fetchInviteInfo();
    }
  };

  const fetchInviteInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await invitesAPI.getInviteInfo(code);
      setProjectInfo(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(t.projects.inviteNotFound);
      } else if (err.response?.status === 410) {
        setError(t.projects.inviteExpired);
      } else {
        setError(t.projects.inviteLoadError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      setJoining(true);
      await invitesAPI.joinProject(code);
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
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // No code yet — ask for one
  if (!code) {
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
            style={styles.codeInput}
            value={typedCode}
            onChangeText={setTypedCode}
            placeholder={t.projects.joinByCodePlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleSubmitCode}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSubmitCode}
              disabled={!typedCode.trim()}
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                {t.projects.join}
              </Text>
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
            style={styles.button}
            onPress={linkCode ? handleCancel : () => { setCode(''); setError(null); }}
          >
            <Text style={styles.buttonText}>
              {linkCode ? t.projects.close : t.projects.tryAgain}
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
          <Text style={styles.projectName}>{projectInfo?.projectName}</Text>
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
