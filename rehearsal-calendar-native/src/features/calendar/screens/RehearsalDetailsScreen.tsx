import { logger } from '../../../shared/utils/logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { useAuth } from '../../../contexts/AuthContext';
import { useSeen } from '../../../contexts/SeenContext';
import { Rehearsal, Project } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDateLocalized } from '../../../shared/utils/time';

interface Participant {
  userId: string;
  firstName: string;
  lastName: string;
  hasSeen: boolean;
  hasResponded: boolean;
}

interface AdminStats {
  confirmed: number;
  invited: number;
}

/**
 * One rehearsal, in full.
 *
 * A screen rather than a Modal, and reached by id rather than handed an object.
 * Both of those are deliberate. Mixing React Native's Modal with the
 * navigator's own modal screens is what stranded a layer over the calendar and
 * left it visible but dead to touch; as a route, presentation, stacking and
 * dismissal are the navigator's problem and cannot collide. And taking an id
 * means any screen — a card, a tapped notification, the inbox, in time a link
 * from outside the app — can open it without holding the rehearsal first.
 */

export default function RehearsalDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rehearsalId: string = String(route.params?.rehearsalId ?? '');

  const { t, language } = useI18n();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { toggleSeen, statsFor } = useSeen();

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Loaded here rather than passed in — see the note above the component.
  useEffect(() => {
    let alive = true;
    if (!rehearsalId) return;

    rehearsalsAPI
      .getById(rehearsalId)
      .then((res: any) => {
        if (alive) setRehearsal(res.data.rehearsal);
      })
      .catch((err: any) => {
        logger.warn('[RehearsalDetails] Could not load:', err);
        if (alive) setLoadFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [rehearsalId]);

  const project = rehearsal ? projects.find(p => p.id === rehearsal.projectId) || null : null;
  const isAdmin = project?.is_admin || false;
  const onClose = () => navigation.goBack();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [respondingUserId, setRespondingUserId] = useState<string | null>(null);

  // Load participants
  useEffect(() => {
    if (!rehearsal) {
      setParticipants([]);
      setStats(null);
      return;
    }

    const loadParticipants = async () => {
      setLoading(true);
      try {
        const res = await rehearsalsAPI.getResponses(rehearsal.id);

        if (res.data.allParticipants) {
          const participantsList = res.data.allParticipants.map((p: any) => ({
            userId: p.userId,
            firstName: p.firstName,
            lastName: p.lastName,
            hasSeen: p.response === 'yes',
            hasResponded: p.response === 'yes', // 'no' means invited but not responded (same UI as not responded)
          }));
          setParticipants(participantsList);

          // Calculate stats
          const confirmed = participantsList.filter((p: Participant) => p.hasSeen).length;
          const invited = participantsList.length;
          setStats({ confirmed, invited });
        } else {
          logger.warn('[RehearsalDetails] Response had no allParticipants');
        }
      } catch (err) {
        console.error('Failed to load participants:', err);
      } finally {
        setLoading(false);
      }
    };

    loadParticipants();
  }, [rehearsal]);

  const handleParticipantToggle = async (participant: Participant) => {
    // Only allow users to toggle their own status
    if (!user || participant.userId !== user.id.toString()) {
      return;
    }

    setRespondingUserId(participant.userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // The store owns the toggle and every card in the app reads from it, so the
    // list behind this sheet updates without being told.
    const wasSeen = participant.hasSeen;
    setParticipants(prev => prev.map(p =>
      p.userId === participant.userId
        ? { ...p, hasSeen: !wasSeen, hasResponded: true }
        : p
    ));

    await toggleSeen(rehearsal!.id);

    // The counts shown here come from the same place the cards read.
    const fresh = statsFor(rehearsal!.id);
    if (fresh) setStats(fresh);

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
    } else if (item.hasSeen) {
      iconName = 'eye';
      iconColor = Colors.accent.blue;
    } else {
      iconName = 'eye-off-outline';
      iconColor = Colors.text.tertiary;
    }

    const content = (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{displayName}</Text>
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

  if (loadFailed) {
    return (
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.calendar.rehearsal}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centred}>
          <Text style={styles.missingText}>{t.rehearsals.notFound}</Text>
        </View>
      </View>
    );
  }

  if (!rehearsal) {
    return (
      <View style={styles.sheet}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      </View>
    );
  }

  const locale = getDateLocale(language);
  const formattedDate = rehearsal.date
    ? formatDateLocalized(rehearsal.date, { day: 'numeric', month: 'long', weekday: 'long' }, locale)
    : '';

  return (
      <View style={styles.sheet}>
        <View style={styles.sheetInner}>
          {/* One heading, not two. There used to be a "Rehearsal details" bar
              above the rehearsal's own name, which said nothing the name did
              not and left two large texts fighting for the same band at the top
              of the sheet. The name is the heading; the grabber and a swipe
              close the sheet, and the cross stays for those who look for one. */}
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {rehearsal.title || t.calendar.rehearsal}
            </Text>
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
                  <Ionicons name="eye" size={16} color={Colors.accent.blue} />
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
  );
}

const styles = StyleSheet.create({
  // The navigator presents this as a sheet, so there is no backdrop or rounded
  // top to draw here — only the surface itself.
  sheet: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
  },
  sheetInner: {
    flex: 1,
    paddingBottom: Spacing.xl,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  missingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    // Clears the sheet's grabber, which sits in the top few points.
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    // Fills what the header leaves. It used to wrap its content instead, so the
    // sheet could size itself inside a Modal — as a screen that left the list
    // with no height at all, and the rehearsal's name drew over the header.
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
