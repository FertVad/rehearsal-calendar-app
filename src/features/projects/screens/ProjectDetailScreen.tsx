import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { projectsAPI, rehearsalsAPI, invitesAPI } from '../../../shared/services/api';

type ProjectDetailScreenProps = NativeStackScreenProps<AppStackParamList, 'ProjectDetail'>;

interface Project {
  id: string;
  name: string;
  description: string;
  is_admin: boolean;
  created_at: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  characterName?: string;
  firstName: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  joinedAt: string;
}

interface Rehearsal {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  status: string;
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ProjectDetailScreen({ route, navigation }: ProjectDetailScreenProps) {
  const { projectId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projectRes, membersRes, rehearsalsRes] = await Promise.all([
        projectsAPI.getProject(projectId),
        projectsAPI.getMembers(projectId),
        rehearsalsAPI.getAll(projectId),
      ]);

      setProject(projectRes.data.project);
      setMembers(membersRes.data.members);
      setRehearsals(rehearsalsRes.data.rehearsals || []);
    } catch (err) {
      console.error('Failed to fetch project data:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить данные проекта');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleInvite = async () => {
    if (!project) return;

    try {
      setInviteLoading(true);
      const response = await invitesAPI.createInvite(projectId);
      const { inviteUrl } = response.data;

      await Share.share({
        message: `Присоединяйся к проекту "${project.name}" в приложении Rehearsal:\n${inviteUrl}`,
        title: `Приглашение в проект ${project.name}`,
      });
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err.response?.data?.error || 'Не удалось создать приглашение'
      );
    } finally {
      setInviteLoading(false);
    }
  };

  // Split rehearsals into upcoming and past
  const today = formatDateToString(new Date());
  const upcomingRehearsals = rehearsals
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const pastRehearsals = rehearsals
    .filter(r => r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Проект не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Владелец';
      case 'admin': return 'Админ';
      default: return 'Участник';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return Colors.accent.purple;
      case 'admin': return Colors.accent.blue;
      default: return Colors.text.tertiary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.purple} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
          {project.is_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.accent.purple} />
            </View>
          )}
        </View>

        {project.description && (
          <Text style={styles.description}>{project.description}</Text>
        )}

        {/* Invite Button (admin only) */}
        {project.is_admin && (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={handleInvite}
            disabled={inviteLoading}
          >
            {inviteLoading ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="person-add" size={18} color={Colors.text.inverse} />
                <Text style={styles.inviteButtonText}>Пригласить участников</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Upcoming Rehearsals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color={Colors.accent.purple} />
            <Text style={styles.sectionTitle}>Ближайшие репетиции</Text>
            <Text style={styles.sectionCount}>{upcomingRehearsals.length}</Text>
          </View>

          {upcomingRehearsals.length === 0 ? (
            <Text style={styles.emptyText}>Нет запланированных репетиций</Text>
          ) : (
            <View style={styles.rehearsalsList}>
              {upcomingRehearsals.slice(0, 5).map(rehearsal => (
                <View key={rehearsal.id} style={styles.rehearsalCard}>
                  <View style={styles.rehearsalDate}>
                    <Text style={styles.rehearsalDateText}>{formatDate(rehearsal.date)}</Text>
                  </View>
                  <View style={styles.rehearsalInfo}>
                    <Text style={styles.rehearsalTitle} numberOfLines={1}>{rehearsal.title}</Text>
                    <View style={styles.rehearsalMeta}>
                      <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
                      <Text style={styles.rehearsalTime}>
                        {rehearsal.time.substring(0, 5)}
                        {rehearsal.endTime && ` - ${rehearsal.endTime.substring(0, 5)}`}
                      </Text>
                    </View>
                    {rehearsal.location && (
                      <View style={styles.rehearsalMeta}>
                        <Ionicons name="location-outline" size={12} color={Colors.text.tertiary} />
                        <Text style={styles.rehearsalLocation} numberOfLines={1}>
                          {rehearsal.location}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Past Rehearsals */}
        {pastRehearsals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={20} color={Colors.text.tertiary} />
              <Text style={[styles.sectionTitle, styles.pastTitle]}>Прошедшие репетиции</Text>
              <Text style={styles.sectionCount}>{pastRehearsals.length}</Text>
            </View>

            <View style={styles.rehearsalsList}>
              {pastRehearsals.slice(0, 3).map(rehearsal => (
                <View key={rehearsal.id} style={[styles.rehearsalCard, styles.pastCard]}>
                  <View style={[styles.rehearsalDate, styles.pastDate]}>
                    <Text style={[styles.rehearsalDateText, styles.pastDateText]}>
                      {formatDate(rehearsal.date)}
                    </Text>
                  </View>
                  <View style={styles.rehearsalInfo}>
                    <Text style={[styles.rehearsalTitle, styles.pastText]} numberOfLines={1}>
                      {rehearsal.title}
                    </Text>
                    <View style={styles.rehearsalMeta}>
                      <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
                      <Text style={styles.rehearsalTime}>
                        {rehearsal.time.substring(0, 5)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={Colors.accent.purple} />
            <Text style={styles.sectionTitle}>Участники</Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>

          <View style={styles.membersList}>
            {members.map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.firstName[0]}{member.lastName?.[0] || ''}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.firstName} {member.lastName || ''}
                  </Text>
                  {member.characterName && (
                    <Text style={styles.memberCharacter}>{member.characterName}</Text>
                  )}
                </View>
                <View style={[styles.roleBadge, { borderColor: getRoleColor(member.role) }]}>
                  <Text style={[styles.roleText, { color: getRoleColor(member.role) }]}>
                    {getRoleLabel(member.role)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  title: {
    flex: 1,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  adminBadge: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    borderRadius: BorderRadius.sm,
  },
  description: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.purple,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  inviteButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  pastTitle: {
    color: Colors.text.secondary,
  },
  sectionCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.tertiary,
    backgroundColor: Colors.glass.bg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: FontSize.base,
    color: Colors.accent.red,
  },
  rehearsalsList: {
    gap: Spacing.sm,
  },
  rehearsalCard: {
    flexDirection: 'row',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  pastCard: {
    opacity: 0.7,
  },
  rehearsalDate: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  pastDate: {
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  rehearsalDateText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  pastDateText: {
    color: Colors.text.tertiary,
  },
  rehearsalInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  rehearsalTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  pastText: {
    color: Colors.text.secondary,
  },
  rehearsalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rehearsalTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  rehearsalLocation: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    flex: 1,
  },
  membersList: {
    gap: Spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.inverse,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  memberCharacter: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  roleBadge: {
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
