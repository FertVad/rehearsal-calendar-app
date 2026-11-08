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
import { ScreenHeader, HeaderTextButton } from '../../../shared/components/ScreenHeader';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useI18n } from '../../../contexts/I18nContext';
import { useProjects } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSeen } from '../../../contexts/SeenContext';
import { Rehearsal } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { formatDate } from '../../../shared/utils/dateFormat';
import { rehearsalInZone, rehearsalTimeLabel } from '../../../shared/utils/rehearsalDays';
import { usePhoneUses24HourClock } from '../../../shared/utils/clockFormat';
import { onDataChanged } from '../../../shared/utils/dataChanged';
import { requestErrorMessage } from '../../../shared/utils/requestError';
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

/**
 * The people on a rehearsal as this person reads them: their own row first —
 * the one they tap — and the others in the order the server gave them (by
 * name). Someone not on it, an admin looking in, gets the list as it came
 * (T-033).
 */
function ownRowFirst<T extends { userId: string }>(people: T[], ownId: string | null): T[] {
  const own = people.findIndex((p) => p.userId === ownId);
  if (own <= 0) return people;
  return [people[own], ...people.slice(0, own), ...people.slice(own + 1)];
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
  const uses24 = usePhoneUses24HourClock();
  const { user } = useAuth();
  const userTimezone = user?.timezone || 'UTC';
  const { projects } = useProjects();
  const { responseFor, statsFor, isResponding, toggleSeen, beginRead } = useSeen();

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  // What the last read failed with, null when it did not: gone (404) is "not
  // found", and no connection or the server down is said as such — it read
  // "not found" offline as well (T-228).
  const [loadError, setLoadError] = useState<unknown>(null);
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
        setLoadError(null);
      })
      .catch((err: any) => {
        logger.warn('[RehearsalDetails] Could not load:', err);
        if (!alive) return;
        // Gone is gone. Any other failure of a read again — after a save, on
        // a bad network — leaves the details as they were last read, rather
        // than "not found" with Edit and Delete hidden (review T-016).
        if (err?.response?.status === 404) setRehearsal(null);
        setLoadError(err ?? new Error('load failed'));
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
        setParticipants(ownRowFirst(all.map((p) => ({
          userId: String(p.userId),
          firstName: p.firstName,
          lastName: p.lastName,
          // 'no' is "invited, not seen yet", the same as no answer.
          hasSeen: p.response === 'yes',
        })), ownId));
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
          {isCurrentUser && <Text style={styles.ownLabel}>{t.rehearsals.you}</Text>}
        </View>
        {responding ? (
          <ActivityIndicator size="small" color={Colors.accent.purple} />
        ) : (
          <Ionicons
            name={seen ? 'eye' : 'eye-off-outline'}
            size={20}
            color={seen ? Colors.accent.purple : Colors.text.secondary}
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

  if (loadError && !rehearsal) {
    return (
      <View style={styles.fill}>
        <View style={styles.header}>
          <ScreenHeader
            kind="modal"
            title={t.calendar.rehearsal}
            cancelLabel={t.common.close}
            onCancel={onClose}
            target={SHEET_TARGET}
          />
        </View>
        <View style={styles.centred}>
          <Text style={styles.missingText}>
            {(loadError as any)?.response?.status === 404
              ? t.rehearsals.notFound
              : requestErrorMessage(t, loadError, t.rehearsals.notFound)}
          </Text>
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

  const formattedDate = rehearsal.date ? formatDate(rehearsal.date, 'weekdayDayMonth', language) : '';

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
              close the sheet, and "Close" is where every sheet has its way out
              (T-029). */}
          <View style={styles.header}>
            <ScreenHeader
              kind="modal"
              title={rehearsal.title || t.calendar.rehearsal}
              titleLines={2}
              cancelLabel={t.common.close}
              onCancel={onClose}
              target={SHEET_TARGET}
              // An admin's way to the form from here, so a rehearsal opened
              // from a notification can be changed too (T-016). Over this
              // sheet, which reads it again when the form saves.
              right={isAdmin ? (
                <HeaderTextButton
                  testID="rehearsal-details-edit"
                  label={t.rehearsals.edit}
                  target={SHEET_TARGET}
                  onPress={() => navigation.navigate('AddRehearsal', {
                    rehearsalId: rehearsal.id,
                    projectId: rehearsal.projectId,
                  })}
                />
              ) : null}
            />
          </View>

          <View style={styles.content}>

            {/* The facts, as rows of text: in boxes they looked like fields
                to type in. The place is only words — often "Hall 1" — and
                opens no map (owner, 30.10). */}
            {/* Date */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.text.secondary} />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            {/* Time */}
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={Colors.text.secondary} />
              <Text style={styles.detailText} testID="rehearsal-details-time">
                {rehearsalTimeLabel(rehearsal, language, uses24)}
              </Text>
            </View>

            {/* Project */}
            {project && (
              <View style={styles.detailRow}>
                <Ionicons name="folder-outline" size={20} color={Colors.text.secondary} />
                <Text style={[styles.detailText, styles.projectText]} testID="rehearsal-details-project">
                  {project.name}
                </Text>
              </View>
            )}

            {/* Location */}
            {rehearsal.location && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailText}>{rehearsal.location}</Text>
              </View>
            )}

            {/* An admin looking in on a rehearsal they are not on (T-232):
                said, as on the card, and there is no row of theirs below to
                mark. */}
            {rehearsal.onRoster === false && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={20} color={Colors.text.secondary} />
                <Text style={[styles.detailText, styles.projectText]} testID="rehearsal-details-not-on-roster">
                  {t.rehearsals.notOnRoster}
                </Text>
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
                  <Ionicons name="eye" size={16} color={Colors.accent.purple} />
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
  // The bar is ScreenHeader's; this only clears the sheet's grabber, which
  // sits in the top few points, and draws the line under it.
  header: {
    paddingTop: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
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
  // The project, its name as its folder, is not coloured (T-031).
  projectText: {
    color: Colors.text.secondary,
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
  ownLabel: {
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
