import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Alert, FlatList, Pressable } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, CompositeScreenProps } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../shared/constants/colors';
import { TabParamList, AppStackParamList } from '../../../navigation';
import WeeklyCalendar from '../components/WeeklyCalendar';
import DayDetailsModal from '../components/DayDetailsModal';
import MyRehearsalsModal from '../components/MyRehearsalsModal';
import TodayRehearsals from '../components/TodayRehearsals';
import SmartPlannerButton from '../components/SmartPlannerButton';
import { ParticipantsModal } from '../components/ParticipantsModal';
import { Rehearsal } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { formatDateLocalized, formatDateToString, parseDateString } from '../../../shared/utils/time';
import { useRehearsals, useRSVP } from '../hooks';
import { calendarScreenStyles as styles } from '../styles';
import { unsyncRehearsal } from '../../../shared/services/calendarSync';

type CalendarScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Calendar'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { projects, selectedProject } = useProjects();
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateToString(new Date());
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [myRehearsalsVisible, setMyRehearsalsVisible] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
  const [participantsModalData, setParticipantsModalData] = useState<any[]>([]);
  const [participantsModalRehearsalId, setParticipantsModalRehearsalId] = useState<string | null>(null);

  // null means "All projects"
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);

  // Check if user has any admin role
  const hasAnyAdminRole = useMemo(() =>
    projects.some(p => p.is_admin),
    [projects]
  );

  // Get current UI mode based on filter and admin status
  const screenMode = useMemo(() => {
    if (filterProjectId === null) {
      // "All projects" - show admin UI if user is admin in at least one project
      return hasAnyAdminRole ? 'admin' : 'user';
    }
    // Specific project - check admin status for that project
    const project = projects.find(p => p.id === filterProjectId);
    return project?.is_admin ? 'admin' : 'user';
  }, [filterProjectId, projects, hasAnyAdminRole]);

  // Get list of projects where user is admin
  const adminProjects = useMemo(() =>
    projects.filter(p => p.is_admin),
    [projects]
  );

  // Get current project (if specific project is selected)
  const currentProject = useMemo(() =>
    filterProjectId ? projects.find(p => p.id === filterProjectId) : null,
    [filterProjectId, projects]
  );

  // Use custom hooks for data management
  const {
    rehearsals,
    loading,
    error,
    rsvpResponses,
    setRsvpResponses,
    adminStats,
    setAdminStats,
    fetchRehearsals,
    updateAdminStats,
  } = useRehearsals(projects, filterProjectId);

  const { respondingId, handleRSVP } = useRSVP();

  const handleDayLongPress = useCallback((date: string) => {
    setModalDate(date);
    setModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleMyRehearsalsClose = useCallback(() => {
    setMyRehearsalsVisible(false);
  }, []);

  const handleSelectDateFromModal = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  // Load participants for modal (admin only)
  const loadParticipants = useCallback(async (rehearsalId: string) => {
    try {
      const res = await rehearsalsAPI.getResponses(rehearsalId);
      if (res.data.allParticipants) {
        const participants = res.data.allParticipants.map((p: any) => ({
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          hasLiked: p.response === 'yes',
          hasResponded: p.response !== null,
        }));
        setParticipantsModalData(participants);
        setParticipantsModalRehearsalId(rehearsalId);
        setParticipantsModalVisible(true);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  }, []);

  const modalRehearsals = rehearsals.filter(r => r.date === modalDate);

  // Fetch rehearsals when screen is focused (to get updates after creating new rehearsals)
  useFocusEffect(
    useCallback(() => {
      fetchRehearsals();
    }, [fetchRehearsals])
  );

  const handleDeleteRehearsal = async (rehearsalId: string) => {
    // Find the rehearsal to get its projectId
    const rehearsal = rehearsals.find(r => r.id === rehearsalId);
    const projectId = (rehearsal as any)?.projectId || filterProjectId;

    if (!projectId) return;

    Alert.alert(
      t.rehearsals.deleteTitle,
      t.rehearsals.deleteMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.rehearsals.deleteConfirm,
          style: 'destructive',
          onPress: async () => {
            try {
              await rehearsalsAPI.delete(projectId, rehearsalId);

              // Auto-unsync from calendar if it was synced
              try {
                await unsyncRehearsal(rehearsalId);
                console.log('[CalendarScreen] Auto-unsynced rehearsal from calendar');
              } catch (syncError) {
                // Don't fail the whole operation if unsync fails
                console.error('[CalendarScreen] Failed to unsync from calendar:', syncError);
              }

              // Refetch rehearsals after deletion
              await fetchRehearsals();
            } catch (err: any) {
              console.error('Failed to delete rehearsal:', err);
              Alert.alert(t.common.error, err.message || t.rehearsals.createError);
            }
          },
        },
      ]
    );
  };

  const getFilterLabel = () => {
    if (filterProjectId === null) return t.calendar.allProjects;
    const project = projects.find(p => p.id === filterProjectId);
    return project?.name || t.projects.selectProject;
  };

  const handleSelectFilter = (projectId: string | null) => {
    setFilterProjectId(projectId);
    setFilterExpanded(false);
  };

  // Check if user is admin for the filtered project
  const isAdminForFilter = filterProjectId
    ? projects.find(p => p.id === filterProjectId)?.is_admin
    : false;

  // Get rehearsals for selected date (defaults to today)
  const selectedDateRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => r.date === selectedDate)
      .sort((a, b) => {
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return 0;
      });
  }, [rehearsals, selectedDate]);

  const upcomingRehearsals = useMemo(() => {
    const today = formatDateToString(new Date());
    const todayDate = parseDateString(today);

    // Filter rehearsals from today onwards, sorted by date and time
    return rehearsals
      .filter(r => r.date && r.date >= today)
      .sort((a, b) => {
        if (a.date && b.date) {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
        }
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return 0;
      });
  }, [rehearsals]);

  // Get relative date label (Today, Tomorrow, or formatted date)
  const getRelativeDateLabel = (dateStr: string) => {
    const today = formatDateToString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateToString(tomorrow);

    if (dateStr === today) return t.common.today;
    if (dateStr === tomorrowStr) return t.calendar.tomorrow || 'Tomorrow';
    return formatDateLocalized(dateStr, { day: 'numeric', month: 'short', weekday: 'short' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Project Filter */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterExpanded(!filterExpanded)}
          >
            <Ionicons name="funnel-outline" size={18} color={Colors.accent.purple} />
            <Text style={styles.filterButtonText}>{getFilterLabel()}</Text>

            {/* Admin Badge - only show for specific project where user is admin */}
            {screenMode === 'admin' && currentProject && (
              <View style={styles.adminBadgeInline}>
                <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                <Text style={styles.adminBadgeText}>{t.projects.admin}</Text>
              </View>
            )}

            <Ionicons
              name={filterExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Filter Dropdown */}
        {filterExpanded && (
          <View style={styles.filterDropdown}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                filterProjectId === null && styles.filterOptionSelected
              ]}
              onPress={() => handleSelectFilter(null)}
            >
              <Text style={[
                styles.filterOptionText,
                filterProjectId === null && styles.filterOptionTextSelected
              ]}>
                {t.calendar.allProjects}
              </Text>
              {filterProjectId === null && (
                <Ionicons name="checkmark" size={18} color={Colors.accent.purple} />
              )}
            </TouchableOpacity>
            {projects.map(project => (
              <TouchableOpacity
                key={project.id}
                style={[
                  styles.filterOption,
                  filterProjectId === project.id && styles.filterOptionSelected
                ]}
                onPress={() => handleSelectFilter(project.id)}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterProjectId === project.id && styles.filterOptionTextSelected
                ]}>
                  {project.name}
                </Text>
                {filterProjectId === project.id && (
                  <Ionicons name="checkmark" size={18} color={Colors.accent.purple} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Weekly Calendar */}
        <WeeklyCalendar
          rehearsals={rehearsals}
          onDaySelect={setSelectedDate}
          onDayLongPress={handleDayLongPress}
          selectedDate={selectedDate}
        />

        {/* Smart Planner Button - only show for admins */}
        {screenMode === 'admin' && (
          <SmartPlannerButton
            adminProjects={adminProjects}
            onPress={(projectId) => navigation.navigate('SmartPlanner', { projectId })}
          />
        )}

        {/* Selected Date Rehearsals */}
        <TodayRehearsals
          rehearsals={selectedDateRehearsals}
          selectedDate={selectedDate}
          loading={loading}
          projects={projects}
          rsvpResponses={rsvpResponses}
          respondingId={respondingId}
          adminStats={adminStats}
          onRSVP={handleRSVP}
          onDeleteRehearsal={handleDeleteRehearsal}
          setRsvpResponses={setRsvpResponses}
          setAdminStats={setAdminStats}
        />

        {/* Upcoming Events */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>{t.calendar.upcomingEvents}</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.accent.purple} />
              <Text style={styles.loadingText}>{t.common.loading}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t.calendar.selectProject}</Text>
            </View>
          ) : upcomingRehearsals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>{t.calendar.noUpcoming}</Text>
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingRehearsals.map((rehearsal) => {
                const currentResponse = rsvpResponses[rehearsal.id];
                const isResponding = respondingId === rehearsal.id;
                const project = projects.find(p => p.id === rehearsal.projectId);
                // Check if user is admin for THIS specific rehearsal's project
                const isAdminForThisRehearsal = project?.is_admin || false;
                const stats = adminStats[rehearsal.id];

                return (
                  <View key={rehearsal.id} style={styles.upcomingCard}>
                    <TouchableOpacity
                      onPress={() => {
                        if (rehearsal.date) {
                          setSelectedDate(rehearsal.date);
                          setModalDate(rehearsal.date);
                          setModalVisible(true);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.upcomingCardHeader}>
                        <View style={styles.upcomingDateBadge}>
                          <Text style={styles.upcomingDateText}>
                            {getRelativeDateLabel(rehearsal.date || '')}
                          </Text>
                        </View>
                        {isAdminForThisRehearsal && (
                          <View style={styles.adminBadge}>
                            <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                            <Text style={styles.adminBadgeText}>{t.projects.admin}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.upcomingContent}>
                        <View style={styles.upcomingTimeRow}>
                          <Ionicons name="time-outline" size={14} color={Colors.accent.purple} />
                          <Text style={styles.upcomingTime}>
                            {rehearsal.time?.substring(0, 5) || ''}
                            {rehearsal.endTime && ` — ${rehearsal.endTime.substring(0, 5)}`}
                          </Text>
                        </View>

                        {rehearsal.projectName && (
                          <View style={styles.upcomingProjectRow}>
                            <Ionicons name="folder-outline" size={14} color={Colors.accent.blue} />
                            <Text style={styles.upcomingProject} numberOfLines={1}>
                              {rehearsal.projectName}
                            </Text>
                          </View>
                        )}

                        {rehearsal.location && (
                          <View style={styles.upcomingLocationRow}>
                            <Ionicons name="location-outline" size={14} color={Colors.text.secondary} />
                            <Text style={styles.upcomingLocation} numberOfLines={1}>
                              {rehearsal.location}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Like Button (Telegram-style) */}
                    <View style={styles.likeSection}>
                      <Pressable
                        style={styles.likeButton}
                        onPress={() => {
                          // Light haptic feedback on tap
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                          // Toggle logic is in the hook, just pass current status
                          handleRSVP(rehearsal.id, currentResponse, (id, status, serverStats) => {
                            setRsvpResponses(prev => ({ ...prev, [id]: status }));
                            // If server returned stats, use them immediately
                            if (serverStats && isAdminForThisRehearsal) {
                              setAdminStats(prev => ({
                                ...prev,
                                [id]: serverStats,
                              }));
                            }
                          });
                        }}
                        onLongPress={() => {
                          // Medium haptic feedback on long press
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          // Only admins can see participants list
                          if (isAdminForThisRehearsal) {
                            loadParticipants(rehearsal.id);
                          }
                        }}
                        disabled={isResponding}
                      >
                        <Ionicons
                          name={currentResponse === 'confirmed' ? 'heart' : 'heart-outline'}
                          size={24}
                          color={currentResponse === 'confirmed' ? Colors.accent.red : Colors.text.secondary}
                        />
                        {stats && (stats.confirmed > 0 || isAdminForThisRehearsal) && (() => {
                          const totalParticipants = stats.confirmed + stats.declined + stats.tentative + stats.invited;
                          const displayText = isAdminForThisRehearsal && totalParticipants > 0
                            ? `${stats.confirmed}/${totalParticipants}`
                            : `${stats.confirmed}`;

                          return (
                            <Text style={styles.likeCount}>
                              {displayText}
                            </Text>
                          );
                        })()}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Day Details Modal */}
      <DayDetailsModal
        visible={modalVisible}
        onClose={handleModalClose}
        date={modalDate}
        rehearsals={modalRehearsals}
        onDeleteRehearsal={handleDeleteRehearsal}
        isAdmin={selectedProject?.is_admin}
      />

      {/* My Rehearsals Modal */}
      <MyRehearsalsModal
        visible={myRehearsalsVisible}
        onClose={handleMyRehearsalsClose}
        rehearsals={rehearsals}
        onSelectDate={handleSelectDateFromModal}
      />

      {/* Participants Modal (Admin only) */}
      <ParticipantsModal
        visible={participantsModalVisible}
        onClose={() => setParticipantsModalVisible(false)}
        participants={participantsModalData}
        totalCount={participantsModalData.length}
        likedCount={participantsModalData.filter(p => p.hasLiked).length}
      />
    </SafeAreaView>
  );
}
