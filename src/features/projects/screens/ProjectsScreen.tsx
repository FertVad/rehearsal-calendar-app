import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { TabParamList, AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { invitesAPI } from '../../../shared/services/api';

type ProjectsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Projects'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function ProjectsScreen({ navigation }: ProjectsScreenProps) {
  const { projects, selectedProject, setSelectedProject, loading, error } = useProjects();
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);

  const handleInvite = async (projectId: string, projectName: string) => {
    try {
      setInviteLoading(projectId);
      const response = await invitesAPI.createInvite(projectId);
      const { inviteUrl } = response.data;

      // Copy link to clipboard
      await Clipboard.setStringAsync(inviteUrl);

      // Show success message
      Alert.alert(
        'Ссылка скопирована',
        'Пригласительная ссылка скопирована в буфер обмена'
      );
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err.response?.data?.error || 'Не удалось создать приглашение'
      );
    } finally {
      setInviteLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Мои проекты</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateProject')}
          >
            <Ionicons name="add-circle" size={28} color={Colors.accent.purple} />
          </TouchableOpacity>
        </View>

        {/* Projects List */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.accent.purple} />
            <Text style={styles.loadingText}>Загрузка проектов...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>Нет проектов</Text>
            <Text style={styles.emptyText}>Создайте свой первый проект, чтобы начать работу</Text>
          </View>
        ) : (
          <View style={styles.projectsList}>
            {projects.map((project) => {
              const isSelected = selectedProject?.id === project.id;
              return (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectCard,
                    isSelected && styles.projectCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedProject(project);
                    navigation.navigate('ProjectDetail', { projectId: project.id });
                  }}
                >
                  <View style={styles.projectHeader}>
                    <View style={styles.projectInfo}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      {project.is_admin && (
                        <View style={styles.adminBadge}>
                          <Ionicons name="shield-checkmark" size={14} color={Colors.accent.purple} />
                          <Text style={styles.adminText}>Админ</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.accent.purple} />
                    )}
                  </View>
                  {project.description && (
                    <Text style={styles.projectDescription} numberOfLines={2}>
                      {project.description}
                    </Text>
                  )}
                  {/* Invite button for admins */}
                  {project.is_admin && (
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleInvite(project.id, project.name);
                      }}
                      disabled={inviteLoading === project.id}
                    >
                      {inviteLoading === project.id ? (
                        <ActivityIndicator size="small" color={Colors.accent.purple} />
                      ) : (
                        <>
                          <Ionicons name="person-add-outline" size={16} color={Colors.accent.purple} />
                          <Text style={styles.inviteButtonText}>Пригласить</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  addButton: {
    padding: Spacing.xs,
  },
  loadingState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  errorState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.accent.red,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  errorText: {
    fontSize: FontSize.base,
    color: Colors.accent.red,
  },
  emptyState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  projectsList: {
    gap: Spacing.md,
  },
  projectCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  projectCardSelected: {
    borderColor: Colors.accent.purple,
    borderWidth: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  projectName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  adminText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  projectDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
  },
  inviteButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
});
