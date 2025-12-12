import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { calendarScreenStyles as styles } from '../styles';

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
  rsvpResponses: Record<string, 'yes' | 'no'>;
  respondingId: string | null;
  adminStats: Record<string, AdminStats>;
  onRSVP: (
    rehearsalId: string,
    response: 'yes' | 'no',
    rsvpResponses: Record<string, 'yes' | 'no'>,
    setRsvpResponses: React.Dispatch<React.SetStateAction<Record<string, 'yes' | 'no'>>>,
    adminStats: Record<string, AdminStats>,
    setAdminStats: React.Dispatch<React.SetStateAction<Record<string, AdminStats>>>
  ) => Promise<void>;
  onDeleteRehearsal: (rehearsalId: string) => void;
  setRsvpResponses: React.Dispatch<React.SetStateAction<Record<string, 'yes' | 'no'>>>;
  setAdminStats: React.Dispatch<React.SetStateAction<Record<string, AdminStats>>>;
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
  setAdminStats,
}: TodayRehearsalsProps) {
  // Get date label (Сегодня, Завтра, or formatted date)
  const dateLabel = useMemo(() => {
    const today = formatDateToString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateToString(tomorrow);

    if (selectedDate === today) return 'Сегодня';
    if (selectedDate === tomorrowStr) return 'Завтра';
    return formatDateLocalized(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' });
  }, [selectedDate]);

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
          <Text style={styles.emptyText}>Репетиций не запланировано</Text>
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
            <View key={rehearsal.id} style={styles.rehearsalCard}>
              <View style={styles.rehearsalHeader}>
                <View style={styles.rehearsalInfo}>
                  <Text style={styles.rehearsalTime}>
                    {rehearsal.time}
                  </Text>
                  {rehearsal.endTime && (
                    <Text style={styles.rehearsalDuration}>
                      - {rehearsal.endTime}
                    </Text>
                  )}
                </View>
                {isAdminForThisRehearsal && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDeleteRehearsal(rehearsal.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.rehearsalScene}>{rehearsal.scene}</Text>

              {project && (
                <Text style={styles.rehearsalProject}>
                  {project.name}
                </Text>
              )}

              {rehearsal.location && (
                <Text style={styles.rehearsalNotes}>{rehearsal.location}</Text>
              )}

              {/* RSVP Section */}
              {currentResponse ? (
                <View
                  style={[
                    styles.rsvpStatus,
                    currentResponse === 'yes' ? styles.rsvpConfirmed : styles.rsvpDeclined,
                  ]}
                >
                  <Ionicons
                    name={currentResponse === 'yes' ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={currentResponse === 'yes' ? Colors.accent.green : Colors.accent.red}
                  />
                  <Text
                    style={[
                      styles.rsvpStatusText,
                      currentResponse === 'yes'
                        ? styles.rsvpStatusConfirmed
                        : styles.rsvpStatusDeclined,
                    ]}
                  >
                    {currentResponse === 'yes' ? 'Вы подтвердили участие' : 'Вы отклонили'}
                  </Text>
                </View>
              ) : (
                <View style={styles.rsvpButtons}>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpConfirmButton]}
                    onPress={() =>
                      onRSVP(
                        rehearsal.id,
                        'yes',
                        rsvpResponses,
                        setRsvpResponses,
                        adminStats,
                        setAdminStats
                      )
                    }
                    disabled={isResponding}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.accent.green} />
                    <Text style={styles.rsvpButtonTextConfirm}>Приду</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpDeclineButton]}
                    onPress={() =>
                      onRSVP(
                        rehearsal.id,
                        'no',
                        rsvpResponses,
                        setRsvpResponses,
                        adminStats,
                        setAdminStats
                      )
                    }
                    disabled={isResponding}
                  >
                    <Ionicons name="close" size={18} color={Colors.accent.red} />
                    <Text style={styles.rsvpButtonTextDecline}>Не приду</Text>
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
