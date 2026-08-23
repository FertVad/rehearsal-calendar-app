import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal, RSVPStatus } from '../../../shared/types';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';

export interface AdminStats {
  confirmed: number;
  invited: number;
}

interface RehearsalCardProps {
  rehearsal: Rehearsal;
  /** Shown as a badge above the time — "Today", "Tomorrow", a date. Omitted
   *  under a heading that already says which day these belong to. */
  dateLabel?: string;
  /** The two lists disagreed on where this comes from — one read the project
   *  the rehearsal belongs to, the other the name denormalised onto it. The
   *  caller decides now. */
  projectName?: string;
  isAdmin: boolean;
  isSynced?: boolean;
  currentResponse: RSVPStatus;
  isResponding: boolean;
  stats?: AdminStats;
  onPress: () => void;
  onDelete: (rehearsalId: string) => void;
  onToggleSeen: (
    rehearsalId: string,
    currentStatus: RSVPStatus | null,
    onSuccess: (rehearsalId: string, status: RSVPStatus, stats?: AdminStats) => void
  ) => void | Promise<void>;
  onSeenChanged: (rehearsalId: string, status: RSVPStatus, stats?: AdminStats) => void;
}

/**
 * One rehearsal, as it appears in a list.
 *
 * Today's rehearsals and the upcoming ones used to render this separately, so
 * every change had to be made twice — which is how the rehearsal title nearly
 * shipped visible in one list and missing from the other.
 */
export default function RehearsalCard({
  rehearsal,
  dateLabel,
  projectName,
  isAdmin,
  isSynced = false,
  currentResponse,
  isResponding,
  stats,
  onPress,
  onDelete,
  onToggleSeen,
  onSeenChanged,
}: RehearsalCardProps) {
  const { t } = useI18n();
  const navigation = useNavigation<any>();

  const seenLabel =
    stats && (stats.confirmed > 0 || isAdmin)
      ? isAdmin && stats.invited > 0
        ? `${stats.confirmed}/${stats.invited}`
        : `${stats.confirmed}`
      : null;

  return (
    <View style={styles.upcomingCard}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.upcomingCardRow}>
          <View style={styles.upcomingCardLeftCol}>
            {dateLabel ? (
              <View style={styles.upcomingCardHeader}>
                <View style={styles.upcomingDateBadge}>
                  <Text style={styles.upcomingDateText}>{dateLabel}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.upcomingContent}>
              <View style={styles.upcomingTimeRow}>
                <Ionicons name="time-outline" size={14} color={Colors.accent.purple} />
                <Text style={styles.upcomingTime}>
                  {rehearsal.time?.substring(0, 5) || ''}
                  {rehearsal.endTime && ` — ${rehearsal.endTime.substring(0, 5)}`}
                </Text>
                {isSynced && (
                  <Ionicons name="calendar" size={14} color={Colors.accent.green} />
                )}
              </View>

              {rehearsal.title ? (
                <Text style={styles.upcomingTitle} numberOfLines={2}>
                  {rehearsal.title}
                </Text>
              ) : null}

              {projectName && (
                <View style={styles.upcomingProjectRow}>
                  <Ionicons name="folder-outline" size={14} color={Colors.accent.blue} />
                  <Text style={styles.upcomingProject} numberOfLines={1}>
                    {projectName}
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
          </View>

          {isAdmin && (
            <View style={styles.upcomingCardAdminCol}>
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                <Text style={styles.adminBadgeText}>{t.projects.admin}</Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation();
                  onDelete(rehearsal.id);
                }}
                style={styles.iconButton}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation();
                  navigation.navigate('AddRehearsal', {
                    rehearsalId: rehearsal.id,
                    projectId: rehearsal.projectId,
                  });
                }}
                style={styles.iconButton}
              >
                <Ionicons name="create-outline" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.seenSection}>
        <Pressable
          style={styles.seenButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onToggleSeen(rehearsal.id, currentResponse, onSeenChanged);
          }}
          disabled={isResponding}
        >
          <Ionicons
            name={currentResponse === 'yes' ? 'eye' : 'eye-off-outline'}
            size={24}
            color={currentResponse === 'yes' ? Colors.accent.blue : Colors.text.secondary}
          />
          {seenLabel && <Text style={styles.seenCount}>{seenLabel}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
