import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { invitesAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { joinProjectScreenStyles as styles } from '../styles';

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
