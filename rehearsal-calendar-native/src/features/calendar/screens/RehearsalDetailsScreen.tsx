import { logger } from '../../../shared/utils/logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { IconButton } from '../../../shared/components/IconButton';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { useAuth } from '../../../contexts/AuthContext';
import { useSeen } from '../../../contexts/SeenContext';
import { Rehearsal, Project } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDateLocalized } from '../../../shared/utils/time';
import { rehearsalInZone, rehearsalTimeLabel } from '../../../shared/utils/rehearsalDays';
import { onDataChanged } from '../../../shared/utils/dataChanged';
import { useDeleteRehearsal } from '../hooks/useDeleteRehearsal';
import type { AppNavigation, AppStackParamList } from '../../../navigation';

interface Participant {
  userId: string;
  firstName: string;
  lastName: string;
  /** As loaded; this person's own row reads the store instead. */
  hasSeen: boolean;
}

interface AdminStats {
  confirmed: number;
  invited: number;
}

// iOS draws this sheet smaller while it stands at three quarters of the
// screen: 44 pt of layout measured 42 on the glass in Maestro's inspector
// (T-014). 47 is 44 and more there.
const SHEET_TARGET = 47;

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
  const navigation = useNavigation<AppNavigation<'RehearsalDetails'>>();
  const route = useRoute<RouteProp<AppStackParamList, 'RehearsalDetails'>>();
  const rehearsalId: string = String(route.params?.rehearsalId ?? '');

  const { t, language } = useI18n();
  const { user } = useAuth();
  const userTimezone = user?.timezone || 'UTC';
  const { projects } = useProjects();
  const { responseFor, statsFor, isResponding, toggleSeen, beginRead } = useSeen();

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Read again when a rehearsal changes: saved in the form "Edit" opens over
  // this sheet, which comes back to it (T-016).
  const [reads, setReads] = useState(0);
  useEffect(() => onDataChanged('rehearsals', () => setReads((n) => n + 1)), []);

  // Loaded here rather than passed in — see the note above the component.
  useEffect(() => {
    let alive = true;
    if (!rehearsalId) return;

    rehearsalsAPI
      .getById(rehearsalId)
      .then((res: any) => {
        if (!alive) return;
        // Days and times from the interval, as the calendar reads them.
        setRehearsal(rehearsalInZone(res.data.rehearsal, userTimezone));
        setLoadFailed(false);
      })
      .catch((err: any) => {
        logger.warn('[RehearsalDetails] Could not load:', err);
        if (!alive) return;
        // Gone is gone. Any other failure of a read again — after a save, on
        // a bad network — leaves the details as they were last read, rather
        // than "not found" with Edit and Delete hidden (review T-016).
        if (err?.response?.status === 404) setRehearsal(null);
        setLoadFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [rehearsalId, userTimezone, reads]);

  const project = rehearsal ? projects.find(p => p.id === rehearsal.projectId) || null : null;
  const isAdmin = project?.is_admin || false;
  const onClose = () => navigation.goBack();
  const askToDelete = useDeleteRehearsal();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const ownId = user ? String(user.id) : null;

  // The counts are an admin's, as the calendar's list gives them (adminStats),
  // and the answer and the project list come in either order: opened from a
  // notification, the participants may answer before the list says "admin",
  // and an admin who is not on the rehearsal has no calendar row to fill the
  // count in. So the answer's count waits here, with the writer of the read
  // that brought it, until both are known — the writer still drops it if a tap
  // has landed since (review).
  const [answeredCounts, setAnsweredCounts] = useState<{
    write: ReturnType<typeof beginRead>;
    counts: Record<string, AdminStats>;
  } | null>(null);
  useEffect(() => {
    if (isAdmin && answeredCounts) answeredCounts.write({}, answeredCounts.counts);
  }, [isAdmin, answeredCounts]);

  // Who is on it, and what the others answered. This person's own mark and
  // the counts are not kept here: they are SeenContext's, the one store the
  // cards read and the toggle writes. Details used to keep a second copy — its
  // own row and count from this answer, the toggle working from the store's —
  // and the two drifted: opened from a notification before the calendar had
  // primed the store, "seen" here was "not seen" there, and a tap to take the
  // mark back sent it again; a failed tap was undone in the store and stayed
  // here; the count after a tap was the store's from before it (DD01).
  useEffect(() => {
    setAnsweredCounts(null);
    if (!rehearsal) {
      setParticipants([]);
      return;
    }
    let alive = true;
    const rehearsalId = rehearsal.id;
    // Begun before the request: a tap on the way meanwhile keeps its mark (HN02).
    const primeSeen = beginRead();
    setLoading(true);

    rehearsalsAPI
      .getResponses(rehearsalId)
      .then((res: any) => {
        if (!alive) return;
        const all: any[] | undefined = res.data.allParticipants;
        if (!all) {
          logger.warn('[RehearsalDetails] Response had no allParticipants');
          return;
        }
        setParticipants(all.map((p) => ({
          userId: String(p.userId),
          firstName: p.firstName,
          lastName: p.lastName,
          // 'no' is "invited, not seen yet", the same as no answer.
          hasSeen: p.response === 'yes',
        })));
        const own = all.find((p) => String(p.userId) === ownId);
        const counts: AdminStats | undefined = res.data.stats;
        primeSeen(own ? { [rehearsalId]: own.response === 'yes' ? 'yes' : null } : {});
        if (counts) {
          setAnsweredCounts({
            write: primeSeen,
            counts: { [rehearsalId]: { confirmed: counts.confirmed, invited: counts.invited } },
          });
        }
      })
      .catch((err: any) => {
        logger.error('Failed to load participants:', err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [rehearsal, beginRead, ownId]);

  const stats = rehearsal ? statsFor(rehearsal.id) : undefined;
  const ownSeen = rehearsal ? responseFor(rehearsal.id) === 'yes' : false;
  const ownResponding = rehearsal ? isResponding(rehearsal.id) : false;

  const handleOwnToggle = () => {
    if (!rehearsal || ownResponding) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // The store turns its own mark, the one this row shows, and undoes it if
    // the server refuses: the row, the count and every card follow.
    toggleSeen(rehearsal.id);
  };

  const renderParticipant = ({ item }: { item: Participant }) => {
    const displayName = `${item.firstName}${item.lastName ? ' ' + item.lastName : ''}`;
    const isCurrentUser = item.userId === ownId;
    const seen = isCurrentUser ? ownSeen : item.hasSeen;
    const responding = isCurrentUser && ownResponding;

    const content = (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{displayName}</Text>
        </View>
        {responding ? (
          <ActivityIndicator size="small" color={Colors.accent.purple} />
        ) : (
          <Ionicons
            name={seen ? 'eye' : 'eye-off-outline'}
            size={20}
            color={seen ? Colors.accent.blue : Colors.text.tertiary}
          />
        )}
      </View>
    );

    if (isCurrentUser) {
      return (
        <Pressable
          key={item.userId}
          testID="own-seen-toggle"
          accessibilityRole="button"
          accessibilityLabel={displayName}
          accessibilityState={{ selected: seen, disabled: responding }}
          onPress={handleOwnToggle}
          disabled={responding}
        >
          {content}
        </Pressable>
      );
    }

    return <View key={item.userId}>{content}</View>;
  };

  if (loadFailed && !rehearsal) {
    return (
      <View style={styles.fill}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.calendar.rehearsal}</Text>
          <IconButton icon="close" accessibilityLabel={t.common.close} onPress={onClose} minSize={SHEET_TARGET} />
        </View>
        <View style={styles.centred}>
          <Text style={styles.missingText}>{t.rehearsals.notFound}</Text>
        </View>
      </View>
    );
  }

  if (!rehearsal) {
    return (
      <View style={styles.fill}>
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

  // One scroll view, one flow. Nesting flex: 1 containers inside a native sheet
  // is what put the header and the list on top of each other: the sheet does not
  // hand its children a resolved height, so both collapsed to zero and were laid
  // from the same origin — the header behind, the rows over it.
  return (
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
          {/* One heading, not two. There used to be a "Rehearsal details" bar
              above the rehearsal's own name, which said nothing the name did
              not and left two large texts fighting for the same band at the top
              of the sheet. The name is the heading; the grabber and a swipe
              close the sheet, and the cross stays for those who look for one. */}
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {rehearsal.title || t.calendar.rehearsal}
            </Text>
            {/* An admin's way to the form from here, so a rehearsal opened
                from a notification can be changed too (T-016). Over this
                sheet, which reads it again when the form saves. */}
            {isAdmin && (
              <Pressable
                testID="rehearsal-details-edit"
                accessibilityRole="button"
                style={styles.headerAction}
                hitSlop={4}
                onPress={() => navigation.navigate('AddRehearsal', {
                  rehearsalId: rehearsal.id,
                  projectId: rehearsal.projectId,
                })}
              >
                <Text style={styles.headerActionText}>{t.rehearsals.edit}</Text>
              </Pressable>
            )}
            <IconButton icon="close" accessibilityLabel={t.common.close} onPress={onClose} minSize={SHEET_TARGET} />
          </View>

          <View style={styles.content}>

            {/* The facts, as rows of text: in boxes they looked like fields
                to type in. The place is only words — often "Hall 1" — and
                opens no map (owner, 30.10). */}
            {/* Date */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.blue} />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            {/* Time */}
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.detailText} testID="rehearsal-details-time">
                {rehearsalTimeLabel(rehearsal, locale)}
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
                  <Text style={styles.statText} testID="rehearsal-details-seen-count">
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

            {/* At the foot, away from everything else: the confirmation is
                the cards' own (useDeleteRehearsal), and the sheet goes when
                it is done. */}
            {isAdmin && (
              <Pressable
                testID="rehearsal-details-delete"
                accessibilityRole="button"
                style={styles.deleteRow}
                onPress={() => askToDelete(rehearsal, onClose)}
              >
                <Text style={styles.deleteText}>{t.common.delete}</Text>
              </Pressable>
            )}
          </View>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The navigator presents this as a sheet, so there is no backdrop or rounded
  // top to draw here — only the surface itself.
  sheet: {
    backgroundColor: Colors.bg.secondary,
  },
  // For the two states that have nothing to scroll.
  fill: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
  },
  sheetContent: {
    // Fills the sheet when the content is short, scrolls when it is not.
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
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
  headerAction: {
    minHeight: SHEET_TARGET,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerActionText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  content: {
    padding: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TouchTarget,
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
  deleteRow: {
    marginTop: Spacing.xl,
    minHeight: SHEET_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass.bg,
  },
  deleteText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.red,
  },
});
