import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { TabParamList, AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useInviteLink } from '../hooks';
import { projectsScreenStyles as styles } from '../styles';

type ProjectsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Projects'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function ProjectsScreen({ navigation }: ProjectsScreenProps) {
  const { projects, selectedProject, setSelectedProject, loading, error } = useProjects();
  const { generateInviteLink, generatingInvite } = useInviteLink();

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
                        generateInviteLink(project.id);
                      }}
                      disabled={generatingInvite}
                    >
                      {generatingInvite ? (
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
