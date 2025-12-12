import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Alert, FlatList } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, CompositeScreenProps } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { TabParamList, AppStackParamList } from '../../../navigation';
import WeeklyCalendar from '../components/WeeklyCalendar';
import DayDetailsModal from '../components/DayDetailsModal';
import MyRehearsalsModal from '../components/MyRehearsalsModal';
import TodayRehearsals from '../components/TodayRehearsals';
import SmartPlannerButton from '../components/SmartPlannerButton';
import { Rehearsal } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { formatDateLocalized, formatDateToString, parseDateString } from '../../../shared/utils/time';
import { useRehearsals, useRSVP } from '../hooks';
import { calendarScreenStyles as styles } from '../styles';

type CalendarScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Calendar'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { projects, selectedProject } = useProjects();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [myRehearsalsVisible, setMyRehearsalsVisible] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);

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
              // Refetch rehearsals after deletion
              await fetchRehearsals();
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

            {/* Admin Badge - only show for specific project where user is admin */}
            {screenMode === 'admin' && currentProject && (
              <View style={styles.adminBadgeInline}>
                <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                <Text style={styles.adminBadgeText}>Админ</Text>
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
                            <Text style={styles.adminBadgeText}>Админ</Text>
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

                    {/* RSVP Section - different for admin and regular user */}
                    {isAdminForThisRehearsal ? (
                      // Admin sees stats for their projects
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
                          onPress={() => handleRSVP(rehearsal.id, 'confirmed', (id, status) => {
                            setRsvpResponses(prev => ({ ...prev, [id]: status }));
                            // Update only stats for this rehearsal (no full refetch)
                            updateAdminStats(id);
                          })}
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
                          onPress={() => handleRSVP(rehearsal.id, 'declined', (id, status) => {
                            setRsvpResponses(prev => ({ ...prev, [id]: status }));
                            // Update only stats for this rehearsal (no full refetch)
                            updateAdminStats(id);
                          })}
                          disabled={isResponding}
                        >
                          <Ionicons name="close-circle" size={18} color={Colors.accent.red} />
                          <Text style={styles.rsvpButtonTextDecline}>Не приду</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
    </SafeAreaView>
  );
}
