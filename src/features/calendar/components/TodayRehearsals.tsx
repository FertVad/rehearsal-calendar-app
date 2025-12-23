import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal, RSVPStatus, Project } from '../../../shared/types';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { isRehearsalSynced } from '../../../shared/utils/calendarStorage';
import { ParticipantsModal } from './ParticipantsModal';
import { rehearsalsAPI } from '../../../shared/services/api';

interface AdminStats {
  confirmed: number;
  declined: number;
  tentative: number;
  invited: number;
}

interface TodayRehearsalsProps {
  rehearsals: Rehearsal[];
  selectedDate: string;
  loading: boolean;
  projects: Project[];
  rsvpResponses: Record<string, RSVPStatus>;
  respondingId: string | null;
  adminStats: Record<string, AdminStats>;
  onRSVP: (
    rehearsalId: string,
    currentStatus: RSVPStatus | null,
    onSuccess: (rehearsalId: string, status: RSVPStatus, stats?: AdminStats) => void
  ) => Promise<void>;
  onDeleteRehearsal: (rehearsalId: string) => void;
  setRsvpResponses: React.Dispatch<React.SetStateAction<Record<string, RSVPStatus>>>;
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
  const { t, language } = useI18n();
  const [syncedRehearsals, setSyncedRehearsals] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalParticipants, setModalParticipants] = useState<any[]>([]);

  // Load participants for modal
  const loadParticipants = async (rehearsalId: string) => {
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
        setModalParticipants(participants);
        setModalVisible(true);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  };

  // Check which rehearsals are synced to calendar
  useEffect(() => {
    const checkSyncStatus = async () => {
      const syncStatus: Record<string, boolean> = {};
      for (const rehearsal of rehearsals) {
        const isSynced = await isRehearsalSynced(rehearsal.id);
        syncStatus[rehearsal.id] = isSynced;
      }
      setSyncedRehearsals(syncStatus);
    };

    if (rehearsals.length > 0) {
      checkSyncStatus();
    }
  }, [rehearsals]);

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
                    {syncedRehearsals[rehearsal.id] && (
                      <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="calendar" size={12} color={Colors.accent.green} />
                      </View>
                    )}
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

              {/* Like Button (Telegram-style) */}
              <View style={styles.likeSection}>
                <Pressable
                  style={styles.likeButton}
                  onPress={() => {
                    // Light haptic feedback on tap
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                    // Toggle logic is in the hook, just pass current status
                    onRSVP(rehearsal.id, currentResponse, (id, status, serverStats) => {
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

      {/* Participants Modal (Admin only) */}
      <ParticipantsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        participants={modalParticipants}
        totalCount={modalParticipants.length}
        likedCount={modalParticipants.filter(p => p.hasLiked).length}
      />
    </View>
  );
}
