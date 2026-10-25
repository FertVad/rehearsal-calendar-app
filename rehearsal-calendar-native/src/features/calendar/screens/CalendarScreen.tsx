import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CalendarScreenNavigation } from '../../../navigation';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { SkeletonLoader } from '../../../shared/components';
import WeeklyCalendar from '../components/WeeklyCalendar';
import TodayRehearsals from '../components/TodayRehearsals';
import RehearsalCard from '../components/RehearsalCard';
import SmartPlannerButton from '../components/SmartPlannerButton';
import { Rehearsal } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { useUnread } from '../../../contexts/UnreadContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { addDays, formatDateLocalized } from '../../../shared/utils/time';
import { useToday } from '../../../shared/hooks/useClock';
import { rehearsalOnDate } from '../../../shared/utils/rehearsalDays';
import { useRehearsals } from '../hooks';
import { onDataChanged } from '../../../shared/utils/dataChanged';
import { calendarScreenStyles as styles } from '../styles';
import { unexportRehearsal } from '../../../shared/services/calendarSync';

import { logger } from '../../../shared/utils/logger';
export default function CalendarScreen() {
  const navigation = useNavigation<CalendarScreenNavigation>();
  const { projects } = useProjects();
  const { t, language } = useI18n();
  // Today in the profile's zone, the one rehearsals are dated in (DF01).
  const today = useToday();
  // Until a day is picked, the day shown is today, and moves with it: at
  // midnight, and when the profile's zone changes.
  const [pickedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDate = pickedDate ?? today;
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

  // Straight from the store, so a push landing while this screen is open moves
  // the bell as well as the icon badge. It used to hold its own number and
  // refresh it only when the screen regained focus.
  const { unreadCount } = useUnread();


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
  // A push announcing a rehearsal arrives while this screen is already in
  // focus, so the focus effect below will not fire again. Reload on the signal
  // instead, bypassing the cache — the whole point is that the server has
  // something we do not.
  useEffect(() => onDataChanged('rehearsals', () => fetchRehearsals(true)), [fetchRehearsals]);

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
      logger.error('[CalendarScreen] Rehearsal not found:', rehearsalId);
      Alert.alert(t.common.error, 'Rehearsal not found');
      return;
    }

    // Try to get projectId from rehearsal object (check both camelCase and snake_case)
    const projectId = rehearsal.projectId || (rehearsal as any)?.project_id;

    if (!projectId) {
      logger.error('[CalendarScreen] projectId missing for rehearsal:', rehearsalId, rehearsal);
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

              // Its event, in the sync's queue: after a run already going,
              // which may have read the rehearsal before it was deleted and
              // would put the event back.
              unexportRehearsal(rehearsalId).catch((syncError) => {
                // Don't fail the whole operation if unsync fails
                logger.error('[CalendarScreen] Failed to unsync from calendar:', syncError);
              });

              // Force refetch rehearsals after deletion (bypass cache)
              await fetchRehearsals(true);

              Alert.alert(t.common.success, t.rehearsals.deleteSuccess);
            } catch (err: any) {
              logger.error('[CalendarScreen] Failed to delete rehearsal:', err);
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

  // The rehearsals on the selected day (defaults to today): the ones starting
  // on it, and the ones running into it from the day before (DD02), in the
  // order they start.
  const selectedDateRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => rehearsalOnDate(r, selectedDate))
      .sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''));
  }, [rehearsals, selectedDate]);

  const upcomingRehearsals = useMemo(() => {
    // After the day being shown above, and never in the past.
    //
    // This compared against today alone, which is only the same thing while
    // today is the day selected. Pick tomorrow in the strip and its rehearsals
    // appeared both in the section above and here — the very duplication the
    // rule was written to prevent. Selecting a past day keeps the floor at
    // today, so nothing that has already happened is listed as upcoming.
    const after = selectedDate > today ? selectedDate : today;

    return rehearsals
      .filter(r => r.date && r.date > after)
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
  }, [rehearsals, selectedDate, today]);

  // Get relative date label (Today, Tomorrow, or formatted date)
  const getRelativeDateLabel = (dateStr: string) => {
    const tomorrowStr = addDays(today, 1);

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
            testID="calendar-filter"
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
              <View style={styles.bellBadge} testID="unread-badge">
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
                testID="calendar-filter-option"
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
              // The Planner tab's own stack, beside this one.
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
