import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
// The row is inside a Swipeable, and React Native's own touchables take no
// part in gesture-handler's arbitration: a swipe let slide back would open the
// details as well (as in the inbox, NotificationsScreen).
import { TouchableOpacity as GestureTouchable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '../../../shared/components/IconButton';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { useSeen } from '../../../contexts/SeenContext';
import { rehearsalTimeLabel } from '../../../shared/utils/rehearsalDays';
import { usePhoneUses24HourClock } from '../../../shared/utils/clockFormat';
import { formatDate } from '../../../shared/utils/dateFormat';
import { parseDateString } from '../../../shared/utils/time';
import { projectColor } from '../../../shared/utils/projectColor';
import { useDeleteRehearsal } from '../hooks/useDeleteRehearsal';
import type { AppNavigation } from '../../../navigation';

interface RehearsalCardProps {
  rehearsal: Rehearsal;
  /** The date column on the left (T-036): `day` writes the rehearsal's day in
   *  it, `blank` keeps its width empty — a later one of the same day. Omitted
   *  under a heading that already says which day these belong to: no column. */
  dateColumn?: 'day' | 'blank';
  /** The two lists disagreed on where this comes from — one read the project
   *  the rehearsal belongs to, the other the name denormalised onto it. The
   *  caller decides now. */
  projectName?: string;
  isAdmin: boolean;
  isSynced?: boolean;
  onPress: () => void;
}

/**
 * One rehearsal, as a row of a list (T-036, owner's choice B of 04.11): 88 pt,
 * the day on the left, the title, the time and place, the project with its
 * dot, and the eye on the right.
 *
 * It was a card of 203 pt, with a date badge, an "Admin" badge, an icon to
 * every line and the eye on a strip of its own: the calendar showed one
 * rehearsal whole. The rows of a list share one ground (RehearsalList).
 *
 * Today's rehearsals and the upcoming ones used to render this separately, so
 * every change had to be made twice — which is how the rehearsal title nearly
 * shipped visible in one list and missing from the other.
 *
 * An admin edits and deletes it with a swipe to the left (T-016). The pencil
 * and the bin used to sit on the card, the bin 16 pt from the pencil, and a
 * tap meant for one could land on the other.
 */
export default function RehearsalCard({
  rehearsal,
  dateColumn,
  projectName,
  isAdmin,
  isSynced = false,
  onPress,
}: RehearsalCardProps) {
  const { t, language } = useI18n();
  const uses24 = usePhoneUses24HourClock();
  const navigation = useNavigation<AppNavigation>();
  const askToDelete = useDeleteRehearsal();
  const swipeable = useRef<Swipeable>(null);

  // Read straight from the store. These used to arrive as five props threaded
  // from the screen through every list in between, which is why a second list
  // could only show this card by being handed its own copy of the state.
  const { responseFor, statsFor, isResponding, toggleSeen } = useSeen();
  const currentResponse = responseFor(rehearsal.id);
  const stats = statsFor(rehearsal.id);
  const responding = isResponding(rehearsal.id);

  const seenLabel =
    stats && (stats.confirmed > 0 || isAdmin)
      ? isAdmin && stats.invited > 0
        ? `${stats.confirmed}/${stats.invited}`
        : `${stats.confirmed}`
      : null;

  // An admin sees every rehearsal of their project, the ones they are not on
  // too (T-232). There is nothing for them to mark there — the server refuses
  // it, NOT_ON_REHEARSAL — so no eye, and the row says why. Only an explicit
  // false: a rehearsal read without the field is one the reader is on.
  const notOnRoster = rehearsal.onRoster === false;

  const day = dateColumn === 'day' && rehearsal.date ? rehearsal.date : null;

  const row = (
    <View style={styles.rehearsalRow}>
      <GestureTouchable
        onPress={onPress}
        activeOpacity={0.7}
        // The outer box takes the row's width beside the eye; the inner one,
        // the element that is tapped and read, its whole height.
        containerStyle={styles.rehearsalRowMainBox}
        style={[styles.rehearsalRowMain, !dateColumn && styles.rehearsalRowMainNoDate]}
      >
        {dateColumn ? (
          <View style={styles.rehearsalDateColumn} testID="rehearsal-row-date">
            {day ? (
              <>
                <Text style={styles.rehearsalWeekday} numberOfLines={1}>
                  {formatDate(day, 'weekdayShort', language)}
                </Text>
                <Text style={styles.rehearsalDayNumber}>{parseDateString(day).getDate()}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.rehearsalRowText}>
          {rehearsal.title ? (
            <Text style={styles.rehearsalRowTitle} numberOfLines={1}>
              {rehearsal.title}
            </Text>
          ) : null}

          <View style={styles.rehearsalRowLine}>
            <Text style={styles.rehearsalRowTime} testID="rehearsal-card-time">
              {rehearsalTimeLabel(rehearsal, language, uses24)}
            </Text>
            {/* In the phone's calendar: said in the second line's colour —
                green is a state, free (T-031). */}
            {isSynced && (
              <Ionicons
                name="calendar"
                size={13}
                color={Colors.text.secondary}
                style={styles.rehearsalRowSynced}
              />
            )}
            {rehearsal.location ? (
              <Text style={styles.rehearsalRowPlace} numberOfLines={1}>
                {` · ${rehearsal.location}`}
              </Text>
            ) : null}
          </View>

          {projectName || notOnRoster ? (
            <View style={styles.rehearsalRowLine}>
              {projectName ? (
                <>
                  <View
                    style={[styles.rehearsalProjectDot, { backgroundColor: projectColor(rehearsal.projectId) }]}
                    testID="rehearsal-project-dot"
                  />
                  <Text style={styles.rehearsalRowProject} numberOfLines={1}>
                    {projectName}
                  </Text>
                </>
              ) : null}
              {notOnRoster ? (
                <Text style={styles.rehearsalRowNotOnRoster} numberOfLines={1} testID="rehearsal-not-on-roster">
                  {projectName ? ` · ${t.rehearsals.notOnRoster}` : t.rehearsals.notOnRoster}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </GestureTouchable>

      <View style={styles.seenColumn}>
        {notOnRoster ? null : (
        <IconButton
          testID="seen-toggle"
          icon={currentResponse === 'yes' ? 'eye' : 'eye-off-outline'}
          color={currentResponse === 'yes' ? Colors.accent.purple : Colors.text.secondary}
          // Which rehearsal it marks: every row's eye said only "Mark as
          // seen", so VoiceOver and Voice Control had a list of the same
          // button, and the flows took whichever came first (T-223).
          accessibilityLabel={
            rehearsal.title ? `${t.rehearsals.markSeen}, ${rehearsal.title}` : t.rehearsals.markSeen
          }
          accessibilityState={{ selected: currentResponse === 'yes', disabled: responding }}
          accessibilityValue={seenLabel ? { text: seenLabel } : undefined}
          style={styles.seenButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleSeen(rehearsal.id);
          }}
          disabled={responding}
        />
        )}
        {/* Under the eye, outside its 44: the button already says it as its
            value, as it did when the count was inside it. With no eye — a
            rehearsal the reader is not on — the count says itself, or an
            admin off the cast would see the number and VoiceOver not read it. */}
        {seenLabel &&
          (notOnRoster ? (
            <Text
              style={styles.seenCount}
              testID="seen-count"
              accessible
              accessibilityLabel={t.rehearsals.seenCount(seenLabel)}
            >
              {seenLabel}
            </Text>
          ) : (
            <Text
              style={styles.seenCount}
              testID="seen-count"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {seenLabel}
            </Text>
          ))}
      </View>
    </View>
  );

  // No swipe for anyone else: there is nothing behind it they may do.
  if (!isAdmin) return row;

  const renderActions = () => (
    <View style={styles.swipeActions}>
      <GestureTouchable
        testID="rehearsal-swipe-edit"
        style={[styles.swipeAction, styles.swipeActionEdit]}
        onPress={() => {
          swipeable.current?.close();
          navigation.navigate('AddRehearsal', {
            rehearsalId: rehearsal.id,
            projectId: rehearsal.projectId,
          });
        }}
      >
        <Ionicons name="create-outline" size={22} color={Colors.text.inverse} />
        <Text style={styles.swipeActionText}>{t.rehearsals.edit}</Text>
      </GestureTouchable>
      <GestureTouchable
        testID="rehearsal-swipe-delete"
        style={[styles.swipeAction, styles.swipeActionDelete]}
        onPress={() => {
          swipeable.current?.close();
          askToDelete(rehearsal);
        }}
      >
        <Ionicons name="trash-outline" size={22} color={Colors.text.inverse} />
        <Text style={styles.swipeActionText}>{t.common.delete}</Text>
      </GestureTouchable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeable}
      renderRightActions={renderActions}
      overshootRight={false}
      friction={2}
      // Two actions are twice the inbox's one, and half their width — the
      // default — took a swipe across half the screen to open them.
      rightThreshold={40}
      // The list's own ground, so the actions do not show through the row
      // while it slides.
      childrenContainerStyle={styles.swipeRowUnder}
    >
      {row}
    </Swipeable>
  );
}
