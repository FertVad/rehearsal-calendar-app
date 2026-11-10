import React, { useCallback, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../shared/constants/colors';
import { IconButton } from '../../../shared/components/IconButton';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { SkeletonLoader } from '../../../shared/components';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { requestErrorMessage } from '../../../shared/utils/requestError';
import { projectsScreenStyles as styles } from '../styles';
import type { ProjectsScreenNavigation } from '../../../navigation';

export default function ProjectsScreen() {
  const navigation = useNavigation<ProjectsScreenNavigation>();
  const { projects, setSelectedProject, loading, error, refreshProjects } = useProjects();
  const { t } = useI18n();
  // A role given or taken on another device, a project left there (T-229).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProjects({ quiet: true });
    } finally {
      setRefreshing(false);
    }
  }, [refreshProjects]);
  // Anyone can create a project: the paid tier was taken out of the app for
  // the App Store release — see docs/app-store-release.md
  // Joining is not creating, so it lives here on the projects screen rather
  // than in the create sheet — and above all in the empty state, which is
  // exactly what an invited person sees when their link failed to open.
  const handleJoinProject = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('JoinProject', {});
  };

  const handleCreateProject = () => {
    navigation.navigate('CreateProject');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        kind="root"
        title={t.projects.title}
        right={
          <IconButton
            icon="add-circle"
            size={28}
            color={Colors.accent.purple}
            accessibilityLabel={t.projects.createProject}
            onPress={handleCreateProject}
          />
        }
      />
      <ScrollView
        testID="projects-scroll"
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.purple} />
        }
      >

        {/* Projects List */}
        {loading ? (
          <View style={styles.projectsList}>
            {[1, 2, 3].map((key) => (
              <View key={key} style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <View style={styles.projectInfo}>
                    <SkeletonLoader width="60%" height={24} style={{ marginBottom: 8 }} />
                    <SkeletonLoader width={80} height={20} borderRadius={12} />
                  </View>
                </View>
                <SkeletonLoader width="90%" height={16} style={{ marginTop: 8, marginBottom: 4 }} />
                <SkeletonLoader width="70%" height={16} />
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{requestErrorMessage(t, error, t.auth.requestFailed)}</Text>
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>{t.projects.noProjects}</Text>
            <Text style={styles.emptyText}>{t.projects.createFirst}</Text>

            <TouchableOpacity style={styles.joinButton} onPress={handleJoinProject}>
              <Ionicons name="enter-outline" size={18} color={Colors.accent.purple} />
              <Text style={styles.joinButtonText}>{t.projects.haveInvite}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.projectsList}>
            {/* A card is the project: its name, role and description. The
                invitation and its code are on the project's own page, and
                opening a project makes it the one the rehearsal form offers,
                with no tick here to say so (T-025). */}
            {projects.map((project) => (
              <TouchableOpacity
                key={project.id}
                testID="project-card"
                style={styles.projectCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSelectedProject(project);
                  navigation.navigate('ProjectDetail', { projectId: project.id });
                }}
              >
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  {project.is_admin && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={Colors.accent.purple} />
                      <Text style={styles.adminText}>{t.projects.admin}</Text>
                    </View>
                  )}
                </View>
                {project.description && (
                  <Text style={styles.projectDescription} numberOfLines={2}>
                    {project.description}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.joinButton} onPress={handleJoinProject}>
              <Ionicons name="enter-outline" size={18} color={Colors.accent.purple} />
              <Text style={styles.joinButtonText}>{t.projects.haveInvite}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
