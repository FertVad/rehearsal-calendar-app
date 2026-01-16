import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Rehearsal, RSVPStatus, Project } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDateLocalized } from '../../../shared/utils/time';

interface Participant {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  hasLiked: boolean;
  hasResponded: boolean;
}

interface AdminStats {
  confirmed: number;
  invited: number;
}

interface RehearsalDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  rehearsal: Rehearsal | null;
  project: Project | null;
  isAdmin: boolean;
  currentResponse: RSVPStatus | null;
  onRSVP: (
    rehearsalId: string,
    currentStatus: RSVPStatus | null,
    onSuccess: (rehearsalId: string, status: RSVPStatus, stats?: AdminStats) => void
  ) => Promise<void>;
  onRSVPSuccess?: (rehearsalId: string, status: RSVPStatus, stats?: AdminStats) => void;
}

export const RehearsalDetailsModal: React.FC<RehearsalDetailsModalProps> = ({
  visible,
  onClose,
  rehearsal,
  project,
  isAdmin,
  currentResponse,
  onRSVP,
  onRSVPSuccess,
}) => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(false);
  const [respondingUserId, setRespondingUserId] = useState<string | null>(null);
  const [localResponse, setLocalResponse] = useState<RSVPStatus | null>(currentResponse);

  // Load participants
  useEffect(() => {
    if (!visible || !rehearsal) {
      setParticipants([]);
      setStats(null);
      return;
    }

    const loadParticipants = async () => {
      setLoading(true);
      try {
        const res = await rehearsalsAPI.getResponses(rehearsal.id);
        console.log('[RehearsalDetailsModal] API response:', JSON.stringify(res.data, null, 2));

        if (res.data.allParticipants) {
          const participantsList = res.data.allParticipants.map((p: any) => ({
            userId: p.userId,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            hasLiked: p.response === 'yes',
            hasResponded: p.response === 'yes', // 'no' means invited but not responded (same UI as not responded)
          }));
          console.log('[RehearsalDetailsModal] Participants list:', participantsList);
          setParticipants(participantsList);

          // Calculate stats
          const confirmed = participantsList.filter((p: Participant) => p.hasLiked).length;
          const invited = participantsList.length;
          setStats({ confirmed, invited });
        } else {
          console.log('[RehearsalDetailsModal] No allParticipants in response');
        }
      } catch (err) {
        console.error('Failed to load participants:', err);
      } finally {
        setLoading(false);
      }
    };

    loadParticipants();
  }, [visible, rehearsal]);

  // Update local response when prop changes
  useEffect(() => {
    setLocalResponse(currentResponse);
  }, [currentResponse]);

  if (!rehearsal) return null;

  const handleParticipantToggle = async (participant: Participant) => {
    // Only allow users to toggle their own status
    if (!user || participant.userId !== user.id.toString()) {
      return;
    }

    setRespondingUserId(participant.userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await onRSVP(rehearsal.id, participant.hasLiked ? 'yes' : null, (id, status, serverStats) => {
      // Update participant list
      setParticipants(prev => prev.map(p =>
        p.userId === participant.userId
          ? { ...p, hasLiked: status === 'yes', hasResponded: true }
          : p
      ));

      if (serverStats) {
        setStats(serverStats);
      }

      // Update parent component state
      if (onRSVPSuccess) {
        onRSVPSuccess(id, status, serverStats);
      }
    });

    setRespondingUserId(null);
  };

  const renderParticipant = ({ item }: { item: Participant }) => {
    const displayName = `${item.firstName}${item.lastName ? ' ' + item.lastName : ''}`;
    const isCurrentUser = user && item.userId === user.id.toString();
    const isThisParticipantResponding = respondingUserId === item.userId;

    let iconName: any;
    let iconColor: string;

    if (!item.hasResponded) {
      iconName = 'help-circle-outline';
      iconColor = Colors.text.tertiary;
    } else if (item.hasLiked) {
      iconName = 'heart';
      iconColor = Colors.accent.red;
    } else {
      iconName = 'heart-outline';
      iconColor = Colors.text.tertiary;
    }

    const content = (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{displayName}</Text>
          <Text style={styles.participantEmail}>{item.email}</Text>
        </View>
        {isThisParticipantResponding ? (
          <ActivityIndicator size="small" color={Colors.accent.purple} />
        ) : (
          <Ionicons name={iconName} size={20} color={iconColor} />
        )}
      </View>
    );

    if (isCurrentUser) {
      return (
        <Pressable
          key={item.userId}
          onPress={() => handleParticipantToggle(item)}
          disabled={isThisParticipantResponding}
        >
          {content}
        </Pressable>
      );
    }

    return <View key={item.userId}>{content}</View>;
  };

  // Format date
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const formattedDate = rehearsal.date
    ? formatDateLocalized(rehearsal.date, { day: 'numeric', month: 'long', weekday: 'long' }, locale)
    : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="calendar" size={24} color={Colors.accent.purple} />
              <Text style={styles.headerTitle}>
                {t.rehearsals.rehearsalDetails}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Date */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.blue} />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            {/* Time */}
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.detailText}>
                {rehearsal.time?.substring(0, 5) || ''}
                {rehearsal.endTime && ` — ${rehearsal.endTime.substring(0, 5)}`}
              </Text>
            </View>

            {/* Project */}
            {project && (
              <View style={styles.detailRow}>
                <Ionicons name="folder-outline" size={20} color={Colors.accent.blue} />
                <Text style={styles.detailText}>{project.name}</Text>
              </View>
            )}

            {/* Location */}
            {rehearsal.location && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailText}>{rehearsal.location}</Text>
              </View>
            )}

            {/* Participants Section */}
            <View style={styles.divider} />

            {/* Participants List */}
            <View style={styles.participantsTitleRow}>
              <Text style={styles.participantsTitle}>
                {t.rehearsals.participants || 'Участники'}
              </Text>
              {isAdmin && stats && (
                <View style={styles.statBadge}>
                  <Ionicons name="heart" size={16} color={Colors.accent.red} />
                  <Text style={styles.statText}>
                    {stats.confirmed}/{stats.invited}
                  </Text>
                </View>
              )}
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.accent.purple} />
              </View>
            ) : participants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {t.rehearsals.noMembers}
                </Text>
              </View>
            ) : (
              <View style={styles.participantsList}>
                {participants.map((participant) => (
                  <View key={participant.userId}>
                    {renderParticipant({ item: participant })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    height: '70%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glass.border,
    marginVertical: Spacing.lg,
  },
  participantsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  participantsTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.glass.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  statText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  participantsList: {
    gap: Spacing.sm,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  participantEmail: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
  },
});
