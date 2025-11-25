import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Alert, FlatList, Dimensions } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, CompositeScreenProps } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { TabParamList, AppStackParamList } from '../../../navigation';
import WeeklyCalendar from '../components/WeeklyCalendar';
import DayDetailsModal from '../components/DayDetailsModal';
import MyRehearsalsModal from '../components/MyRehearsalsModal';
import { Rehearsal, Project, RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { formatDateLocalized, formatDateToString, parseDateString } from '../../../shared/utils/time';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const UPCOMING_CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md;

type CalendarScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Calendar'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [myRehearsalsVisible, setMyRehearsalsVisible] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);

  // null means "All projects"
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);

  // RSVP responses state: rehearsalId -> status
  const [rsvpResponses, setRsvpResponses] = useState<Record<string, RSVPStatus>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Admin stats for rehearsals: rehearsalId -> stats
  const [adminStats, setAdminStats] = useState<Record<string, { confirmed: number; declined: number; pending: number }>>({});

  // Handle RSVP response
  const handleRSVP = useCallback(async (rehearsalId: string, status: 'confirmed' | 'declined') => {
    setRespondingId(rehearsalId);
    try {
      await rehearsalsAPI.respond(rehearsalId, status);
      setRsvpResponses(prev => ({ ...prev, [rehearsalId]: status }));
    } catch (err: any) {
      console.error('Failed to submit RSVP:', err);
      Alert.alert('Ошибка', err.message || 'Не удалось отправить ответ');
    } finally {
      setRespondingId(null);
    }
  }, []);

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

  const modalRehearsals = rehearsals.filter(r => r.date === modalDate);

  const fetchRehearsals = useCallback(async () => {
    if (projects.length === 0) {
      setRehearsals([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let fetchedRehearsals: Rehearsal[] = [];

      // If filter is null (All projects), fetch from all projects
      if (filterProjectId === null) {
        const allRehearsals: Rehearsal[] = [];
        for (const project of projects) {
          try {
            const response = await rehearsalsAPI.getAll(project.id);
            const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) => ({
              ...r,
              projectName: project.name,
              projectId: project.id,
            }));
            allRehearsals.push(...projectRehearsals);
          } catch (err) {
            // Skip failed project fetches
            console.error(`Failed to fetch rehearsals for project ${project.id}:`, err);
          }
        }
        fetchedRehearsals = allRehearsals;
      } else {
        // Fetch from selected project only
        const response = await rehearsalsAPI.getAll(filterProjectId);
        const project = projects.find(p => p.id === filterProjectId);
        const projectRehearsals = (response.data.rehearsals || []).map((r: Rehearsal) => ({
          ...r,
          projectName: project?.name,
          projectId: filterProjectId,
        }));
        fetchedRehearsals = projectRehearsals;
      }

      setRehearsals(fetchedRehearsals);

      // Fetch user's RSVP responses and admin stats for upcoming rehearsals
      const today = formatDateToString(new Date());
      const upcomingRehearsals = fetchedRehearsals.filter(r => r.date >= today);

      if (upcomingRehearsals.length > 0) {
        const responses: Record<string, RSVPStatus> = {};
        const stats: Record<string, { confirmed: number; declined: number; pending: number }> = {};

        await Promise.all(
          upcomingRehearsals.map(async (rehearsal) => {
            // Check if user is admin for this project
            const project = projects.find(p => p.id === rehearsal.projectId);
            const isAdmin = project?.is_admin;

            if (isAdmin) {
              // For admin - fetch stats
              try {
                const res = await rehearsalsAPI.getResponses(rehearsal.id);
                if (res.data.stats) {
                  stats[rehearsal.id] = {
                    confirmed: res.data.stats.confirmed,
                    declined: res.data.stats.declined,
                    pending: res.data.stats.invited + res.data.stats.tentative,
                  };
                }
              } catch (err) {
                // Ignore errors
              }
            } else {
              // For regular user - fetch their response
              try {
                const res = await rehearsalsAPI.getMyResponse(rehearsal.id);
                if (res.data.response?.status) {
                  responses[rehearsal.id] = res.data.response.status;
                }
              } catch (err) {
                // Ignore errors
              }
            }
          })
        );
        setRsvpResponses(responses);
        setAdminStats(stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch rehearsals:', err);
      setError(err.message || 'Failed to load rehearsals');
      setRehearsals([]);
    } finally {
      setLoading(false);
    }
  }, [projects, filterProjectId]);

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
      'Удалить репетицию?',
      'Это действие нельзя отменить',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await rehearsalsAPI.delete(projectId, rehearsalId);
              setRehearsals(prev => prev.filter(r => r.id !== rehearsalId));
            } catch (err: any) {
              console.error('Failed to delete rehearsal:', err);
              Alert.alert('Ошибка', err.message || 'Не удалось удалить репетицию');
            }
          },
        },
      ]
    );
  };

  const getFilterLabel = () => {
    if (filterProjectId === null) return 'Все проекты';
    const project = projects.find(p => p.id === filterProjectId);
    return project?.name || 'Выбрать проект';
  };

  const handleSelectFilter = (projectId: string | null) => {
    setFilterProjectId(projectId);
    setFilterExpanded(false);
  };

  // Check if user is admin for the filtered project
  const isAdminForFilter = filterProjectId
    ? projects.find(p => p.id === filterProjectId)?.is_admin
    : false;

  // Get upcoming rehearsals (today + next 7 days)
  const upcomingRehearsals = useMemo(() => {
    const today = formatDateToString(new Date());
    const todayDate = parseDateString(today);

    // Filter rehearsals from today onwards, sorted by date and time
    return rehearsals
      .filter(r => r.date >= today)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  }, [rehearsals]);

  // Get relative date label (Сегодня, Завтра, or formatted date)
  const getRelativeDateLabel = (dateStr: string) => {
    const today = formatDateToString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateToString(tomorrow);

    if (dateStr === today) return 'Сегодня';
    if (dateStr === tomorrowStr) return 'Завтра';
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
                Все проекты
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

        {/* Upcoming Events */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Ближайшие события</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.accent.purple} />
              <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Создайте проект в разделе "Проекты"</Text>
            </View>
          ) : upcomingRehearsals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>Нет предстоящих репетиций</Text>
            </View>
          ) : (
            <FlatList
              data={upcomingRehearsals}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.upcomingList}
              renderItem={({ item: rehearsal }) => {
                const currentResponse = rsvpResponses[rehearsal.id];
                const isResponding = respondingId === rehearsal.id;
                const project = projects.find(p => p.id === rehearsal.projectId);
                const isAdmin = project?.is_admin;
                const stats = adminStats[rehearsal.id];

                return (
                  <View style={styles.upcomingCard}>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDate(rehearsal.date);
                        setModalDate(rehearsal.date);
                        setModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.upcomingCardHeader}>
                        <View style={styles.upcomingDateBadge}>
                          <Text style={styles.upcomingDateText}>
                            {getRelativeDateLabel(rehearsal.date)}
                          </Text>
                        </View>
                        {isAdmin && (
                          <View style={styles.adminBadge}>
                            <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                            <Text style={styles.adminBadgeText}>Админ</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.upcomingContent}>
                        <View style={styles.upcomingTimeRow}>
                          <Ionicons name="time-outline" size={14} color={Colors.accent.purple} />
                          <Text style={styles.upcomingTime}>
                            {rehearsal.time.substring(0, 5)}
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

                    {/* RSVP Section - different for admin and regular user */}
                    {isAdmin ? (
                      // Admin sees stats
                      <View style={styles.adminStatsSection}>
                        {stats ? (
                          <View style={styles.adminStatsRow}>
                            <View style={styles.adminStatItem}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.accent.green} />
                              <Text style={styles.adminStatText}>{stats.confirmed}</Text>
                            </View>
                            <View style={styles.adminStatItem}>
                              <Ionicons name="close-circle" size={16} color={Colors.accent.red} />
                              <Text style={styles.adminStatText}>{stats.declined}</Text>
                            </View>
                            <View style={styles.adminStatItem}>
                              <Ionicons name="help-circle" size={16} color={Colors.text.tertiary} />
                              <Text style={styles.adminStatText}>{stats.pending}</Text>
                            </View>
                          </View>
                        ) : (
                          <ActivityIndicator size="small" color={Colors.accent.purple} />
                        )}
                      </View>
                    ) : currentResponse ? (
                      // Regular user with response
                      <View style={[
                        styles.rsvpStatus,
                        currentResponse === 'confirmed' ? styles.rsvpConfirmed : styles.rsvpDeclined
                      ]}>
                        <Ionicons
                          name={currentResponse === 'confirmed' ? 'checkmark-circle' : 'close-circle'}
                          size={16}
                          color={currentResponse === 'confirmed' ? Colors.accent.green : Colors.accent.red}
                        />
                        <Text style={[
                          styles.rsvpStatusText,
                          currentResponse === 'confirmed' ? styles.rsvpStatusConfirmed : styles.rsvpStatusDeclined
                        ]}>
                          {currentResponse === 'confirmed' ? 'Репетиция подтверждена' : 'Вы отказались'}
                        </Text>
                      </View>
                    ) : (
                      // Regular user without response - show buttons
                      <View style={styles.rsvpButtons}>
                        <TouchableOpacity
                          style={[styles.rsvpButton, styles.rsvpConfirmButton]}
                          onPress={() => handleRSVP(rehearsal.id, 'confirmed')}
                          disabled={isResponding}
                        >
                          {isResponding ? (
                            <ActivityIndicator size="small" color={Colors.accent.green} />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={18} color={Colors.accent.green} />
                              <Text style={styles.rsvpButtonTextConfirm}>Приду</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rsvpButton, styles.rsvpDeclineButton]}
                          onPress={() => handleRSVP(rehearsal.id, 'declined')}
                          disabled={isResponding}
                        >
                          <Ionicons name="close-circle" size={18} color={Colors.accent.red} />
                          <Text style={styles.rsvpButtonTextDecline}>Не приду</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
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
  filterContainer: {
    marginBottom: Spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  filterButtonText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
  },
  filterDropdown: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  filterOptionSelected: {
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
  },
  filterOptionText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  filterOptionTextSelected: {
    color: Colors.accent.purple,
    fontWeight: FontWeight.semibold,
  },
  upcomingSection: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textTransform: 'capitalize',
  },
  upcomingList: {
    paddingRight: Spacing.md,
  },
  upcomingCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.md,
    width: UPCOMING_CARD_WIDTH,
  },
  upcomingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  upcomingDateBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  upcomingDateText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  adminBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  upcomingContent: {
    gap: Spacing.xs,
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upcomingTime: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  upcomingProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upcomingProject: {
    fontSize: FontSize.sm,
    color: Colors.accent.blue,
    flex: 1,
  },
  upcomingLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upcomingLocation: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  rehearsalsSection: {
    marginTop: Spacing.xxl,
  },
  emptyState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  loadingState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
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
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSize.base,
    color: Colors.accent.red,
  },
  rehearsalCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rehearsalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  rehearsalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rehearsalTime: {
    fontSize: FontSize.sm,
    color: Colors.accent.purple,
    fontWeight: FontWeight.semibold,
  },
  rehearsalDuration: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  rehearsalScene: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  rehearsalProject: {
    fontSize: FontSize.xs,
    color: Colors.accent.blue,
    marginBottom: Spacing.xs,
  },
  rehearsalNotes: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  // RSVP Styles
  rsvpButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  rsvpConfirmButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rsvpDeclineButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rsvpButtonTextConfirm: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.green,
  },
  rsvpButtonTextDecline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.red,
  },
  rsvpStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
    borderRadius: BorderRadius.sm,
  },
  rsvpConfirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  rsvpDeclined: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  rsvpStatusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  rsvpStatusConfirmed: {
    color: Colors.accent.green,
  },
  rsvpStatusDeclined: {
    color: Colors.accent.red,
  },
  // Admin stats styles
  adminStatsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
    alignItems: 'center',
  },
  adminStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  adminStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  adminStatText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
});
