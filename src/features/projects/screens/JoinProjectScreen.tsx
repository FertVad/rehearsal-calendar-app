import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { invitesAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';

type JoinProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'JoinProject'>;

export default function JoinProjectScreen({ route, navigation }: JoinProjectScreenProps) {
  const { code } = route.params;
  const { refreshProjects } = useProjects();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<{
    projectId: string;
    projectName: string;
    projectDescription?: string;
  } | null>(null);

  useEffect(() => {
    checkAndFetchInviteInfo();
  }, [code]);

  const checkAndFetchInviteInfo = async () => {
    try {
      // Check if user logged out recently (within last 5 seconds)
      const lastLogoutTime = await AsyncStorage.getItem('lastLogoutTime');
      if (lastLogoutTime) {
        const timeSinceLogout = Date.now() - parseInt(lastLogoutTime, 10);
        if (timeSinceLogout < 5000) {
          // This is a stale invite link from before logout, ignore it
          console.log('Ignoring stale invite link from previous session');
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
        setError('Приглашение не найдено');
      } else if (err.response?.status === 410) {
        setError('Срок действия приглашения истек');
      } else {
        setError('Не удалось загрузить информацию о приглашении');
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
        setError(err.response?.data?.error || 'Не удалось присоединиться к проекту');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
          <Text style={styles.loadingText}>Загрузка приглашения...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={64} color={Colors.accent.red} />
          <Text style={styles.errorTitle}>Ошибка</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleCancel}>
            <Text style={styles.buttonText}>Закрыть</Text>
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

        <Text style={styles.title}>Приглашение в проект</Text>

        <View style={styles.projectCard}>
          <Text style={styles.projectName}>{projectInfo?.projectName}</Text>
          {projectInfo?.projectDescription && (
            <Text style={styles.projectDescription}>
              {projectInfo.projectDescription}
            </Text>
          )}
        </View>

        <Text style={styles.subtitle}>
          Вас приглашают присоединиться к этому проекту
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
                  Присоединиться
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCancel}
            disabled={joining}
          >
            <Text style={styles.secondaryButtonText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  projectCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  projectName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  projectDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  primaryButton: {
    backgroundColor: Colors.accent.purple,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  buttonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  primaryButtonText: {
    color: Colors.text.inverse,
  },
  secondaryButtonText: {
    color: Colors.text.secondary,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.red,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
