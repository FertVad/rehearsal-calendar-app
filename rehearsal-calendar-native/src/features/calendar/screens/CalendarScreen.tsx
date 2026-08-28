import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Alert, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../shared/constants/colors';
import { SkeletonLoader } from '../../../shared/components';
import WeeklyCalendar from '../components/WeeklyCalendar';
import MyRehearsalsModal from '../components/MyRehearsalsModal';
import TodayRehearsals from '../components/TodayRehearsals';
import RehearsalCard from '../components/RehearsalCard';
import SmartPlannerButton from '../components/SmartPlannerButton';
import { RehearsalDetailsModal } from '../components/RehearsalDetailsModal';
import { Rehearsal } from '../../../shared/types';
import { notificationsAPI } from '../../../shared/services/api';
import { consumePendingRehearsal, subscribePendingRehearsal } from '../../../shared/services/pendingRehearsal';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { useRehearsals, useRSVP } from '../hooks';
import { calendarScreenStyles as styles } from '../styles';
import { unsyncRehearsal } from '../../../shared/services/calendar';

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { projects } = useProjects();
  const { t, language } = useI18n();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateToString(new Date());
  });
  const [myRehearsalsVisible, setMyRehearsalsVisible] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedRehearsalForDetails, setSelectedRehearsalForDetails] = useState<Rehearsal | null>(null);


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
    rsvpResponses,
    setRsvpResponses,
    adminStats,
    setAdminStats,
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

  // A tapped notification leaves the rehearsal's id in pendingRehearsal rather
  // than in route params — see that module for why the navigator turned out to
  // be the wrong place to put it.
  const [wantedRehearsalId, setWantedRehearsalId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const take = () => {
        const id = consumePendingRehearsal();
        if (id) setWantedRehearsalId(id);
      };
      take();
      // Also while already on screen: a push tapped with the calendar in front
      // would otherwise never be focused again.
      return subscribePendingRehearsal(take);
    }, [])
  );

  // A notification announces something the cache predates almost by definition,
  // so ask for fresh data rather than waiting for the next scheduled refresh.
  useEffect(() => {
    if (wantedRehearsalId) fetchRehearsals(true);
  }, [wantedRehearsalId, fetchRehearsals]);

  // Counts dismissals of the details sheet, so the effect below can wait for one.
  const [detailsDismissals, setDetailsDismissals] = useState(0);

  useEffect(() => {
    if (!wantedRehearsalId) return;

    const target = rehearsals.find(r => String(r.id) === String(wantedRehearsalId));
    if (!target) {
      // Give up rather than wait forever. If it has not turned up by now it is
      // one this user cannot see: deleted, or a rehearsal they were taken off.
      const giveUp = setTimeout(() => setWantedRehearsalId(null), 10000);
      return () => clearTimeout(giveUp);
    }

    if (detailsModalVisible) {
      // Already showing the one asked for — nothing to do.
      if (String(selectedRehearsalForDetails?.id) === String(target.id)) {
        setWantedRehearsalId(null);
        return;
      }

      // Close first and come back on the dismissal. Opening a sheet over one
      // that is still on screen leaves iOS holding a layer it never removes:
      // the rehearsal can still be swiped away, and the calendar underneath
      // stays visible and completely dead to touch. That is what happens when a
      // second notification is tapped from the tray with this sheet open.
      setDetailsModalVisible(false);
      // onDismiss is iOS-only. Elsewhere nothing would ever bring us back, so a
      // timer stands in; on iOS the real event arrives first and this extra
      // nudge finds the work already done.
      const fallback = setTimeout(() => setDetailsDismissals(n => n + 1), 600);
      return () => clearTimeout(fallback);
    }

    setSelectedRehearsalForDetails(target);
    setDetailsModalVisible(true);
    setWantedRehearsalId(null);
  }, [wantedRehearsalId, rehearsals, detailsModalVisible, selectedRehearsalForDetails, detailsDismissals]);

  const { respondingId, toggleSeen } = useRSVP();

  const handleDayLongPress = useCallback((date: string) => {
    navigation.navigate('AddRehearsal', {
      prefilledDate: date,
    });
  }, [navigation]);

  const handleMyRehearsalsClose = useCallback(() => {
    setMyRehearsalsVisible(false);
  }, []);

  const handleSelectDateFromModal = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

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
          rsvpResponses={rsvpResponses}
          respondingId={respondingId}
          adminStats={adminStats}
          onRSVP={toggleSeen}
          onDeleteRehearsal={handleDeleteRehearsal}
          setRsvpResponses={setRsvpResponses}
          setAdminStats={setAdminStats}
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
                const currentResponse = rsvpResponses[rehearsal.id];
                const isResponding = respondingId === rehearsal.id;
                const project = projects.find(p => p.id === rehearsal.projectId);
                // Check if user is admin for THIS specific rehearsal's project
                const isAdminForThisRehearsal = project?.is_admin || false;
                const stats = adminStats[rehearsal.id];

                return (
                  <RehearsalCard
                    key={rehearsal.id}
                    rehearsal={rehearsal}
                    dateLabel={getRelativeDateLabel(rehearsal.date || '')}
                    projectName={project?.name || rehearsal.projectName}
                    isAdmin={isAdminForThisRehearsal}
                    currentResponse={currentResponse}
                    isResponding={isResponding}
                    stats={stats}
                    onPress={() => {
                      setSelectedRehearsalForDetails(rehearsal);
                      setDetailsModalVisible(true);
                    }}
                    onDelete={handleDeleteRehearsal}
                    onToggleSeen={toggleSeen}
                    onSeenChanged={(id, status, serverStats) => {
                      setRsvpResponses(prev => ({ ...prev, [id]: status }));
                      if (serverStats && isAdminForThisRehearsal) {
                        setAdminStats(prev => ({ ...prev, [id]: serverStats }));
                      }
                    }}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* My Rehearsals Modal */}
      <MyRehearsalsModal
        visible={myRehearsalsVisible}
        onClose={handleMyRehearsalsClose}
        rehearsals={rehearsals}
        onSelectDate={handleSelectDateFromModal}
      />

      {/* Rehearsal Details Modal */}
      <RehearsalDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        onDismiss={() => setDetailsDismissals(n => n + 1)}
        rehearsal={selectedRehearsalForDetails}
        project={selectedRehearsalForDetails ? projects.find(p => p.id === selectedRehearsalForDetails.projectId) || null : null}
        isAdmin={selectedRehearsalForDetails ? projects.find(p => p.id === selectedRehearsalForDetails.projectId)?.is_admin || false : false}
        currentResponse={selectedRehearsalForDetails ? rsvpResponses[selectedRehearsalForDetails.id] : null}
        onRSVP={toggleSeen}
        onRSVPSuccess={(id, status, serverStats) => {
          setRsvpResponses(prev => ({ ...prev, [id]: status }));
          if (serverStats && selectedRehearsalForDetails) {
            const isAdminForThisRehearsal = projects.find(p => p.id === selectedRehearsalForDetails.projectId)?.is_admin || false;
            if (isAdminForThisRehearsal) {
              setAdminStats(prev => ({ ...prev, [id]: serverStats }));
            }
          }
        }}
      />
    </SafeAreaView>
  );
}
