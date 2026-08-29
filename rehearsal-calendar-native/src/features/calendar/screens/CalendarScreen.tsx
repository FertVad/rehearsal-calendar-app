import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { SkeletonLoader } from '../../../shared/components';
import WeeklyCalendar from '../components/WeeklyCalendar';
import TodayRehearsals from '../components/TodayRehearsals';
import RehearsalCard from '../components/RehearsalCard';
import SmartPlannerButton from '../components/SmartPlannerButton';
import { Rehearsal } from '../../../shared/types';
import { notificationsAPI } from '../../../shared/services/api';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { useRehearsals } from '../hooks';
import { calendarScreenStyles as styles } from '../styles';
import { unsyncRehearsal } from '../../../shared/services/calendar';

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { projects } = useProjects();
  const { t, language } = useI18n();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateToString(new Date());
  });
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
    refreshing,
    error,
    fetchRehearsals,
  } = useRehearsals(projects, filterProjectId);

  // Refetched on focus rather than once: a push can land while this screen sits
  // behind another, and the bell has to agree with the badge on the app icon.
  const [unreadCount, setUnreadCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      notificationsAPI
        .unreadCount()
        .then((res) => {
          if (alive) setUnreadCount(res.data.unreadCount ?? 0);
        })
        .catch(() => {
          // Offline. The bell simply shows no count.
        });
      return () => {
        alive = false;
      };
    }, [])
  );


  // Opening the details is now a navigation, so there is nothing to hold here
  // and nothing to sequence: the navigator will not present two sheets over
  // each other the way two React Native Modals could.
  const openDetails = useCallback((rehearsal: Rehearsal) => {
    navigation.navigate('RehearsalDetails', { rehearsalId: String(rehearsal.id) });
  }, [navigation]);


  const handleDayLongPress = useCallback((date: string) => {
    navigation.navigate('AddRehearsal', {
      prefilledDate: date,
    });
  }, [navigation]);

  // Pull-to-refresh handler (forces update, ignores cache)
  const handleRefresh = useCallback(() => {
    fetchRehearsals(true);
  }, [fetchRehearsals]);

  // Fetch rehearsals when screen is focused (with smart caching)
  useFocusEffect(
    useCallback(() => {
      fetchRehearsals();
    }, [fetchRehearsals])
  );

  // Refetch when filter changes (force refresh to bypass cache)
  React.useEffect(() => {
    fetchRehearsals(true);
  }, [filterProjectId, fetchRehearsals]);

  const handleDeleteRehearsal = async (rehearsalId: string) => {
    // Find the rehearsal to get its projectId
    const rehearsal = rehearsals.find(r => r.id === rehearsalId);

    if (!rehearsal) {
      console.error('[CalendarScreen] Rehearsal not found:', rehearsalId);
      Alert.alert(t.common.error, 'Rehearsal not found');
      return;
    }

    // Try to get projectId from rehearsal object (check both camelCase and snake_case)
    const projectId = rehearsal.projectId || (rehearsal as any)?.project_id;

    if (!projectId) {
      console.error('[CalendarScreen] projectId missing for rehearsal:', rehearsalId, rehearsal);
      Alert.alert(t.common.error, 'Cannot delete: project ID is missing');
      return;
    }

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
              } catch (syncError) {
                // Don't fail the whole operation if unsync fails
                console.error('[CalendarScreen] Failed to unsync from calendar:', syncError);
              }

              // Force refetch rehearsals after deletion (bypass cache)
              await fetchRehearsals(true);

              Alert.alert(t.common.success, t.rehearsals.deleteSuccess);
            } catch (err: any) {
              console.error('[CalendarScreen] Failed to delete rehearsal:', err);
              const errorMessage = err.response?.data?.error || err.message || t.rehearsals.createError;
              Alert.alert(t.common.error, errorMessage);
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

    // Strictly after today: the Today section directly above already lists
    // today's, and showing the same card twice on one screen reads as a bug.
    return rehearsals
      .filter(r => r.date && r.date > today)
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
    const locale = getDateLocale(language);
    return formatDateLocalized(dateStr, { day: 'numeric', month: 'short', weekday: 'short' }, locale);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent.purple}
            colors={[Colors.accent.purple]}
          />
        }
      >
        {/* Project filter, with the notification bell beside it.
            Sharing this row rather than taking one of its own: the calendar is
            the densest screen in the app and the bell needs no height of its
            own. */}
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

          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel={t.notifications.title}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={22}
              color={unreadCount > 0 ? Colors.accent.purple : Colors.text.secondary}
            />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
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
            onPress={(projectId) => {
              // @ts-ignore - Navigate to Planner tab, which is in parent TabNavigator
              navigation.navigate('Planner', { screen: 'SmartPlanner', params: { projectId } });
            }}
          />
        )}

        {/* Selected Date Rehearsals */}
        <TodayRehearsals
          rehearsals={selectedDateRehearsals}
          selectedDate={selectedDate}
          loading={loading}
          projects={projects}
          onDeleteRehearsal={handleDeleteRehearsal}
          onOpenRehearsal={openDetails}
        />

        {/* Upcoming Events */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>{t.calendar.upcomingEvents}</Text>

          {loading ? (
            <View style={styles.upcomingList}>
              {[1, 2, 3].map((key) => (
                <View key={key} style={styles.upcomingCard}>
                  <View style={styles.upcomingCardHeader}>
                    <SkeletonLoader width={120} height={24} borderRadius={12} />
                  </View>
                  <View style={styles.upcomingContent}>
                    <SkeletonLoader width="60%" height={16} style={styles.skeletonRow} />
                    <SkeletonLoader width="80%" height={16} style={styles.skeletonRow} />
                    <SkeletonLoader width="70%" height={16} />
                  </View>
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t.calendar.needProject}</Text>
            </View>
          ) : upcomingRehearsals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>{t.calendar.noUpcoming}</Text>
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingRehearsals.map((rehearsal) => {
                const project = projects.find(p => p.id === rehearsal.projectId);
                // Check if user is admin for THIS specific rehearsal's project
                const isAdminForThisRehearsal = project?.is_admin || false;

                return (
                  <RehearsalCard
                    key={rehearsal.id}
                    rehearsal={rehearsal}
                    dateLabel={getRelativeDateLabel(rehearsal.date || '')}
                    projectName={project?.name || rehearsal.projectName}
                    isAdmin={isAdminForThisRehearsal}
                    onPress={() => openDetails(rehearsal)}
                    onDelete={handleDeleteRehearsal}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>


    </SafeAreaView>
  );
}
