import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../shared/constants/colors';
import { ProjectsStackParamList } from '../../../navigation';
import { projectsAPI, rehearsalsAPI, invitesAPI } from '../../../shared/services/api';
import { projectDetailScreenStyles as styles } from '../styles';
import { formatDateToString as formatDateToStringUtil } from '../../../shared/utils/time';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import * as Clipboard from 'expo-clipboard';
import { useInviteLink } from '../hooks';

type ProjectDetailScreenProps = NativeStackScreenProps<ProjectsStackParamList, 'ProjectDetail'>;

interface Project {
  id: string;
  name: string;
  description: string;
  is_admin: boolean;
  is_owner: boolean;
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
  scene?: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  status: string;
}

// Helper to format date with locale support
function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const formatted = date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
  // Remove trailing period from Russian month abbreviations
  return formatted.replace(/\.$/, '');
}

// Use shared utility
const formatDateToString = formatDateToStringUtil;

export default function ProjectDetailScreen({ route, navigation }: ProjectDetailScreenProps) {
  const { projectId } = route.params;
  const { t, language } = useI18n();
  const { refreshProjects } = useProjects();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { generateInviteLink, generatingInvite, lastCode } = useInviteLink();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    // Prevent fetching if project is being deleted
    if (isDeleting) return;

    try {
      const [projectRes, membersRes, rehearsalsRes] = await Promise.all([
        projectsAPI.getProject(projectId),
        projectsAPI.getMembers(projectId),
        rehearsalsAPI.getAll(projectId),
      ]);

      const projectData = projectRes.data.project;
      setProject(projectData);
      setMembers(membersRes.data.members);
      setRehearsals(rehearsalsRes.data.rehearsals || []);
      setIsOwner(projectData.is_owner);
    } catch (err) {
      console.error('Failed to fetch project data:', err);
      Alert.alert(t.common.error, t.projects.fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, t, isDeleting]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    if (isDeleting) return; // Don't refresh if deleting
    setRefreshing(true);
    fetchData();
  }, [fetchData, isDeleting]);

  // Admins get the code up front: dictating it is the fallback when the link
  // does not arrive, and that is no use if you must share first to see it.
  useEffect(() => {
    if (!project?.is_admin) return;
    let alive = true;
    invitesAPI
      .getInvite(projectId)
      .then((res) => {
        if (alive) setInviteCode(res.data?.inviteCode ?? null);
      })
      .catch(() => { /* no invite yet, or not allowed — the row stays hidden */ });
    return () => { alive = false; };
  }, [project?.is_admin, projectId]);

  useEffect(() => {
    if (lastCode) setInviteCode(lastCode);
  }, [lastCode]);

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert(t.projects.codeCopied, '');
  };

  const handleInvite = () => {
    if (!project) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generateInviteLink(projectId, project.name);
  };

  // Memoize split rehearsals into upcoming and past to avoid re-sorting on every render
  const { upcomingRehearsals, pastRehearsals } = useMemo(() => {
    const today = formatDateToString(new Date());
    const upcoming = rehearsals
      .filter(r => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const past = rehearsals
      .filter(r => r.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

    return { upcomingRehearsals: upcoming, pastRehearsals: past };
  }, [rehearsals]);

  const handleMemberPress = useCallback((member: Member) => {
    // Only allow admins to manage members, and can't manage owner
    if (!project?.is_admin || member.role === 'owner') {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMember(member);
  }, [project?.is_admin]);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedMember) return;

    const memberName = `${selectedMember.firstName} ${selectedMember.lastName || ''}`.trim();

    Alert.alert(
      t.projects.removeMemberConfirm,
      t.projects.removeMemberMessage(memberName),
      [
        {
          text: t.projects.cancel,
          style: 'cancel',
        },
        {
          text: t.projects.removeMember,
          style: 'destructive',
          onPress: async () => {
            try {
              setMemberActionLoading(true);
              await projectsAPI.removeMember(projectId, selectedMember.userId);

              // Remove member from local state
              setMembers(prev => prev.filter(m => m.id !== selectedMember.id));
              setSelectedMember(null);

              Alert.alert(t.common.success, t.projects.memberRemoved);
            } catch (err: any) {
              Alert.alert(t.common.error, err.response?.data?.error || t.projects.memberActionError);
            } finally {
              setMemberActionLoading(false);
            }
          },
        },
      ]
    );
  }, [selectedMember, projectId, t]);

  const handleToggleAdmin = useCallback(async () => {
    if (!selectedMember) return;

    const memberName = `${selectedMember.firstName} ${selectedMember.lastName || ''}`.trim();
    const isCurrentlyAdmin = selectedMember.role === 'admin';
    const newRole = isCurrentlyAdmin ? 'member' : 'admin';

    Alert.alert(
      isCurrentlyAdmin ? t.projects.removeAdminConfirm : t.projects.makeAdminConfirm,
      isCurrentlyAdmin
        ? t.projects.removeAdminMessage(memberName)
        : t.projects.makeAdminMessage(memberName),
      [
        {
          text: t.projects.cancel,
          style: 'cancel',
        },
        {
          text: isCurrentlyAdmin ? t.projects.removeAdmin : t.projects.makeAdmin,
          onPress: async () => {
            try {
              setMemberActionLoading(true);
              await projectsAPI.updateMemberRole(projectId, selectedMember.userId, newRole);

              // Update member role in local state
              setMembers(prev => prev.map(m =>
                m.id === selectedMember.id ? { ...m, role: newRole } : m
              ));
              setSelectedMember(null);

              Alert.alert(t.common.success, t.projects.roleUpdated);
            } catch (err: any) {
              Alert.alert(t.common.error, err.response?.data?.error || t.projects.memberActionError);
            } finally {
              setMemberActionLoading(false);
            }
          },
        },
      ]
    );
  }, [selectedMember, projectId, t]);

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;

    Alert.alert(
      t.projects.deleteProjectConfirm,
      `${t.projects.deleteProjectMessage(project.name)}\n\n${t.projects.deleteProjectWarning}`,
      [
        {
          text: t.common.cancel,
          style: 'cancel',
        },
        {
          text: t.projects.deleteProject,
          style: 'destructive',
          onPress: async () => {
            try {
              // Set flag to prevent any further data fetching
              setIsDeleting(true);

              await projectsAPI.deleteProject(projectId);

              // Refresh projects context to remove deleted project from the list
              await refreshProjects();

              // Use replace instead of navigate to completely remove this screen from stack
              navigation.replace('ProjectsMain');

              // Show success message after navigation
              setTimeout(() => {
                Alert.alert(t.common.success, t.projects.projectDeleted);
              }, 300);
            } catch (err: any) {
              setIsDeleting(false);
              Alert.alert(t.common.error, err.response?.data?.error || t.projects.deleteProjectError);
            }
          },
        },
      ]
    );
  }, [project, projectId, navigation, t, refreshProjects]);

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
          <Text style={styles.errorText}>{t.projects.projectNotFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t.projects.owner;
      case 'admin': return t.projects.admin;
      default: return t.projects.member;
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
          <>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleInvite}
              disabled={generatingInvite}
            >
              {generatingInvite ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <>
                  <Ionicons name="person-add" size={18} color={Colors.text.inverse} />
                  <Text style={styles.inviteButtonText}>{t.projects.inviteMembers}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* The code is the fallback for when the link does not arrive, so
                it is shown outright rather than hidden behind sharing first. */}
            {inviteCode && (
              <TouchableOpacity style={styles.inviteCodeRow} onPress={handleCopyCode}>
                <View>
                  <Text style={styles.inviteCodeLabel}>{t.projects.inviteCodeLabel}</Text>
                  <Text style={styles.inviteCodeValue}>{inviteCode}</Text>
                </View>
                <Ionicons name="copy-outline" size={20} color={Colors.accent.purple} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Upcoming Rehearsals */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => upcomingRehearsals.length > 0 && setUpcomingExpanded(prev => !prev)}
            activeOpacity={upcomingRehearsals.length > 0 ? 0.7 : 1}
          >
            <Ionicons name="calendar" size={20} color={Colors.accent.purple} />
            <Text style={styles.sectionTitle}>{t.projects.upcomingRehearsals}</Text>
            <Text style={styles.sectionCount}>{upcomingRehearsals.length}</Text>
            {upcomingRehearsals.length > 0 && (
              <Ionicons
                name={upcomingExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.text.tertiary}
              />
            )}
          </TouchableOpacity>

          {upcomingRehearsals.length === 0 ? (
            <Text style={styles.emptyText}>{t.projects.noUpcomingRehearsals}</Text>
          ) : upcomingExpanded ? (
            <View style={styles.rehearsalsList}>
              {upcomingRehearsals.map(rehearsal => (
                <View key={rehearsal.id} style={styles.rehearsalCard}>
                  <View style={styles.rehearsalDate}>
                    <Text style={styles.rehearsalDateText}>{formatDate(rehearsal.date, language)}</Text>
                  </View>
                  <View style={styles.rehearsalInfo}>
                    {/* `scene` predates the title field and is never written
                        to; keep reading it so any legacy row still renders. */}
                    <Text style={styles.rehearsalTitle} numberOfLines={1}>
                      {rehearsal.title || rehearsal.scene || t.calendar.rehearsal}
                    </Text>
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
          ) : null}
        </View>

        {/* Past Rehearsals */}
        {pastRehearsals.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setPastExpanded(prev => !prev)}
              activeOpacity={0.7}
            >
              <Ionicons name="time" size={20} color={Colors.text.tertiary} />
              <Text style={[styles.sectionTitle, styles.pastTitle]}>{t.projects.pastRehearsals}</Text>
              <Text style={styles.sectionCount}>{pastRehearsals.length}</Text>
              <Ionicons
                name={pastExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.text.tertiary}
              />
            </TouchableOpacity>

            {pastExpanded && (
              <View style={styles.rehearsalsList}>
                {pastRehearsals.map(rehearsal => (
                  <View key={rehearsal.id} style={[styles.rehearsalCard, styles.pastCard]}>
                    <View style={[styles.rehearsalDate, styles.pastDate]}>
                      <Text style={[styles.rehearsalDateText, styles.pastDateText]}>
                        {formatDate(rehearsal.date, language)}
                      </Text>
                    </View>
                    <View style={styles.rehearsalInfo}>
                      <Text style={[styles.rehearsalTitle, styles.pastText]} numberOfLines={1}>
                        {rehearsal.scene || t.calendar.rehearsal}
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
            )}
          </View>
        )}

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={Colors.accent.purple} />
            <Text style={styles.sectionTitle}>{t.projects.members}</Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>

          <View style={styles.membersList}>
            {members.map(member => {
              const canManage = project.is_admin && member.role !== 'owner';
              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => handleMemberPress(member)}
                  disabled={!canManage}
                  activeOpacity={canManage ? 0.7 : 1}
                >
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
                  {canManage && (
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Delete Project Button (owner only) */}
        {isOwner && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteProject}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
              <Text style={styles.deleteButtonText}>{t.projects.deleteProject}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Member Management Modal */}
      <Modal
        visible={!!selectedMember}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMember(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMember(null)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.projects.manageMember}</Text>
              {selectedMember && (
                <Text style={styles.modalSubtitle}>
                  {selectedMember.firstName} {selectedMember.lastName || ''}
                </Text>
              )}
            </View>

            <View style={styles.modalActions}>
              {/* Toggle Admin */}
              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => {
                  setSelectedMember(null);
                  // Delay to let modal close before showing alert
                  setTimeout(handleToggleAdmin, 300);
                }}
                disabled={memberActionLoading}
              >
                <Ionicons
                  name={selectedMember?.role === 'admin' ? 'remove-circle-outline' : 'shield-checkmark-outline'}
                  size={24}
                  color={Colors.accent.blue}
                />
                <Text style={styles.modalActionText}>
                  {selectedMember?.role === 'admin' ? t.projects.removeAdmin : t.projects.makeAdmin}
                </Text>
              </TouchableOpacity>

              {/* Remove Member */}
              <TouchableOpacity
                style={[styles.modalAction, styles.modalActionDanger]}
                onPress={() => {
                  setSelectedMember(null);
                  // Delay to let modal close before showing alert
                  setTimeout(handleRemoveMember, 300);
                }}
                disabled={memberActionLoading}
              >
                <Ionicons name="trash-outline" size={24} color={Colors.accent.red} />
                <Text style={[styles.modalActionText, styles.modalActionTextDanger]}>
                  {t.projects.removeMember}
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={[styles.modalAction, styles.modalActionCancel]}
                onPress={() => setSelectedMember(null)}
              >
                <Text style={styles.modalActionTextCancel}>{t.projects.cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
