import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';

interface Project {
  id: string;
  name: string;
  is_admin: boolean;
}

interface AdminStats {
  confirmed: number;
  declined: number;
  pending: number;
}

interface TodayRehearsalsProps {
  rehearsals: Rehearsal[];
  selectedDate: string;
  loading: boolean;
  projects: Project[];
  rsvpResponses: Record<string, 'confirmed' | 'declined'>;
  respondingId: string | null;
  adminStats: Record<string, AdminStats>;
  onRSVP: (
    rehearsalId: string,
    response: 'confirmed' | 'declined',
    onSuccess: (rehearsalId: string, status: 'confirmed' | 'declined') => void
  ) => Promise<void>;
  onDeleteRehearsal: (rehearsalId: string) => void;
  setRsvpResponses: React.Dispatch<React.SetStateAction<Record<string, 'confirmed' | 'declined'>>>;
  updateAdminStats: (rehearsalId: string) => Promise<void>;
}

export default function TodayRehearsals({
  rehearsals,
  selectedDate,
  loading,
  projects,
  rsvpResponses,
  respondingId,
  adminStats,
  onRSVP,
  onDeleteRehearsal,
  setRsvpResponses,
  updateAdminStats,
}: TodayRehearsalsProps) {
  const { t, language } = useI18n();

  // Get date label (Сегодня, Завтра, or formatted date)
  const dateLabel = useMemo(() => {
    const today = formatDateToString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateToString(tomorrow);

    if (selectedDate === today) return t.common.today;
    if (selectedDate === tomorrowStr) return t.calendar.tomorrow;
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    return formatDateLocalized(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' }, locale);
  }, [selectedDate, t, language]);

  if (loading) {
    return (
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>{dateLabel}</Text>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      </View>
    );
  }

  if (rehearsals.length === 0) {
    return (
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>{dateLabel}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t.calendar.noRehearsals}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.todaySection}>
      <Text style={styles.sectionTitle}>{dateLabel}</Text>
      <View style={styles.todayList}>
        {rehearsals.map((rehearsal) => {
          const currentResponse = rsvpResponses[rehearsal.id];
          const isResponding = respondingId === rehearsal.id;
          const project = projects.find(p => p.id === rehearsal.projectId);
          const isAdminForThisRehearsal = project?.is_admin || false;
          const stats = adminStats[rehearsal.id];

          return (
            <View key={rehearsal.id} style={styles.upcomingCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={styles.upcomingTimeRow}>
                    <Ionicons name="time-outline" size={14} color={Colors.accent.purple} />
                    <Text style={styles.upcomingTime}>
                      {rehearsal.time?.substring(0, 5) || ''}
                      {rehearsal.endTime && ` — ${rehearsal.endTime.substring(0, 5)}`}
                    </Text>
                  </View>

                  {project && (
                    <View style={styles.upcomingProjectRow}>
                      <Ionicons name="folder-outline" size={14} color={Colors.accent.blue} />
                      <Text style={styles.upcomingProject} numberOfLines={1}>
                        {project.name}
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

                {isAdminForThisRehearsal && (
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                      <Text style={styles.adminBadgeText}>{t.projects.admin}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onDeleteRehearsal(rehearsal.id)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        // TODO: Implement edit functionality
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="create-outline" size={18} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* RSVP Section */}
              {currentResponse ? (
                <View
                  style={[
                    styles.rsvpStatus,
                    currentResponse === 'confirmed' ? styles.rsvpConfirmed : styles.rsvpDeclined,
                  ]}
                >
                  <Ionicons
                    name={currentResponse === 'confirmed' ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={currentResponse === 'confirmed' ? Colors.accent.green : Colors.accent.red}
                  />
                  <Text
                    style={[
                      styles.rsvpStatusText,
                      currentResponse === 'confirmed'
                        ? styles.rsvpStatusConfirmed
                        : styles.rsvpStatusDeclined,
                    ]}
                  >
                    {currentResponse === 'confirmed' ? t.calendar.attendanceConfirmed : t.calendar.attendanceDeclined}
                  </Text>
                </View>
              ) : (
                <View style={styles.rsvpButtons}>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpConfirmButton]}
                    onPress={() =>
                      onRSVP(rehearsal.id, 'confirmed', (id, status) => {
                        setRsvpResponses(prev => ({ ...prev, [id]: status }));
                        updateAdminStats(id);
                      })
                    }
                    disabled={isResponding}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.accent.green} />
                    <Text style={styles.rsvpButtonTextConfirm}>{t.calendar.willAttend}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpDeclineButton]}
                    onPress={() =>
                      onRSVP(rehearsal.id, 'declined', (id, status) => {
                        setRsvpResponses(prev => ({ ...prev, [id]: status }));
                        updateAdminStats(id);
                      })
                    }
                    disabled={isResponding}
                  >
                    <Ionicons name="close" size={18} color={Colors.accent.red} />
                    <Text style={styles.rsvpButtonTextDecline}>{t.calendar.wontAttend}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Admin Stats */}
              {isAdminForThisRehearsal && stats && (
                <View style={styles.adminStatsSection}>
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
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
